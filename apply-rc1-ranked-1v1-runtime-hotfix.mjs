import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function file(rel) { return path.join(root, rel); }
function read(rel) { return fs.readFileSync(file(rel), 'utf8'); }
function write(rel, text) {
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  fs.writeFileSync(file(rel), text, 'utf8');
}
function backup(rel) {
  const src = file(rel);
  if (!fs.existsSync(src)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${src}.rc1-ranked-runtime-hotfix.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
}

backup('server.js');
backup('package.json');

let server = read('server.js');

// 1) Import the starter-deck resolver used by loadRankedProfile().
if (!server.includes("import { getStarterDeckForLeader } from './js/card-database.js';")) {
  const anchor = "import { applyQuestEventToUser } from './js/daily-quest-rules.js';";
  if (!server.includes(anchor)) {
    throw new Error('Anchor de imports nao encontrado em server.js.');
  }
  server = server.replace(
    anchor,
    `${anchor}\nimport { getStarterDeckForLeader } from './js/card-database.js';`
  );
}

// 2) Prevent a profile-loading exception from becoming an unhandled rejection
//    that terminates Node 22.
const oldProfileCall = `    const profile = await loadRankedProfile(socket.authUid, payload?.leader);
    if (!profile.ok) {
      return socket.emit('ranked_error', {
        code: profile.code,
        message: profile.message
      });
    }`;

const newProfileCall = `    let profile;
    try {
      profile = await loadRankedProfile(socket.authUid, payload?.leader);
    } catch (err) {
      console.error('[Ranked] Profile load error:', err);
      return socket.emit('ranked_error', {
        code: 'PROFILE_LOAD_FAILED',
        message: 'Falha ao carregar o perfil ranqueado. Tente novamente.'
      });
    }

    if (!profile.ok) {
      return socket.emit('ranked_error', {
        code: profile.code,
        message: profile.message
      });
    }`;

if (server.includes(oldProfileCall)) {
  server = server.replace(oldProfileCall, newProfileCall);
} else if (!server.includes("code: 'PROFILE_LOAD_FAILED'")) {
  throw new Error('Bloco loadRankedProfile do matchmaking esta em formato inesperado.');
}

write('server.js', server);
console.log('[OK] server.js - import de starter deck + protecao da fila 1x1');

// 3) Add a regression test.
const sourceDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const testSource = fs.readFileSync(path.join(sourceDir, 'test-rc-ranked-runtime-source.mjs'), 'utf8');
write('scripts/test-rc-ranked-runtime.mjs', testSource);
console.log('[OK] scripts/test-rc-ranked-runtime.mjs');

// 4) Wire into RC gate while preserving previous hotfix scripts.
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:rc-ranked-runtime'] = 'node scripts/test-rc-ranked-runtime.mjs';

const current = String(pkg.scripts['rc:check'] || '');
if (!current.includes('test:rc-ranked-runtime')) {
  if (current.includes('npm run rc:verify')) {
    pkg.scripts['rc:check'] = current.replace(
      'npm run rc:verify',
      'npm run test:rc-ranked-runtime && npm run rc:verify'
    );
  } else {
    pkg.scripts['rc:check'] =
      'npm run release:check && npm run test:rc-ranked-runtime && npm run rc:verify && npm run rc:report';
  }
}
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json - teste conectado ao rc:check');

console.log('RC1 RANKED 1V1 RUNTIME HOTFIX APLICADO.');
