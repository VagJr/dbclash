import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PAYLOAD = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const full = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(full(rel), 'utf8');
const write = (rel, text) => { fs.mkdirSync(path.dirname(full(rel)), { recursive: true }); fs.writeFileSync(full(rel), text, 'utf8'); };
const backup = rel => {
  const src = full(rel);
  if (!fs.existsSync(src)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${src}.realtime-squad-raid.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
};

function findBlockEnd(text, openBraceIndex) {
  let depth = 0, quote = null, escape = false, line = false, block = false;
  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (line) { if (ch === '\n') line = false; continue; }
    if (block) { if (ch === '*' && nx === '/') { block = false; i++; } continue; }
    if (quote) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && nx === '/') { line = true; i++; continue; }
    if (ch === '/' && nx === '*') { block = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  throw new Error('Bloco JS sem fechamento.');
}

function replaceFunction(text, signature, replacement, label) {
  const start = text.indexOf(signature);
  if (start < 0) throw new Error(`Funcao ausente: ${label}`);
  const brace = text.indexOf('{', start);
  if (brace < 0) throw new Error(`Abertura ausente: ${label}`);
  const end = findBlockEnd(text, brace);
  return text.slice(0, start) + replacement + text.slice(end + 1);
}

function replaceRequired(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`Anchor ausente: ${label}`);
  return text.replace(before, after);
}

for (const rel of [
  'server.js', 'server/product-modes.js', 'server/raid-room-engine.js', 'js/raid-rules.js',
  'js/raid-engine.js', 'js/team-ui.js', 'js/multiplayer-manager.js',
  'scripts/test-release-raid.mjs', 'scripts/test-release-social.mjs', 'scripts/test-release-bot-ai.mjs'
]) backup(rel);

write('server/squad-battle-engine.js', fs.readFileSync(path.join(PAYLOAD, 'squad-battle-engine-source.js'), 'utf8'));
write('server/realtime-bot-controllers.js', fs.readFileSync(path.join(PAYLOAD, 'realtime-bot-controllers-source.js'), 'utf8'));
write('server/raid-room-engine.js', fs.readFileSync(path.join(PAYLOAD, 'raid-room-engine-realtime-source.js'), 'utf8'));
write('js/team-ui.js', fs.readFileSync(path.join(PAYLOAD, 'team-ui-realtime-source.js'), 'utf8'));
write('js/raid-engine.js', fs.readFileSync(path.join(PAYLOAD, 'raid-engine-realtime-source.js'), 'utf8'));
write('scripts/test-release-raid.mjs', fs.readFileSync(path.join(PAYLOAD, 'test-release-raid-realtime.mjs'), 'utf8'));
write('scripts/test-release-social.mjs', fs.readFileSync(path.join(PAYLOAD, 'test-release-social-realtime.mjs'), 'utf8'));
write('scripts/test-release-bot-ai.mjs', fs.readFileSync(path.join(PAYLOAD, 'test-release-bot-ai-realtime.mjs'), 'utf8'));
console.log('[OK] novos motores/UI/testes realtime gravados');

// Raid rules: a single human may queue, then CPUs fill to four. Add independent clocks.
let rules = read('js/raid-rules.js');
rules = rules.replace(/export const RAID_MIN_PLAYERS\s*=\s*\d+\s*;/, 'export const RAID_MIN_PLAYERS = 1;');
if (!rules.includes('RAID_PLAYER_ACTION_COOLDOWN_MS')) {
  rules = rules.replace(
    'export const RAID_TURN_MS = 30000;',
    `export const RAID_TURN_MS = 30000;\nexport const RAID_PLAYER_ACTION_COOLDOWN_MS = 1800;\nexport const RAID_BOSS_ACTION_MS = 5000;`
  );
}
write('js/raid-rules.js', rules);
console.log('[OK] js/raid-rules.js');

// product-modes: replace old active/reserve engine with 4-active squad engine.
let modes = read('server/product-modes.js');
modes = modes.replace("import { TagTeamEngine } from './tag-team-engine.js';", "import { SquadBattleEngine } from './squad-battle-engine.js';");
modes = modes.replace(
  /import \{ BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, TagTeamBotController, isBotUid \} from '\.\/bot-ai\.js';/,
  "import { BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, isBotUid } from './bot-ai.js';\nimport { SquadBotController } from './realtime-bot-controllers.js';"
);

