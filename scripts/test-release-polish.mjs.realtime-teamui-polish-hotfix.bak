import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildAllowedOrigins,
  isOriginAllowed,
  SlidingWindowLimiter,
  validateProductionEnvironment
} from '../server/security-middleware.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    passed += 1;
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

test('allowlist inclui localhost e CLIENT_URL configurado', () => {
  const env = { NODE_ENV: 'production', CLIENT_URL: 'https://game.example.com' };
  const origins = buildAllowedOrigins(env);
  assert.ok(origins.has('http://localhost:3000'));
  assert.ok(origins.has('https://game.example.com'));
});

test('origem aleatoria e bloqueada em producao', () => {
  const env = { NODE_ENV: 'production', CLIENT_URL: 'https://game.example.com' };
  assert.equal(isOriginAllowed('https://evil.example', env), false);
  assert.equal(isOriginAllowed('https://game.example.com', env), true);
});

test('rate limiter bloqueia acima do limite', () => {
  const limiter = new SlidingWindowLimiter({ windowMs: 1000, max: 2 });
  assert.equal(limiter.allow('a', 1000), true);
  assert.equal(limiter.allow('a', 1100), true);
  assert.equal(limiter.allow('a', 1200), false);
  assert.equal(limiter.allow('a', 2201), true);
});

test('ambiente de producao exige segredos e origem', () => {
  assert.throws(() => validateProductionEnvironment({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://x',
    AUTH_SECRET: 'short'
  }));

  assert.equal(validateProductionEnvironment({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://x',
    AUTH_SECRET: 'x'.repeat(32),
    CLIENT_URL: 'https://game.example.com'
  }), true);
});

test('server instala hardening HTTP e JSON limitado', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('installHttpSecurity(app)'));
  assert.ok(src.includes("express.json({ limit: '64kb', strict: true })"));
  assert.equal(/origin\s*:\s*['"]\*['"]/.test(src), false);
});

test('Socket.io tem limite de payload e packet guard', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('maxHttpBufferSize: 65536'));
  assert.ok(src.includes('perMessageDeflate: false'));
  assert.ok(src.includes('installSocketPacketGuard(io)'));
});

test('security headers nao dependem de CSP que quebra inline scripts', () => {
  const src = fs.readFileSync(new URL('../server/security-middleware.js', import.meta.url), 'utf8');
  assert.ok(src.includes("frame-ancestors 'none'"));
  assert.ok(src.includes("X-Content-Type-Options"));
  assert.ok(src.includes("Permissions-Policy"));
});

test('chat renderer usa helper DOM seguro sem innerHTML', () => {
  const src = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  const helperStart = src.indexOf('  appendSafeChatMessage(msg) {');
  const renderStart = src.indexOf('  renderChat() {');
  assert.ok(helperStart >= 0);
  assert.ok(renderStart >= 0);
  const helper = src.slice(helperStart, helperStart + 1800);
  const render = src.slice(renderStart, renderStart + 900);
  assert.ok(helper.includes('textContent'));
  assert.ok(helper.includes('createTextNode'));
  assert.ok(render.includes('appendSafeChatMessage'));
  assert.equal(helper.includes('bubble.innerHTML'), false);
  assert.equal(render.includes('bubble.innerHTML'), false);
});

test('callback realtime do chat tambem usa DOM seguro', () => {
  const src = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  const start = src.indexOf('  setupAuthAndLeaderboardHandlers() {');
  const block = src.slice(start, start + 3500);
  assert.ok(block.includes('appendSafeChatMessage'));
  assert.equal(block.includes('bubble.innerHTML'), false);
});

test('leaderboard nao interpola displayName em HTML', () => {
  const src = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  const start = Math.max(src.indexOf('  async openLeaderboardModal() {'), src.indexOf('  openLeaderboardModal() {'));
  const block = src.slice(start, start + 3500);
  assert.ok(block.includes('name.textContent'));
  assert.equal(block.includes('lbContainer.innerHTML = topList.map'), false);
});

