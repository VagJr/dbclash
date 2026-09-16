import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];
const passes = [];

function ok(name) {
  passes.push(name);
  console.log('PASS', name);
}
function warn(name) {
  warnings.push(name);
  console.log('WARN', name);
}
function fail(name) {
  failures.push(name);
  console.error('FAIL', name);
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const requiredFiles = [
  'server.js',
  'server/server-engine.js',
  'server/security-middleware.js',
  'server/auth-session.js',
  'server/raid-room-engine.js',
  'server/tag-team-engine.js',
  'server/product-modes.js',
  'server/user-model.js',
  'server/dojo-model.js',
  'js/game-engine.js',
  'js/content-rules.js',
  'js/economy-rules.js',
  'js/ranked-rules.js',
  'js/daily-quest-rules.js',
  'js/auth-manager.js',
  'js/socket-config.js',
  'js/multiplayer-manager.js',
  'js/raid-engine.js',
  'js/team-ui.js',
  'js/social-manager.js',
  'js/safe-dom.js',
  'js/runtime-guard.js',
  'sw.js',
  'manifest.json',
  'index.html'
];

for (const file of requiredFiles) {
  if (exists(file)) ok(`arquivo existe: ${file}`);
  else fail(`arquivo ausente: ${file}`);
}

let pkg = null;
try {
  pkg = JSON.parse(read('package.json'));
  ok('package.json valido');
} catch {
  fail('package.json invalido');
}

if (pkg) {
  const scripts = pkg.scripts || {};
  for (const script of [
    'test:core',
    'test:content',
    'test:account',
    'test:multiplayer',
    'test:raid',
    'test:social',
    'test:polish',
    'audit:release',
    'release:check'
  ]) {
    if (scripts[script]) ok(`script presente: ${script}`);
    else fail(`script ausente: ${script}`);
  }

  if (pkg.version === '1.0.0-rc.1') ok('versao marcada como 1.0.0-rc.1');
  else warn(`versao atual: ${pkg.version || 'indefinida'} (esperado 1.0.0-rc.1 apos aplicar RC1)`);
}

if (exists('server.js')) {
  const server = read('server.js');

  const forbidden = [
    ["origin: '*'", 'CORS wildcard'],
    ["origin:'*'", 'CORS wildcard compacto'],
    ['...(initialData || {})', 'cadastro aceita initialData arbitrario'],
    ['{ $set: userData }', 'sync irrestrito'],
    ['socket.userData.deck', 'deck confiado ao cliente'],
    ['MOCK_GLOBAL_LEADERBOARD', 'leaderboard mock']
  ];

  for (const [needle, label] of forbidden) {
    if (server.includes(needle)) fail(`server sem ${label}`);
    else ok(`server sem ${label}`);
  }

  for (const required of [
    'installHttpSecurity(app)',
    'installSocketPacketGuard(io)',
    'verifySessionToken',
    'finalizeRankedRoom',
    'finalizeRaidRoom',
    'registerProductModes'
  ]) {
    if (server.includes(required)) ok(`server integra ${required}`);
    else fail(`server nao integra ${required}`);
  }
}

if (exists('index.html')) {
  const html = read('index.html');

  if (html.includes("navigator.serviceWorker.register('./sw.js')")) ok('service worker registrado');
  else fail('service worker nao registrado');

  if (!html.includes('navigator.serviceWorker.getRegistrations()')) ok('nao desregistra service worker no boot');
  else fail('ainda desregistra service worker no boot');

  if (!html.includes('caches.delete(')) ok('nao apaga caches no boot');
  else fail('ainda apaga caches no boot');

  if (!html.includes('RANQUEADO 2v2 EM BREVE')) ok('stub 2v2 removido');
  else fail('stub 2v2 ainda presente');
}

if (exists('manifest.json')) {
  try {
    const manifest = JSON.parse(read('manifest.json'));
    if (manifest.display === 'standalone') ok('PWA display standalone');
    else warn(`PWA display=${manifest.display}`);

    if (manifest.orientation === 'any') ok('PWA sem lock de orientacao');
    else warn(`PWA orientation=${manifest.orientation || 'ausente'}`);

    if (manifest.icons?.length >= 2) ok('PWA possui icones');
    else fail('PWA sem conjunto minimo de icones');
  } catch {
    fail('manifest.json invalido');
  }
}

if (exists('sw.js')) {
  const sw = read('sw.js');
  if (sw.includes('/api/') && sw.includes('/socket.io')) ok('service worker exclui API/socket do cache');
  else fail('service worker pode cachear API/socket');
}

const envMode = process.argv.includes('--production');
if (envMode) {
  const requiredEnv = {
    NODE_ENV: 'production',
    MONGODB_URI: null,
    AUTH_SECRET: null
  };

  if (process.env.NODE_ENV === 'production') ok('NODE_ENV=production');
  else fail('NODE_ENV nao esta production');

  if (process.env.MONGODB_URI) ok('MONGODB_URI definido');
  else fail('MONGODB_URI ausente');

  if ((process.env.AUTH_SECRET || '').length >= 32) ok('AUTH_SECRET definido com 32+ chars');
  else fail('AUTH_SECRET ausente ou curto');

  const hasOrigin =
    !!process.env.CLIENT_URL ||
    !!process.env.PUBLIC_APP_URL ||
    !!process.env.ALLOWED_ORIGINS ||
    !!process.env.VERCEL_URL;

  if (hasOrigin) ok('origem de frontend configurada');
  else fail('CLIENT_URL/PUBLIC_APP_URL/ALLOWED_ORIGINS/VERCEL_URL ausente');
} else {
  warn('verificacao de variaveis de producao nao executada; use npm run rc:verify:prod no ambiente de deploy');
}

console.log('');
console.log(`RC VERIFY: ${passes.length} PASS / ${warnings.length} WARN / ${failures.length} FAIL`);

if (failures.length) {
  process.exitCode = 1;
}
