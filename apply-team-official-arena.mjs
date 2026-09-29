import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PAYLOAD = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const full = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(full(rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(full(rel), text, 'utf8');
const backup = rel => {
  const src = full(rel);
  if (!fs.existsSync(src)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${src}.official-team-arena.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
};

for (const rel of ['js/team-ui.js', 'styles/arena.css', 'js/multiplayer-manager.js', 'package.json']) {
  backup(rel);
}

write('js/team-ui.js', fs.readFileSync(path.join(PAYLOAD, 'team-ui-official-arena-source.js'), 'utf8'));
console.log('[OK] js/team-ui.js - integrado a arena oficial');

let arena = read('styles/arena.css');
const cssMarker = '2v2 REALTIME — Official Arena Integration';
if (!arena.includes(cssMarker)) {
  arena += '\n\n' + fs.readFileSync(path.join(PAYLOAD, 'team-arena-official.css'), 'utf8') + '\n';
}
write('styles/arena.css', arena);
console.log('[OK] styles/arena.css - layout 4 HUDs oficial');

// Route squad attack FX to TeamBattleUI before the legacy 1v1 FX normalization.
let mm = read('js/multiplayer-manager.js');
const listenerStart = `    socketManager.on('game_fx', payload => {
      if (!this.isMultiplayer || !payload) return;
`;
const listenerNew = `    socketManager.on('game_fx', payload => {
      if (!this.isMultiplayer || !payload) return;

      if (this.teamRoomCode && payload?.type === 'squad_attack') {
        teamBattleUI.handleFx(payload);
        return;
      }
`;
if (!mm.includes("payload?.type === 'squad_attack'")) {
  if (!mm.includes(listenerStart)) throw new Error('Anchor game_fx nao encontrado em multiplayer-manager.js');
  mm = mm.replace(listenerStart, listenerNew);
}
write('js/multiplayer-manager.js', mm);
console.log('[OK] js/multiplayer-manager.js - FX squad roteado');

// Add regression test to package gate.
write('scripts/test-release-team-arena-ui.mjs', fs.readFileSync(path.join(PAYLOAD, 'test-release-team-arena-ui.mjs'), 'utf8'));

const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:team-ui'] = 'node scripts/test-release-team-arena-ui.mjs';
if (!String(pkg.scripts.test || '').includes('test:team-ui')) {
  pkg.scripts.test = `${pkg.scripts.test} && npm run test:team-ui`;
}
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json - test:team-ui');

console.log('OFFICIAL 2v2 ARENA INTEGRATION APLICADA.');
