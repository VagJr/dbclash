import cors from 'cors';

const LOCAL_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(?::\d+)?$/i;

export function buildAllowedOrigins(env = process.env) {
  const out = new Set();

  for (const local of [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5500'
  ]) out.add(local);

  for (const key of ['CLIENT_URL', 'PUBLIC_APP_URL']) {
    if (env[key]) out.add(String(env[key]).trim().replace(/\/+$/, ''));
  }

  if (env.VERCEL_URL) {
    const value = String(env.VERCEL_URL).trim();
    out.add((value.startsWith('http') ? value : `https://${value}`).replace(/\/+$/, ''));
  }

  for (const value of String(env.ALLOWED_ORIGINS || '').split(',')) {
    const clean = value.trim().replace(/\/+$/, '');
    if (clean) out.add(clean);
  }

  return out;
}

export function isOriginAllowed(origin, env = process.env) {
  if (!origin) return true;
  const normalized = String(origin).replace(/\/+$/, '');

  if (buildAllowedOrigins(env).has(normalized)) return true;
  if (env.NODE_ENV !== 'production' && LOCAL_ORIGIN_RE.test(normalized)) return true;

  return false;
}

export function socketCorsOptions(env = process.env) {
  return {
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin, env));
    },
    methods: ['GET', 'POST'],
    credentials: false
  };
}

export class SlidingWindowLimiter {
  constructor({ windowMs = 60_000, max = 60 } = {}) {
    this.windowMs = Math.max(100, Number(windowMs) || 60_000);
    this.max = Math.max(1, Number(max) || 60);
    this.buckets = new Map();
  }

  allow(key, now = Date.now()) {
    const id = String(key || 'anonymous');
    const cutoff = now - this.windowMs;
    const current = (this.buckets.get(id) || []).filter(ts => ts > cutoff);

    if (current.length >= this.max) {
      this.buckets.set(id, current);
      return false;
    }

    current.push(now);
    this.buckets.set(id, current);

    if (this.buckets.size > 5000) this.prune(now);
    return true;
  }

  prune(now = Date.now()) {
    const cutoff = now - this.windowMs;
    for (const [key, values] of this.buckets.entries()) {
      const active = values.filter(ts => ts > cutoff);
      if (active.length) this.buckets.set(key, active);
      else this.buckets.delete(key);
    }
  }
}

export function createHttpRateLimiter({ windowMs, max, name = 'api' }) {
  const limiter = new SlidingWindowLimiter({ windowMs, max });

  return (req, res, next) => {
    const key = `${name}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;

    if (!limiter.allow(key)) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'Muitas requisicoes. Tente novamente em instantes.'
      });
    }

    next();
  };
}

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

export function installHttpSecurity(app, env = process.env) {
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(cors(socketCorsOptions(env)));

  app.use('/api/auth', createHttpRateLimiter({
    windowMs: 15 * 60_000,
    max: 20,
    name: 'auth'
  }));

  app.use('/api', createHttpRateLimiter({
    windowMs: 60_000,
    max: 240,
    name: 'api'
  }));
}

function socketBudgetFor(event, payload) {
  if (event === 'send_chat') return { key: 'chat', windowMs: 10_000, max: 8 };

  if (event === 'game_action' && payload?.action === 'mashBeamClash') {
    return { key: 'beam_mash', windowMs: 5_000, max: 140 };
  }

  if (
    event === 'game_action' ||
    event === 'raid_action' ||
    event === 'team_action'
  ) {
    return { key: 'gameplay', windowMs: 10_000, max: 50 };
  }

  if (
    event.includes('matchmaking') ||
    event.includes('raid_queue') ||
    event.includes('private_room') ||
    event.includes('team_matchmaking')
  ) {
    return { key: 'queue', windowMs: 10_000, max: 20 };
  }

  return { key: 'default', windowMs: 10_000, max: 80 };
}

export function installSocketPacketGuard(io) {
  io.on('connection', socket => {
    const limiters = new Map();
    let strikes = 0;

    socket.use((packet, next) => {
      const event = String(packet?.[0] || '');
      const payload = packet?.[1];
      const budget = socketBudgetFor(event, payload);

      if (!limiters.has(budget.key)) {
        limiters.set(budget.key, new SlidingWindowLimiter(budget));
      }

      const limiter = limiters.get(budget.key);
      if (limiter.allow(socket.id)) return next();

      strikes += 1;
      socket.emit('rate_limited', { event, code: 'RATE_LIMITED' });

      if (strikes >= 8) {
        socket.disconnect(true);
      }

      return;
    });
  });
}

export function validateProductionEnvironment(env = process.env) {
  if (env.NODE_ENV !== 'production') return true;

  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in production.');
  }

  if (!env.AUTH_SECRET || String(env.AUTH_SECRET).length < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 characters in production.');
  }

  if (!env.CLIENT_URL && !env.PUBLIC_APP_URL && !env.ALLOWED_ORIGINS && !env.VERCEL_URL) {
    throw new Error('Configure CLIENT_URL or ALLOWED_ORIGINS in production.');
  }

  return true;
}
