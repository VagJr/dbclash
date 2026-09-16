import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
}

function backup(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${full}.rc1-auth-hotfix.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(full, bak);
}

for (const rel of [
  'js/auth-manager.js',
  'js/socket-config.js',
  'sw.js',
  'server.js',
  'js/ui-manager.js',
  'package.json'
]) backup(rel);

// ---------------------------------------------------------------------
// 1) REST auth must use the same server URL already detected by SocketManager.
// ---------------------------------------------------------------------
let auth = read('js/auth-manager.js');

if (!auth.includes("from './socket-config.js'")) {
  const anchor = "import { getStarterDeckForLeader } from './card-database.js';";
  if (!auth.includes(anchor)) throw new Error('Auth import anchor nao encontrado.');
  auth = auth.replace(
    anchor,
    `${anchor}\nimport { socketManager } from './socket-config.js';`
  );
}

const oldGetServerUrl = `  getServerUrl() {
    if (typeof socketManager !== 'undefined' && socketManager?.serverUrl) return socketManager.serverUrl;
    if (typeof window !== 'undefined' && window.SERVER_URL) return window.SERVER_URL;
    return 'https://dbclash-server.onrender.com';
  }`;

const newGetServerUrl = `  getServerUrl() {
    if (socketManager?.serverUrl) return socketManager.serverUrl;
    if (typeof window !== 'undefined' && window.SERVER_URL) return window.SERVER_URL;
    return 'https://dbclash-server.onrender.com';
  }`;

if (auth.includes(oldGetServerUrl)) {
  auth = auth.replace(oldGetServerUrl, newGetServerUrl);
} else if (!auth.includes('if (socketManager?.serverUrl) return socketManager.serverUrl;')) {
  throw new Error('AuthManager.getServerUrl em formato inesperado.');
}

write('js/auth-manager.js', auth);
console.log('[OK] js/auth-manager.js - REST usa SocketManager.serverUrl');

// ---------------------------------------------------------------------
// 2) Service Worker must never resolve respondWith() with null.
// ---------------------------------------------------------------------
let sw = read('sw.js');

const oldSwFunction = `async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const update = fetch(request)
    .then(response => {
      if (response?.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || update || Response.error();
}`;

const newSwFunction = `async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const update = fetch(request)
    .then(async response => {
      if (response?.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    event?.waitUntil(update.then(() => undefined));
    return cached;
  }

  const network = await update;
  return network || Response.error();
}`;

if (sw.includes(oldSwFunction)) {
  sw = sw.replace(oldSwFunction, newSwFunction);
} else if (!sw.includes('return network || Response.error();')) {
  throw new Error('staleWhileRevalidate em formato inesperado.');
}

sw = sw.replace(
  'event.respondWith(staleWhileRevalidate(request));',
  'event.respondWith(staleWhileRevalidate(request, event));'
);

write('sw.js', sw);
console.log('[OK] sw.js - fallback sempre retorna Response');

// ---------------------------------------------------------------------
// 3) Registration message reflects username-based UI.
// ---------------------------------------------------------------------
let server = read('server.js');

const oldDuplicate = `    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Este e-mail ja esta cadastrado!' });
    }`;

const newDuplicate = `    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      const isUsernameAccount = cleanEmail.endsWith('@dbtcg.local');
      return res.status(400).json({
        success: false,
        code: 'ACCOUNT_EXISTS',
        message: isUsernameAccount
          ? 'Este nome de usuario ja esta cadastrado!'
          : 'Este e-mail ja esta cadastrado!'
      });
    }`;

if (server.includes(oldDuplicate)) {
  server = server.replace(oldDuplicate, newDuplicate);
} else if (!server.includes("code: 'ACCOUNT_EXISTS'")) {
  throw new Error('Bloco de conta duplicada em formato inesperado.');
}

write('server.js', server);
console.log('[OK] server.js - mensagem de conta duplicada corrigida');

// ---------------------------------------------------------------------
// 4) Add RC regression test.
// ---------------------------------------------------------------------
const sourceDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const testSource = fs.readFileSync(path.join(sourceDir, 'test-rc-auth-source.mjs'), 'utf8');
write('scripts/test-rc-auth.mjs', testSource);
console.log('[OK] scripts/test-rc-auth.mjs');

// ---------------------------------------------------------------------
// 5) Wire test into RC gate.
// ---------------------------------------------------------------------
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:rc-auth'] = 'node scripts/test-rc-auth.mjs';
pkg.scripts['rc:check'] =
  'npm run release:check && npm run test:rc-auth && npm run rc:verify && npm run rc:report';

write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json - rc:check inclui test:rc-auth');

console.log('RC1 AUTH HOTFIX APLICADO.');
