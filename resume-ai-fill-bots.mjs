import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PAYLOAD = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const full = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(full(rel), 'utf8');
const write = (rel, text) => {
  fs.mkdirSync(path.dirname(full(rel)), { recursive: true });
  fs.writeFileSync(full(rel), text, 'utf8');
};
const backup = rel => {
  const src = full(rel);
  if (!fs.existsSync(src)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${src}.ai-fill-resume.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
};

function ensureImport(text, anchor, line, label) {
  if (text.includes(line)) return text;
  const i = text.indexOf(anchor);
  if (i < 0) throw new Error(`Import anchor ausente: ${label}`);
  return text.slice(0, i + anchor.length) + '\n' + line + text.slice(i + anchor.length);
}

function replaceRequired(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`Anchor ausente: ${label}`);
  return text.replace(before, after);
}

function findBlockEnd(text, openBraceIndex) {
  let depth = 0;
  let quote = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];
    const nx = text[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && nx === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && nx === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && nx === '*') { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('Bloco JS sem fechamento.');
}

function replaceMethod(text, signature, replacement, label) {
  const s = text.indexOf(signature);
  if (s < 0) throw new Error(`Metodo ausente: ${label}`);
  const brace = text.indexOf('{', s);
  if (brace < 0) throw new Error(`Abertura do metodo ausente: ${label}`);
  const end = findBlockEnd(text, brace);
  return text.slice(0, s) + replacement + text.slice(end + 1);
}