const startTeamRoom = `  function startTeamRoom(entries, { ranked = true, roomCode = null } = {}) {
    const members = [...entries];
    if (members.length !== TEAM_MATCH_SIZE) throw new Error('2v2 requires four players.');

    const code = roomCode || \`team_\${Date.now()}_\${crypto.randomUUID().slice(0, 8)}\`;
    const matchId = \`\${ranked ? 'ranked2v2' : 'private2v2'}_\${crypto.randomUUID()}\`;
    const teamA = members.slice(0, TEAM_SIZE);
    const teamB = members.slice(TEAM_SIZE, TEAM_MATCH_SIZE);

    const room = {
      roomCode: code,
      matchId,
      ranked,
      finalized: false,
      lastSeq: {},
      slots: {},
      engine: null,
      botController: null
    };

    for (const [side, team] of [['A', teamA], ['B', teamB]]) {
      for (const entry of team) {
        room.lastSeq[entry.uid] = 0;
        room.slots[entry.uid] = {
          uid: entry.uid,
          username: entry.username,
          leader: entry.leader,
          socketId: entry.socketId,
          side,
          connected: true,
          isBot: !!entry.isBot,
          reconnectTimer: null
        };
      }
    }

    teamRooms.set(code, room);
    room.engine = new SquadBattleEngine({
      teamA,
      teamB,
      onState: () => {
        sendTeamState(code);
        room.botController?.poke();
      },
      onFx: (type, data) => io.to(code).emit('game_fx', { type, data }),
      onComplete: winnerSide => finalizeTeamRoom(code, winnerSide).catch(console.error)
    });

    room.botController = new SquadBotController({ engine: room.engine });
    room.botController.poke();
    sendTeamState(code);

    for (const entry of members) {
      const socket = io.sockets.sockets.get(entry.socketId);
      if (socket) attachTeamSocket(socket, code, false);
    }
    return room;
  }`;
modes = replaceFunction(modes, '  function startTeamRoom(', startTeamRoom, 'startTeamRoom');

modes = replaceRequired(
  modes,
  `    room.finalized = true;\n    sendTeamState(roomCode);`,
  `    room.finalized = true;\n    room.botController?.dispose?.();\n    sendTeamState(roomCode);`,
  'finalizeTeamRoom dispose'
);

modes = modes.replace(
  `    for (const slot of Object.values(room.slots)) {\n      let user = await User.findOne({ uid: slot.uid });`,
  `    for (const slot of Object.values(room.slots)) {\n      if (slot.isBot) continue;\n      let user = await User.findOne({ uid: slot.uid });`
);
write('server/product-modes.js', modes);
console.log('[OK] server/product-modes.js');

// Multiplayer client: Team UI owns actions and target selection; no 1v1 duel projection.
let mm = read('js/multiplayer-manager.js');
mm = replaceRequired(
  mm,
  `    teamBattleUI.bind({ onTag: () => this.broadcastTeamAction('tag', {}) });`,
  `    teamBattleUI.bind({ onAction: (action, data) => this.broadcastTeamAction(action, data) });`,
  'teamBattleUI bind'
);

const applyTeamState = `  applyTeamState(payload) {
    this.teamSide = payload.teamSide || this.teamSide;
    this.isHost = this.teamSide === 'A';
    teamBattleUI.applyState(payload, authManager.user?.uid);
  }`;
mm = replaceFunction(mm, '  applyTeamState(payload)', applyTeamState, 'applyTeamState');
write('js/multiplayer-manager.js', mm);
console.log('[OK] js/multiplayer-manager.js');

// Server Raid ownership fix + realtime bot controller.
let server = read('server.js');
server = server.replace(
  "import { BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, RaidBotController, isBotUid } from './server/bot-ai.js';",
  "import { BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, isBotUid } from './server/bot-ai.js';\nimport { RaidRealtimeBotController } from './server/realtime-bot-controllers.js';"
);

server = replaceRequired(
  server,
  `function emitRaidState(roomCode) {\n  const room = activeRaidRooms[roomCode];\n  if (!room) return;`,
  `function emitRaidState(roomCode) {\n  const room = activeRaidRooms[roomCode];\n  if (!room?.engine) return;`,
  'emitRaidState guard'
);

server = replaceRequired(
  server,
  `  const room = activeRaidRooms[roomCode];\n  if (!room || room.finalized) return false;`,
  `  const room = activeRaidRooms[roomCode];\n  if (!room?.engine || room.finalized) return false;`,
  'attachSocketToRaid guard'
);

server = server.replace(
  `    engine: null,\n    finalized: false,`,
  `    engine: null,\n    botController: null,\n    finalized: false,`
);

server = server.replace(
  `  room.botController = new RaidBotController({ engine: room.engine });`,
  `  room.botController = new RaidRealtimeBotController({ engine: room.engine });`
);

server = replaceRequired(
  server,
  `  room.botController = new RaidRealtimeBotController({ engine: room.engine });\n  room.botController.poke();\n\n  for (const entry of team) {`,
  `  room.botController = new RaidRealtimeBotController({ engine: room.engine });\n  room.botController.poke();\n  emitRaidState(roomCode);\n\n  for (const entry of team) {`,
  'initial raid state'
);

server = server.replace(
  `    if (!room.finalized) room.engine.tick(now);`,
  `    if (!room.finalized && room.engine) room.engine.tick(now);`
);

server = replaceRequired(
  server,
  `  room.finalized = true;\n\n  emitRaidState(roomCode);`,
  `  room.finalized = true;\n  room.botController?.dispose?.();\n\n  emitRaidState(roomCode);`,
  'raid finalize dispose'
);

server = server.replace(
  `  for (const slot of Object.values(room.slots)) {\n    let reward = { zeni: 0, xp: 0, trophies: 0, gems: 0 };`,
  `  for (const slot of Object.values(room.slots)) {\n    if (slot.isBot) continue;\n    let reward = { zeni: 0, xp: 0, trophies: 0, gems: 0 };`
);
write('server.js', server);
console.log('[OK] server.js - crash Raid corrigido + realtime controller');

console.log('REALTIME SQUAD + RAID CYCLE APLICADO.');