test('Tag Team nao usa innerHTML com username', () => {
  const src = fs.readFileSync(new URL('../js/team-ui.js', import.meta.url), 'utf8');
  assert.ok(src.includes('nameEl.textContent'));
  assert.equal(src.includes('${member.username}'), false);
});

test('Raid escapa nomes e logs antes de templates HTML', () => {
  const src = fs.readFileSync(new URL('../js/raid-engine.js', import.meta.url), 'utf8');
  assert.ok(src.includes("from './safe-dom.js'"));
  assert.ok(src.includes('escapeHtml(player.username)'));
  assert.ok(src.includes('escapeHtml(log.text)'));
});

test('painel dev e bloqueado fora de localhost/dev mode', () => {
  const src = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  assert.ok(src.includes('isDevMode()'));
  assert.ok(src.includes('window.DBCLASH_DEV_MODE === true'));
});

test('loop de sprites usa requestAnimationFrame e pausa fora da arena', () => {
  const src = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  const start = src.indexOf('  startFighterSpriteLoop() {');
  const block = src.slice(start, start + 2200);
  assert.ok(block.includes('requestAnimationFrame'));
  assert.ok(block.includes("document.visibilityState === 'visible'"));
  assert.equal(block.includes('setInterval'), false);
});

test('reaction timer do servidor nao transmite 10 estados por segundo', () => {
  const src = fs.readFileSync(new URL('../server/server-engine.js', import.meta.url), 'utf8');
  const start = src.indexOf('  startReactionTimer(');
  const block = src.slice(start, start + 1300);
  assert.ok(block.includes('reactionDeadline'));
  assert.ok(block.includes('setTimeout'));
  assert.equal(block.includes('setInterval'), false);
  assert.equal(block.includes('notifyState()'), false);
});

test('cliente anima reaction timer localmente pelo deadline', () => {
  const src = fs.readFileSync(new URL('../js/game-engine.js', import.meta.url), 'utf8');
  const start = src.indexOf('  applyFullSyncState(data) {');
  const block = src.slice(start, start + 4500);
  assert.ok(block.includes('reactionDeadline'));
  assert.ok(block.includes('remoteReactionTimer'));
  assert.ok(block.includes('Date.now()'));
});

test('index registra service worker em vez de apagar cache', () => {
  const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(src.includes("navigator.serviceWorker.register('./sw.js')"));
  assert.equal(src.includes('registration.unregister()'), false);
  assert.equal(src.includes('caches.delete(name)'), false);
});

test('service worker ignora API e Socket.io', () => {
  const src = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(src.includes("url.pathname.startsWith('/api/')"));
  assert.ok(src.includes("url.pathname.startsWith('/socket.io/')"));
  assert.ok(src.includes('networkFirst'));
  assert.ok(src.includes('staleWhileRevalidate'));
});

test('fullscreen automatico em todo clique foi removido', () => {
  const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(src.includes("document.addEventListener('click', goFS)"), false);
  assert.equal(src.includes("document.addEventListener('touchstart', goFS)"), false);
});

test('manifest nao forca orientacao portrait', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.scope, './');
});

test('runtime guard informa offline e falha assíncrona', () => {
  const src = fs.readFileSync(new URL('../js/runtime-guard.js', import.meta.url), 'utf8');
  assert.ok(src.includes("addEventListener('offline'"));
  assert.ok(src.includes("addEventListener('online'"));
  assert.ok(src.includes("addEventListener('unhandledrejection'"));
});

test('UI principal nao depende mais do AuthDatabase legado', () => {
  const src = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  assert.equal(src.includes("from './auth-database.js'"), false);
  assert.equal(src.includes('authDatabase.'), false);
});

test('ranked scene renderiza perfil real em vez de 1250 RP fixo', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ui = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  assert.equal(html.includes('Guerreiro Prata (1250 RP)'), false);
  assert.ok(ui.includes('renderRankedSummary()'));
});

test('release audit existe como gate separado', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.scripts['audit:release']);
  assert.ok(pkg.scripts['release:check']);
});

console.log('POLISH RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');