function replaceRegexRequired(text, regex, replacement, label, min = 1) {
  let count = 0;
  const out = text.replace(regex, (...args) => {
    count++;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count < min) throw new Error(`Regex sem matches suficientes (${count}/${min}): ${label}`);
  return out;
}

function insertBefore(text, anchor, payload, marker, label) {
  if (marker && text.includes(marker)) return text;
  const i = text.indexOf(anchor);
  if (i < 0) throw new Error(`Anchor ausente: ${label}`);
  return text.slice(0, i) + payload + text.slice(i);
}

for (const rel of [
  'server/server-engine.js',
  'server/tag-team-engine.js',
  'server/raid-room-engine.js',
  'server/product-modes.js',
  'js/raid-rules.js',
  'server.js',
  'package.json'
]) backup(rel);

// Always refresh the two files that the failed patch already created.
write('server/bot-ai.js', fs.readFileSync(path.join(PAYLOAD, 'bot-ai-source.js'), 'utf8'));
write('scripts/test-release-bot-ai.mjs', fs.readFileSync(path.join(PAYLOAD, 'test-release-bot-ai-source.mjs'), 'utf8'));
console.log('[OK] bot-ai.js + teste restaurados/atualizados');

// =====================================================================
// server/server-engine.js — structural method replacement.
// =====================================================================
let engine = read('server/server-engine.js');
engine = ensureImport(
  engine,
  "import crypto from 'crypto';",
  "import { chooseDuelBotAction } from './bot-ai.js';",
  'server-engine'
);

const aiMethod = `  executeAiTurn() {
      const decision = chooseDuelBotAction(this, 'opponent');

      if (!decision) {
        if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
          setTimeout(() => {
            if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
              this.clearReactionTimer();
              this.resolveUnansweredAttack();
            }
          }, 850);
        }
        return;
      }

      switch (decision.action) {
        case 'playCard':
          this._playCard('opponent', decision.cardIndex, decision.cardId);
          break;
        case 'chargeKi':
          this._chargeKi('opponent');
          break;
        case 'passTurn':
          this._passTurn('opponent');
          break;
        case 'mashBeamClash':
          this._mashBeamClash('opponent');
          break;
        default:
          break;
      }
    }`;

if (!engine.includes("const decision = chooseDuelBotAction(this, 'opponent');")) {
  engine = replaceMethod(engine, '  executeAiTurn()', aiMethod, 'executeAiTurn');
}

if (!engine.includes('Date.now() - (this.lastMashAt?.opponent || 0) >= 180')) {
  const marker = `        this.beamClashData.timer = Math.max(0, this.beamClashData.timer - 0.1);`;
  const mi = engine.indexOf(marker);
  if (mi < 0) throw new Error('Anchor Beam Clash ausente.');
  const notify = engine.indexOf('        this.notifyState();', mi);
  if (notify < 0) throw new Error('notifyState do Beam Clash ausente.');
  const insertAt = notify + '        this.notifyState();'.length;
  const extra = `

        if (
          this.isAiMatch &&
          this.state === 'BEAM_CLASH' &&
          Date.now() - (this.lastMashAt?.opponent || 0) >= 180
        ) {
          this._mashBeamClash('opponent');
        }`;
  engine = engine.slice(0, insertAt) + extra + engine.slice(insertAt);
}
write('server/server-engine.js', engine);
console.log('[OK] server/server-engine.js');

// =====================================================================
// Tag Team bot identity.
// =====================================================================
let tag = read('server/tag-team-engine.js');
if (!tag.includes("botDifficulty: entry.botDifficulty || 'normal'")) {
  tag = replaceRegexRequired(
    tag,
    /(\s+leader:\s*entry\.leader,\r?\n)(\s+downed:\s*false,)/g,
    `$1        isBot: !!entry.isBot,\n        botDifficulty: entry.botDifficulty || 'normal',\n$2`,
    'TagTeam metadata',
    2
  );
}
if (!tag.includes('isBot: !!member.isBot')) {
  tag = replaceRequired(
    tag,
    `      leader: member.fighter.leader,
      hp: member.fighter.hp,`,
    `      leader: member.fighter.leader,
      isBot: !!member.isBot,
      hp: member.fighter.hp,`,
    'TagTeam public metadata'
  );
}
write('server/tag-team-engine.js', tag);
console.log('[OK] server/tag-team-engine.js');

// =====================================================================
// Raid player bots + boss intelligence.
// =====================================================================
let raid = read('server/raid-room-engine.js');
if (!raid.includes("import { chooseRaidBossDecision } from './bot-ai.js';")) {
  raid = insertBefore(
    raid,
    '\nfunction shuffleSecure',
    "\nimport { chooseRaidBossDecision } from './bot-ai.js';\n",
    "chooseRaidBossDecision",
    'raid boss import'
  );
}
if (!raid.includes("botDifficulty: entry.botDifficulty || 'normal'")) {
  raid = replaceRequired(
    raid,
    `        nextAttackBonus: 0,
        guardBlock: 0,`,
    `        nextAttackBonus: 0,
        isBot: !!entry.isBot,
        botDifficulty: entry.botDifficulty || 'normal',
        threat: 0,
        guardBlock: 0,`,
    'Raid player metadata'
  );
}
if (!raid.includes('sourcePlayer.threat =')) {
  raid = replaceRequired(
    raid,
    `    this.boss.hp = Math.max(0, this.boss.hp - damage);
    const oldPhase = this.boss.phase;`,
    `    this.boss.hp = Math.max(0, this.boss.hp - damage);
    sourcePlayer.threat = Math.max(0, Number(sourcePlayer.threat) || 0) + damage;
    const oldPhase = this.boss.phase;`,
    'Raid threat'
  );
}
if (!raid.includes('chooseRaidBossDecision({')) {
  raid = replaceRegexRequired(
    raid,
    /    const profile = raidBossAttackProfile\(this\.boss, this\.boss\.phase, this\.round\);\r?\n    const targets = this\._selectTargets\(profile\);/,
    `    const decision = chooseRaidBossDecision({
      boss: this.boss,
      players: this.getAlivePlayers(),
      phase: this.boss.phase,
      round: this.round
    });
    const profile = decision?.profile || raidBossAttackProfile(this.boss, this.boss.phase, this.round);
    const selected = (decision?.targetUids || [])
      .map(uid => this.getPlayer(uid))
      .filter(Boolean);
    const targets = selected.length ? selected : this._selectTargets(profile);`,
    'Raid boss decision'
  );
}
if (!raid.includes('isBot: !!player.isBot')) {
  raid = replaceRequired(
    raid,
    `        isAwakened: player.isAwakened,
        downed: player.downed,`,
    `        isAwakened: player.isAwakened,
        isBot: !!player.isBot,
        downed: player.downed,`,
    'Raid state bot metadata'
  );
}
write('server/raid-room-engine.js', raid);
console.log('[OK] server/raid-room-engine.js');

// =====================================================================
// Raid 15s.
// =====================================================================
let rr = read('js/raid-rules.js');
rr = rr.replace(/export const RAID_QUEUE_FILL_MS\s*=\s*\d+\s*;/, 'export const RAID_QUEUE_FILL_MS = 15000;');
if (!rr.includes('RAID_QUEUE_FILL_MS = 15000')) throw new Error('RAID_QUEUE_FILL_MS nao foi atualizado.');
write('js/raid-rules.js', rr);
console.log('[OK] js/raid-rules.js');

// =====================================================================
// server.js — Ranked 1v1 + Raid fill.
// =====================================================================
let server = read('server.js');
server = ensureImport(
  server,
  "import { RaidRoomEngine } from './server/raid-room-engine.js';",
  "import { BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, RaidBotController, isBotUid } from './server/bot-ai.js';",
  'server bot import'
);

if (!server.includes("if (isBotUid(uid)) return null;")) {
  server = replaceRequired(
    server,
    `async function updateRankedUser(uid, isWin) {
  const user = await User.findOne({ uid });`,
    `async function updateRankedUser(uid, isWin) {
  if (isBotUid(uid)) return null;
  const user = await User.findOne({ uid });`,
    'skip bot ranked persistence'
  );
}

if (!server.includes('room.botController?.dispose?.();')) {
  server = replaceRequired(
    server,
    `  room.finished = true;
  room.engine.winner = winnerRole;`,
    `  room.finished = true;
  room.botController?.dispose?.();
  room.engine.winner = winnerRole;`,
    'dispose ranked bot'
  );
}

if (!server.includes('async function startRankedBotMatchByUid(')) {
  const helper = `
function clearMatchmakingBotTimer(entry) {
  if (entry?.botFillTimer) {
    clearTimeout(entry.botFillTimer);
    entry.botFillTimer = null;
  }
}

function scheduleRankedBotFill(entry) {
  clearMatchmakingBotTimer(entry);
  entry.botFillTimer = setTimeout(() => {
    entry.botFillTimer = null;
    startRankedBotMatchByUid(entry.uid).catch(err => {
      console.error('[Ranked Bot Fill] Failed:', err);
    });
  }, BOT_FILL_DELAY_MS);
  entry.botFillTimer.unref?.();
}

async function startRankedBotMatchByUid(uid) {
  const index = matchmakingQueue.findIndex(item => item.uid === uid);
  if (index < 0) return false;

  const human = matchmakingQueue[index];
  const humanSocket = io.sockets.sockets.get(human.socketId);
  if (!humanSocket?.connected || humanSocket.authUid !== human.uid) {
    clearMatchmakingBotTimer(human);
    matchmakingQueue.splice(index, 1);
    return false;
  }

  matchmakingQueue.splice(index, 1);
  clearMatchmakingBotTimer(human);
  const bot = createBotProfile({ mode: 'ranked1v1', difficulty: 'hard' });

  roomCounter += 1;
  const roomCode = \`room_\${Date.now()}_\${roomCounter}\`;
  const matchId = \`ranked_\${crypto.randomUUID()}\`;
  const initiative = crypto.randomInt(0, 2) === 0 ? 'player' : 'opponent';

  const room = {
    roomCode,
    matchId,
    engine: null,
    botController: null,
    finished: false,
    stateVersion: 0,
    lastSeq: { player: 0, opponent: 0 },
    slots: {
      player: {
        uid: human.uid,
        username: human.username,
        leader: human.leader,
        socketId: humanSocket.id,
        connected: true,
        isBot: false,
        reconnectTimer: null
      },
      opponent: {
        uid: bot.uid,
        username: bot.username,
        leader: bot.leader,
        socketId: null,
        connected: true,
        isBot: true,
        reconnectTimer: null
      }
    }
  };

  room.engine = new ServerGameEngine(
    eng => {
      sendRoomState(roomCode);
      room.botController?.poke();
      if (eng.state === 'GAME_OVER' && eng.winner && !room.finished) {
        finalizeRankedRoom(roomCode, eng.winner, 'KO').catch(err => {
          console.error('[Ranked Bot] Finalize error:', err);
        });
      }
    },
    (type, data) => sendRoomFx(roomCode, type, data)
  );

  activeRooms[roomCode] = room;
  humanSocket.roomCode = roomCode;
  humanSocket.matchRole = 'player';
  humanSocket.join(roomCode);

  room.engine.startMatch(
    human.leader,
    bot.leader,
    human.deck,
    false,
    {
      playerDeck: room.engine.secureShuffle(human.deck),
      opponentDeck: room.engine.secureShuffle(bot.deck),
      initiative
    }
  );

  room.botController = new DuelBotController({ engine: room.engine, botKey: 'opponent' });
  attachSocketToRoom(humanSocket, roomCode, 'player', false);
  room.botController.poke();

  console.log(\`[Ranked Bot] \${matchId}: \${human.username} vs \${bot.username}\`);
  return true;
}

`;
  server = insertBefore(server, '\nconst raidQueues = new Map();', helper, 'startRankedBotMatchByUid', 'ranked bot helpers');
}

if (!server.includes("createBotProfile({\n      mode: 'raid'")) {
  server = replaceRegexRequired(
    server,
    /  if \(connected\.length < RAID_MIN_PLAYERS\) \{\r?\n    queue\.entries = connected;\r?\n    return false;\r?\n  \}\r?\n\r?\n  const team = connected\.slice\(0, RAID_MAX_PLAYERS\);\r?\n  const used = new Set\(team\.map\(entry => entry\.uid\)\);/,
    `  if (connected.length < 1) {
    queue.entries = connected;
    return false;
  }

  const team = connected.slice(0, RAID_MAX_PLAYERS);
  while (team.length < RAID_MAX_PLAYERS) {
    team.push(createBotProfile({
      mode: 'raid',
      difficulty: 'normal',
      index: team.length
    }));
  }
  const used = new Set(connected.slice(0, RAID_MAX_PLAYERS).map(entry => entry.uid));`,
    'Raid fill bots'
  );
}

server = server.replace(
  'if (queue.entries.length < RAID_MIN_PLAYERS && queue.fillTimer)',
  'if (queue.entries.length === 0 && queue.fillTimer)'
);

if (!server.includes('queue.entries.length >= 1 && !queue.fillTimer')) {
  server = replaceRegexRequired(
    server,
    /  if \(queue\.entries\.length >= RAID_MIN_PLAYERS && !queue\.fillTimer\) \{\r?\n    queue\.fillTimer = setTimeout\(\(\) => \{\r?\n      queue\.fillTimer = null;\r?\n      startRaidFromQueue\(bossId\)\.catch\(console\.error\);\r?\n    \}, RAID_QUEUE_FILL_MS\);\r?\n  \}/,
    `  if (queue.entries.length >= 1 && !queue.fillTimer) {
    queue.fillTimer = setTimeout(() => {
      queue.fillTimer = null;
      startRaidFromQueue(bossId).catch(console.error);
    }, RAID_QUEUE_FILL_MS);
    queue.fillTimer.unref?.();
  }`,
    'Raid schedule 1+'
  );
}

if (!server.includes('botController: null') || !server.includes('RaidBotController')) {
  server = replaceRequired(
    server,
    `    engine: null,
    finalized: false,`,
    `    engine: null,
    botController: null,
    finalized: false,`,
    'Raid controller field'
  );
}

if (!server.includes('isBot: !!entry.isBot')) {
  server = replaceRequired(
    server,
    `      connected: true,
      abandoned: false,`,
    `      connected: true,
      isBot: !!entry.isBot,
      abandoned: false,`,
    'Raid slot metadata'
  );
}

if (!server.includes('room.botController?.poke();') || !server.includes('new RaidBotController')) {
  server = replaceRequired(
    server,
    `    onState: () => emitRaidState(roomCode),`,
    `    onState: () => {
      emitRaidState(roomCode);
      room.botController?.poke();
    },`,
    'Raid state bot poke'
  );

  server = replaceRequired(
    server,
    `  });

  for (const entry of team) {
    const socket = io.sockets.sockets.get(entry.socketId);`,
    `  });

  room.botController = new RaidBotController({ engine: room.engine });
  room.botController.poke();

  for (const entry of team) {
    const socket = io.sockets.sockets.get(entry.socketId);`,
    'Raid controller creation'
  );
}

if (!server.includes("socket.emit('waiting_for_opponent', { botFillMs: BOT_FILL_DELAY_MS });")) {
  server = replaceRequired(
    server,
    `    if (opponentIndex < 0) {
      matchmakingQueue.push(entry);
      socket.emit('waiting_for_opponent');
      return;
    }`,
    `    if (opponentIndex < 0) {
      matchmakingQueue.push(entry);
      scheduleRankedBotFill(entry);
      socket.emit('waiting_for_opponent', { botFillMs: BOT_FILL_DELAY_MS });
      return;
    }`,
    'Ranked no opponent timer'
  );

  server = replaceRequired(
    server,
    `    const opponentEntry = matchmakingQueue.splice(opponentIndex, 1)[0];
    const opponentSocket = io.sockets.sockets.get(opponentEntry.socketId);`,
    `    const opponentEntry = matchmakingQueue.splice(opponentIndex, 1)[0];
    clearMatchmakingBotTimer(opponentEntry);
    const opponentSocket = io.sockets.sockets.get(opponentEntry.socketId);`,
    'Ranked clear opponent timer'
  );

  server = replaceRequired(
    server,
    `    if (!opponentSocket?.connected) {
      matchmakingQueue.push(entry);
      socket.emit('waiting_for_opponent');
      return;
    }`,
    `    if (!opponentSocket?.connected) {
      matchmakingQueue.push(entry);
      scheduleRankedBotFill(entry);
      socket.emit('waiting_for_opponent', { botFillMs: BOT_FILL_DELAY_MS });
      return;
    }`,
    'Ranked disconnected fallback'
  );
}

// Make queue removals timer-safe in both leave/disconnect sites.
server = server.replace(
  /if \(matchmakingQueue\[i\]\.socketId === socket\.id \|\| matchmakingQueue\[i\]\.uid === socket\.authUid\) \{\s*matchmakingQueue\.splice\(i, 1\);\s*\}/g,
  `if (matchmakingQueue[i].socketId === socket.id || matchmakingQueue[i].uid === socket.authUid) {
        clearMatchmakingBotTimer(matchmakingQueue[i]);
        matchmakingQueue.splice(i, 1);
      }`
);
server = server.replace(
  /if \(matchmakingQueue\[i\]\.socketId === socket\.id\) matchmakingQueue\.splice\(i, 1\);/g,
  `if (matchmakingQueue[i].socketId === socket.id) {
        clearMatchmakingBotTimer(matchmakingQueue[i]);
        matchmakingQueue.splice(i, 1);
      }`
);

write('server.js', server);
console.log('[OK] server.js');

// =====================================================================
// product-modes.js — 2v2 + private.
// =====================================================================
let modes = read('server/product-modes.js');
modes = ensureImport(
  modes,
  "import { TagTeamEngine } from './tag-team-engine.js';",
  "import { BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, TagTeamBotController, isBotUid } from './bot-ai.js';",
  'product modes bot import'
);

if (!modes.includes("if (isBotUid(uid)) return null;")) {
  modes = replaceRequired(
    modes,
    `async function updateRankedTeamUser(uid, isWin) {
  const user = await User.findOne({ uid });`,
    `async function updateRankedTeamUser(uid, isWin) {
  if (isBotUid(uid)) return null;
  const user = await User.findOne({ uid });`,
    'skip team bot persistence'
  );
}

if (!modes.includes('function scheduleTeamBotFill()')) {
  const helpers = `  let teamFillTimer = null;

  function clearTeamFillTimer() {
    if (teamFillTimer) {
      clearTimeout(teamFillTimer);
      teamFillTimer = null;
    }
  }

  function scheduleTeamBotFill() {
    if (!teamQueue.length || teamQueue.length >= TEAM_MATCH_SIZE || teamFillTimer) return;
    teamFillTimer = setTimeout(() => {
      teamFillTimer = null;
      const connected = teamQueue.filter(entry => {
        const socket = io.sockets.sockets.get(entry.socketId);
        return socket?.connected && socket.authUid === entry.uid;
      });
      teamQueue.length = 0;
      teamQueue.push(...connected);
      if (!teamQueue.length) return;

      const entries = teamQueue.splice(0, TEAM_MATCH_SIZE);
      while (entries.length < TEAM_MATCH_SIZE) {
        entries.push(createBotProfile({
          mode: 'ranked2v2',
          difficulty: 'hard',
          index: entries.length
        }));
      }
      startTeamRoom(entries, { ranked: true });
      if (teamQueue.length) scheduleTeamBotFill();
    }, BOT_FILL_DELAY_MS);
    teamFillTimer.unref?.();
  }

  function clearPrivateBotFill(lobby) {
    if (lobby?.fillTimer) {
      clearTimeout(lobby.fillTimer);
      lobby.fillTimer = null;
    }
  }

  function schedulePrivateBotFill(lobby) {
    if (!lobby || lobby.fillTimer) return;
    const required = lobby.mode === '2v2' ? 4 : 2;
    if (lobby.members.length >= required) return;

    lobby.fillTimer = setTimeout(async () => {
      lobby.fillTimer = null;
      if (!privateLobbies.has(lobby.code)) return;
      while (lobby.members.length < required) {
        lobby.members.push(createBotProfile({
          mode: lobby.mode === '2v2' ? 'private2v2' : 'private1v1',
          difficulty: 'normal',
          index: lobby.members.length
        }));
      }
      emitPrivateLobbyStatus(lobby);
      await maybeStartPrivateLobby(lobby);
    }, BOT_FILL_DELAY_MS);
    lobby.fillTimer.unref?.();
  }

`;
  modes = replaceRequired(
    modes,
    `  const privateDuels = new Map();

  function userInProductMode(uid) {`,
    `  const privateDuels = new Map();
${helpers}  function userInProductMode(uid) {`,
    'product bot helpers'
  );
}

if (!modes.includes('room.botController?.poke();')) {
  modes = replaceRequired(
    modes,
    `      eng => {
        sendPrivateDuelState(code);`,
    `      eng => {
        sendPrivateDuelState(code);
        room.botController?.poke();`,
    'private duel bot poke'
  );
}

if (!modes.includes("new DuelBotController({ engine: room.engine, botKey: 'opponent' })")) {
  modes = replaceRequired(
    modes,
    `    if (aSocket) attachPrivateDuel(aSocket, code, 'player', false);`,
    `    if (b?.isBot) {
      room.botController = new DuelBotController({ engine: room.engine, botKey: 'opponent' });
      room.botController.poke();
    }

    if (aSocket) attachPrivateDuel(aSocket, code, 'player', false);`,
    'private duel controller'
  );
}

if (!modes.includes('new TagTeamBotController({ teamEngine: room.engine })')) {
  modes = replaceRequired(
    modes,
    `      onState: () => sendTeamState(code),`,
    `      onState: () => {
        sendTeamState(code);
        room.botController?.poke();
      },`,
    'team bot poke'
  );
  modes = replaceRequired(
    modes,
    `    teamRooms.set(code, room);`,
    `    room.botController = new TagTeamBotController({ teamEngine: room.engine });
    room.botController.poke();

    teamRooms.set(code, room);`,
    'team bot controller'
  );
}

if (!modes.includes('isBot: !!entry.isBot')) {
  modes = replaceRegexRequired(
    modes,
    /(\s+connected:\s*true,\r?\n)(\s+reconnectTimer:\s*null)/,
    `$1          isBot: !!entry.isBot,\n$2`,
    'team slot metadata'
  );
}

if (!modes.includes('clearPrivateBotFill(lobby);')) {
  modes = replaceRequired(
    modes,
    `    if (lobby.members.length < required) return;
    privateLobbies.delete(lobby.code);`,
    `    if (lobby.members.length < required) return;
    clearPrivateBotFill(lobby);
    privateLobbies.delete(lobby.code);`,
    'private start clear timer'
  );
}

if (!modes.includes('else scheduleTeamBotFill();')) {
  modes = replaceRequired(
    modes,
    `  function removeFromTeamQueue(uid) {
    for (let i = teamQueue.length - 1; i >= 0; i--) {
      if (teamQueue[i].uid === uid) teamQueue.splice(i, 1);
    }
  }`,
    `  function removeFromTeamQueue(uid) {
    for (let i = teamQueue.length - 1; i >= 0; i--) {
      if (teamQueue[i].uid === uid) teamQueue.splice(i, 1);
    }
    if (!teamQueue.length) clearTeamFillTimer();
    else scheduleTeamBotFill();
  }`,
    'team remove timer'
  );
}

if (!modes.includes('} else {\n        scheduleTeamBotFill();')) {
  modes = replaceRequired(
    modes,
    `      if (teamQueue.length >= TEAM_MATCH_SIZE) {
        const team = teamQueue.splice(0, TEAM_MATCH_SIZE);
        startTeamRoom(team, { ranked: true });
      }`,
    `      if (teamQueue.length >= TEAM_MATCH_SIZE) {
        clearTeamFillTimer();
        const team = teamQueue.splice(0, TEAM_MATCH_SIZE);
        startTeamRoom(team, { ranked: true });
        if (teamQueue.length) scheduleTeamBotFill();
      } else {
        scheduleTeamBotFill();
      }`,
    '2v2 bot fill'
  );
}

if (!modes.includes('fillTimer: null')) {
  modes = replaceRequired(
    modes,
    `        ownerUid: profile.uid,
        members: [{`,
    `        ownerUid: profile.uid,
        fillTimer: null,
        members: [{`,
    'private fill field'
  );
}

if (!modes.includes('botFillMs: BOT_FILL_DELAY_MS')) {
  modes = replaceRequired(
    modes,
    `      privateLobbies.set(code, lobby);
      socket.privateLobbyCode = code;
      socket.emit('private_room_created', { code, mode, count: 1, required: mode === '2v2' ? 4 : 2 });`,
    `      privateLobbies.set(code, lobby);
      schedulePrivateBotFill(lobby);
      socket.privateLobbyCode = code;
      socket.emit('private_room_created', {
        code,
        mode,
        count: 1,
        required: mode === '2v2' ? 4 : 2,
        botFillMs: BOT_FILL_DELAY_MS
      });`,
    'private schedule bot fill'
  );
}

// Cleanup private timers in both leave and disconnect paths.
modes = modes.replace(
  /if \(!lobby\.members\.length\) privateLobbies\.delete\(code\);/g,
  `if (!lobby.members.length) {
        clearPrivateBotFill(lobby);
        privateLobbies.delete(code);
      }`
);
modes = modes.replace(
  /if \(!lobby\.members\.length\) privateLobbies\.delete\(lobby\.code\);/g,
  `if (!lobby.members.length) {
          clearPrivateBotFill(lobby);
          privateLobbies.delete(lobby.code);
        }`
);

write('server/product-modes.js', modes);
console.log('[OK] server/product-modes.js');

// =====================================================================
// package scripts.
// =====================================================================
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:bot-ai'] = 'node scripts/test-release-bot-ai.mjs';

if (!String(pkg.scripts.test || '').includes('test:bot-ai')) {
  pkg.scripts.test = `${pkg.scripts.test || 'npm run test:core'} && npm run test:bot-ai`;
}
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json');

console.log('AI FILL & BOT RUNTIME — RESUME APLICADO.');
