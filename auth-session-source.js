import crypto from 'node:crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production.');
  }
  return 'dbclash-local-development-secret-change-me';
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');
}

export function createSessionToken(userLike, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!userLike?.uid) throw new Error('Cannot create session without uid.');
  const payload = {
    uid: String(userLike.uid),
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token || typeof token !== 'string') return null;
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.uid || !payload.exp || payload.exp <= nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readBearerToken(req) {
  const header = req?.headers?.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

export function requireSession(req, res, next) {
  const payload = verifySessionToken(readBearerToken(req));
  if (!payload) return res.status(401).json({ success: false, message: 'Sessao invalida ou expirada.' });
  req.auth = payload;
  next();
}
