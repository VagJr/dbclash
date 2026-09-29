import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const rel = 'server/product-modes.js';
const file = path.join(ROOT, rel);

if (!fs.existsSync(file)) {
  throw new Error('Execute este hotfix na raiz C:\\dbclash.');
}

const backup = `${file}.realtime-startteam-hotfix.bak`;
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

let src = fs.readFileSync(file, 'utf8');

const fnStart = src.indexOf('  function startTeamRoom(');
if (fnStart < 0) throw new Error('startTeamRoom nao encontrada.');

const realtimeMarker = src.indexOf('new SquadBotController({ engine: room.engine })', fnStart);
if (realtimeMarker < 0) {
  throw new Error('A implementacao realtime de startTeamRoom nao foi encontrada.');
}

// The previous patcher stopped at the destructuring parameter brace and left
// the tail of the old function after the newly inserted function:
//
//   ... return room;
//   } = {}) {
//       const members = [...entries];
//       ... old implementation ...
//   }
//
// Remove only that stale tail, preserving the new function closing brace.
const staleTailStart = src.indexOf(' = {}) {', realtimeMarker);
const nextFunction = staleTailStart >= 0
  ? src.indexOf('\n  function emitPrivateLobbyStatus(', staleTailStart)
  : -1;

if (staleTailStart >= 0) {
  if (nextFunction < 0) {
    throw new Error('Inicio do bloco antigo encontrado, mas emitPrivateLobbyStatus nao foi localizado.');
  }

  src = src.slice(0, staleTailStart) + src.slice(nextFunction);
  console.log('[OK] bloco antigo duplicado de startTeamRoom removido');
} else {
  console.log('[INFO] bloco duplicado nao estava mais presente');
}

// Static integrity checks.
const startCount = (src.match(/function startTeamRoom\s*\(/g) || []).length;
if (startCount !== 1) {
  throw new Error(`Esperava exatamente 1 startTeamRoom; encontrei ${startCount}.`);
}

if (!src.includes("import { SquadBattleEngine } from './squad-battle-engine.js';")) {
  throw new Error('Import de SquadBattleEngine ausente.');
}
if (!src.includes("import { SquadBotController } from './realtime-bot-controllers.js';")) {
  throw new Error('Import de SquadBotController ausente.');
}
if (!src.includes('new SquadBattleEngine({')) {
  throw new Error('startTeamRoom nao instancia SquadBattleEngine.');
}
if (!src.includes('new SquadBotController({ engine: room.engine })')) {
  throw new Error('SquadBotController ausente.');
}
if (src.includes('new TagTeamEngine({')) {
  throw new Error('Implementacao antiga TagTeamEngine ainda esta ativa.');
}

// Catch the exact corruption class.
if (src.includes('} = {}) {')) {
  const suspicious = src.indexOf('} = {}) {');
  const around = src.slice(Math.max(0, suspicious - 100), suspicious + 100);
  // A normal function parameter can contain "} = {}) {" on the SAME function
  // declaration. Here we only reject it if it appears after the realtime
  // controller marker (the stale old tail location).
  if (suspicious > realtimeMarker) {
    throw new Error(`Fragmento antigo ainda presente perto de: ${around}`);
  }
}

fs.writeFileSync(file, src, 'utf8');
console.log('[OK] server/product-modes.js consistente');
console.log('REALTIME PRODUCT MODES HOTFIX APLICADO.');
