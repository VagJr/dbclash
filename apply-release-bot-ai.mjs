import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const payloadDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function f(rel) { return path.join(root, rel); }
function read(rel) { return fs.readFileSync(f(rel), 'utf8'); }
function write(rel, text) {
  fs.mkdirSync(path.dirname(f(rel)), { recursive: true });
  fs.writeFileSync(f(rel), text, 'utf8');
}
function backup(rel) {
  const src = f(rel);
  if (!fs.existsSync(src)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${src}.bot-ai-cycle.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
}
function replaceOnce(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`Anchor nao encontrado: ${label}`);
  return text.replace(before, after);
}
function addImportAfter(text, anchor, line, label) {
  if (text.includes(line)) return text;
  if (!text.includes(anchor)) throw new Error(`Import anchor nao encontrado: ${label}`);
  return text.replace(anchor, `${anchor}\n${line}`);
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

write('server/bot-ai.js', fs.readFileSync(path.join(payloadDir, 'bot-ai-source.js'), 'utf8'));
write('scripts/test-release-bot-ai.mjs', fs.readFileSync(path.join(payloadDir, 'test-release-bot-ai-source.mjs'), 'utf8'));
console.log('[OK] novos arquivos bot-ai + testes');

// ------------------------------------------------------------------
// server/server-engine.js
// ------------------------------------------------------------------
let engine = read('server/server-engine.js');
engine = addImportAfter(
  engine,
  "import crypto from 'crypto';",
  "import { chooseDuelBotAction } from './bot-ai.js';",
  'server-engine bot import'
);

const oldAi = `  // ── AI TURN EXECUTION WITH FAILSAFE PASS ─────────────────────────────
  executeAiTurn() {
      if (this.state === 'FREE_ACTION' && this.initiative === 'opponent') {
        const playable = this.opponent.hand.findIndex(card => {
          if (!card || (!isAttackAction(card) && !isImmediateTechnique(card))) return false;
          return this.getCardCost('opponent', card) <= this.opponent.ki;
        });

        if (playable !== -1) this.playCard('opponent', playable);
        else if (this.opponent.ki < 10) this.chargeKi('opponent');
        else this.passTurn('opponent');
        return;
      }

      if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
        const defIdx = this.opponent.hand.findIndex(card => {
          if (!card || this.getCardCost('opponent', card) > this.opponent.ki) return false;
          return this.isReactionCardLegal('opponent', card, this.pendingAttack.card);
        });

        if (defIdx !== -1) {
          this.playCard('opponent', defIdx);
        } else {
          setTimeout(() => {
            if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
              this.clearReactionTimer();
              this.resolveUnansweredAttack();
            }
          }, 1000);
        }
      }
    }`;

const newAi = `  // ── RULE-AWARE AI TURN EXECUTION ─────────────────────────────────────
  executeAiTurn() {
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

engine = replaceOnce(engine, oldAi, newAi, 'executeAiTurn');

const beamAnchor = `        this.beamClashData.timer = Math.max(0, this.beamClashData.timer - 0.1);
        this.notifyState();

        if (this.beamClashData.p1Progress <= 0)`;
const beamAfter = `        this.beamClashData.timer = Math.max(0, this.beamClashData.timer - 0.1);
        this.notifyState();

        if (
          this.isAiMatch &&
          this.state === 'BEAM_CLASH' &&
          Date.now() - (this.lastMashAt?.opponent || 0) >= 180
        ) {
          this._mashBeamClash('opponent');
        }

        if (this.beamClashData.p1Progress <= 0)`;
engine = replaceOnce(engine, beamAnchor, beamAfter, 'AI beam clash');
write('server/server-engine.js', engine);
console.log('[OK] server/server-engine.js');

// ------------------------------------------------------------------
// server/tag-team-engine.js
// ------------------------------------------------------------------
let tag = read('server/tag-team-engine.js');
tag = replaceOnce(
  tag,
  `        leader: entry.leader,
        downed: false,`,
  `        leader: entry.leader,
        isBot: !!entry.isBot,
        botDifficulty: entry.botDifficulty || 'normal',
        downed: false,`,
  'tag team member bot metadata A/B'
);
tag = replaceOnce(
  tag,
  `      leader: member.fighter.leader,
      hp: member.fighter.hp,`,
  `      leader: member.fighter.leader,
      isBot: !!member.isBot,
      hp: member.fighter.hp,`,
  'tag public bot metadata'
);
write('server/tag-team-engine.js', tag);
console.log('[OK] server/tag-team-engine.js');

// ------------------------------------------------------------------
// server/raid-room-engine.js
// ------------------------------------------------------------------
let raidEngine = read('server/raid-room-engine.js');
raidEngine = addImportAfter(
  raidEngine,
  `} from '../js/raid-rules.js';`,
  `import { chooseRaidBossDecision } from './bot-ai.js';`,
  'raid boss AI import'
);
raidEngine = replaceOnce(
  raidEngine,
  `        nextAttackBonus: 0,
        guardBlock: 0,`,
  `        nextAttackBonus: 0,
        isBot: !!entry.isBot,
        botDifficulty: entry.botDifficulty || 'normal',
        threat: 0,
        guardBlock: 0,`,
  'raid player bot metadata'
);
raidEngine = replaceOnce(
  raidEngine,
  `    this.boss.hp = Math.max(0, this.boss.hp - damage);
    const oldPhase = this.boss.phase;`,
  `    this.boss.hp = Math.max(0, this.boss.hp - damage);
    sourcePlayer.threat = Math.max(0, Number(sourcePlayer.threat) || 0) + damage;
    const oldPhase = this.boss.phase;`,
  'raid threat accumulation'
);
raidEngine = replaceOnce(
  raidEngine,
  `    const profile = raidBossAttackProfile(this.boss, this.boss.phase, this.round);
    const targets = this._selectTargets(profile);
    this._log(\`${'${this.boss.name}'} usou ${'${profile.name}'}.\`, 'damage');`,
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
    const targets = selected.length ? selected : this._selectTargets(profile);
    this._log(\`${'${this.boss.name}'} usou ${'${profile.name}'}.\`, 'damage');`,
  'raid boss decision'
);
raidEngine = replaceOnce(
  raidEngine,
  `        isAwakened: player.isAwakened,
        downed: player.downed,`,
  `        isAwakened: player.isAwakened,
        isBot: !!player.isBot,
        downed: player.downed,`,
  'raid state bot metadata'
);
write('server/raid-room-engine.js', raidEngine);
console.log('[OK] server/raid-room-engine.js');

// ------------------------------------------------------------------
// js/raid-rules.js
// ------------------------------------------------------------------
let raidRules = read('js/raid-rules.js');
raidRules = raidRules.replace(
  'export const RAID_QUEUE_FILL_MS = 5000;',
  'export const RAID_QUEUE_FILL_MS = 15000;'
);
if (!raidRules.includes('export const RAID_QUEUE_FILL_MS = 15000;')) {
  throw new Error('Nao foi possivel configurar RAID_QUEUE_FILL_MS para 15000.');
}
write('js/raid-rules.js', raidRules);
console.log('[OK] js/raid-rules.js - 15s');

// ------------------------------------------------------------------
// server.js
// ------------------------------------------------------------------
let server = read('server.js');
server = addImportAfter(
  server,
  "import { RaidRoomEngine } from './server/raid-room-engine.js';",
  "import { BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, RaidBotController } from './server/bot-ai.js';",
  'server bot imports'
);

// Ranked result: bot slots never hit Mongo, controller is disposed.
server = replaceOnce(
  server,
  `  room.finished = true;
  room.engine.winner = winnerRole;
  room.engine.state = 'GAME_OVER';

  const loserRole = roomOpponentRole(winnerRole);
  const winnerUser = await updateRankedUser(room.slots[winnerRole].uid, true);
  const loserUser = await updateRankedUser(room.slots[loserRole].uid, false);`,
  `  room.finished = true;
  room.engine.winner = winnerRole;
  room.engine.state = 'GAME_OVER';
  room.botController?.dispose?.();

  const loserRole = roomOpponentRole(winnerRole);
  const winnerSlot = room.slots[winnerRole];
  const loserSlot = room.slots[loserRole];
  const winnerUser = winnerSlot?.isBot ? null : await updateRankedUser(winnerSlot.uid, true);
  const loserUser = loserSlot?.isBot ? null : await updateRankedUser(loserSlot.uid, false);`,
  'ranked bot result'
);

// Insert ranked bot helper before raid queues.
const rankedHelperAnchor = `

const raidQueues = new Map();`;
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
  if (!server.includes(rankedHelperAnchor)) throw new Error('Anchor raidQueues nao encontrado.');
  server = server.replace(rankedHelperAnchor, `${helper}${rankedHelperAnchor}`);
}

// Raid queue keeps timer with >=1 human.
server = server.replace(
  `    if (queue.entries.length < RAID_MIN_PLAYERS && queue.fillTimer) {`,
  `    if (queue.entries.length === 0 && queue.fillTimer) {`
);

server = replaceOnce(
  server,
  `  if (connected.length < RAID_MIN_PLAYERS) {
    queue.entries = connected;
    return false;
  }

  const team = connected.slice(0, RAID_MAX_PLAYERS);
  const used = new Set(team.map(entry => entry.uid));`,
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
  'raid fill bots'
);

server = replaceOnce(
  server,
  `    engine: null,
    finalized: false,`,
  `    engine: null,
    botController: null,
    finalized: false,`,
  'raid room bot controller'
);

server = replaceOnce(
  server,
  `      connected: true,
      abandoned: false,`,
  `      connected: true,
      isBot: !!entry.isBot,
      abandoned: false,`,
  'raid slot bot metadata'
);

server = replaceOnce(
  server,
  `    onState: () => emitRaidState(roomCode),`,
  `    onState: () => {
      emitRaidState(roomCode);
      room.botController?.poke();
    },`,
  'raid bot poke'
);

server = replaceOnce(
  server,
  `  });

  for (const entry of team) {
    const socket = io.sockets.sockets.get(entry.socketId);`,
  `  });

  room.botController = new RaidBotController({ engine: room.engine });
  room.botController.poke();

  for (const entry of team) {
    const socket = io.sockets.sockets.get(entry.socketId);`,
  'raid controller create'
);

server = replaceOnce(
  server,
  `  if (queue.entries.length >= RAID_MIN_PLAYERS && !queue.fillTimer) {
    queue.fillTimer = setTimeout(() => {
      queue.fillTimer = null;
      startRaidFromQueue(bossId).catch(console.error);
    }, RAID_QUEUE_FILL_MS);
  }`,
  `  if (queue.entries.length >= 1 && !queue.fillTimer) {
    queue.fillTimer = setTimeout(() => {
      queue.fillTimer = null;
      startRaidFromQueue(bossId).catch(console.error);
    }, RAID_QUEUE_FILL_MS);
    queue.fillTimer.unref?.();
  }`,
  'raid schedule with one human'
);

// Raid result skips bot DB writes.
server = replaceOnce(
  server,
  `  for (const slot of Object.values(room.slots)) {
    let reward = { zeni: 0, xp: 0, trophies: 0, gems: 0 };
    let user = await User.findOne({ uid: slot.uid });`,
  `  room.botController?.dispose?.();

  for (const slot of Object.values(room.slots)) {
    if (slot.isBot) continue;
    let reward = { zeni: 0, xp: 0, trophies: 0, gems: 0 };
    let user = await User.findOne({ uid: slot.uid });`,
  'raid finalize bots'
);

// Queue no-opponent branch: start 15s fill.
server = replaceOnce(
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
  'ranked queue bot timer'
);

// Human opponent clears old bot timer.
server = replaceOnce(
  server,
  `    const opponentEntry = matchmakingQueue.splice(opponentIndex, 1)[0];
    const opponentSocket = io.sockets.sockets.get(opponentEntry.socketId);`,
  `    const opponentEntry = matchmakingQueue.splice(opponentIndex, 1)[0];
    clearMatchmakingBotTimer(opponentEntry);
    const opponentSocket = io.sockets.sockets.get(opponentEntry.socketId);`,
  'ranked clear timer on human match'
);

// Disconnected opponent path gets fallback timer.
server = replaceOnce(
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
  'ranked disconnected opponent fallback'
);

// Clear timer on leave.
server = replaceOnce(
  server,
  `      if (matchmakingQueue[i].socketId === socket.id || matchmakingQueue[i].uid === socket.authUid) {
        matchmakingQueue.splice(i, 1);
      }`,
  `      if (matchmakingQueue[i].socketId === socket.id || matchmakingQueue[i].uid === socket.authUid) {
        clearMatchmakingBotTimer(matchmakingQueue[i]);
        matchmakingQueue.splice(i, 1);
      }`,
  'ranked leave clear timer'
);

// Clear timer on disconnect loop (a distinct block).
server = replaceOnce(
  server,
  `    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
      if (matchmakingQueue[i].socketId === socket.id) matchmakingQueue.splice(i, 1);
    }`,
  `    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
      if (matchmakingQueue[i].socketId === socket.id) {
        clearMatchmakingBotTimer(matchmakingQueue[i]);
        matchmakingQueue.splice(i, 1);
      }
    }`,
  'ranked disconnect clear timer'
);

write('server.js', server);
console.log('[OK] server.js - 1v1 + Raid bot fill');

// ------------------------------------------------------------------
// server/product-modes.js
// ------------------------------------------------------------------
let modes = read('server/product-modes.js');
modes = addImportAfter(
  modes,
  "import { TagTeamEngine } from './tag-team-engine.js';",
  "import { BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, TagTeamBotController } from './bot-ai.js';",
  'product mode bot imports'
);

modes = replaceOnce(
  modes,
  `  const privateDuels = new Map();

  function userInProductMode(uid) {`,
  `  const privateDuels = new Map();
  let teamFillTimer = null;

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

  function userInProductMode(uid) {`,
  'product bot scheduling helpers'
);

// Private duel controller.
modes = replaceOnce(
  modes,
  `      engine: null
    };`,
  `      engine: null,
      botController: null
    };`,
  'private duel bot controller field'
);

modes = replaceOnce(
  modes,
  `      eng => {
        sendPrivateDuelState(code);
        if (eng.state === 'GAME_OVER' && eng.winner && !room.finished) {
          room.finished = true;
          setTimeout(() => privateDuels.delete(code), 15000);
        }
      },`,
  `      eng => {
        sendPrivateDuelState(code);
        room.botController?.poke();
        if (eng.state === 'GAME_OVER' && eng.winner && !room.finished) {
          room.finished = true;
          room.botController?.dispose?.();
          setTimeout(() => privateDuels.delete(code), 15000);
        }
      },`,
  'private duel poke'
);

modes = replaceOnce(
  modes,
  `    if (aSocket) attachPrivateDuel(aSocket, code, 'player', false);
    if (bSocket) attachPrivateDuel(bSocket, code, 'opponent', false);
  }`,
  `    if (b?.isBot) {
      room.botController = new DuelBotController({ engine: room.engine, botKey: 'opponent' });
      room.botController.poke();
    }

    if (aSocket) attachPrivateDuel(aSocket, code, 'player', false);
    if (bSocket) attachPrivateDuel(bSocket, code, 'opponent', false);
  }`,
  'private duel controller create'
);

// Team finalization skips bots and disposes controller.
modes = replaceOnce(
  modes,
  `    room.finalized = true;
    sendTeamState(roomCode);

    for (const slot of Object.values(room.slots)) {
      let user = await User.findOne({ uid: slot.uid });`,
  `    room.finalized = true;
    room.botController?.dispose?.();
    sendTeamState(roomCode);

    for (const slot of Object.values(room.slots)) {
      if (slot.isBot) continue;
      let user = await User.findOne({ uid: slot.uid });`,
  'team finalize bot skip'
);

modes = replaceOnce(
  modes,
  `      slots: {},
      engine: null
    };`,
  `      slots: {},
      engine: null,
      botController: null
    };`,
  'team room controller field'
);

modes = replaceOnce(
  modes,
  `          connected: true,
          reconnectTimer: null`,
  `          connected: true,
          isBot: !!entry.isBot,
          reconnectTimer: null`,
  'team slot bot metadata'
);

modes = replaceOnce(
  modes,
  `      onState: () => sendTeamState(code),`,
  `      onState: () => {
        sendTeamState(code);
        room.botController?.poke();
      },`,
  'team bot poke'
);

modes = replaceOnce(
  modes,
  `    teamRooms.set(code, room);
    for (const entry of members) {`,
  `    room.botController = new TagTeamBotController({ teamEngine: room.engine });
    room.botController.poke();

    teamRooms.set(code, room);
    for (const entry of members) {`,
  'team controller create'
);

// Private lobby clears timer on start.
modes = replaceOnce(
  modes,
  `    if (lobby.members.length < required) return;
    privateLobbies.delete(lobby.code);`,
  `    if (lobby.members.length < required) return;
    clearPrivateBotFill(lobby);
    privateLobbies.delete(lobby.code);`,
  'private clear fill on start'
);

// Team queue removal maintains timer.
modes = replaceOnce(
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
  'team queue timer maintenance'
);

// 2v2 matchmaking scheduling.
modes = replaceOnce(
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
  '2v2 15s bot fill'
);

// Private lobby gets timer metadata and starts it.
modes = replaceOnce(
  modes,
  `        ownerUid: profile.uid,
        members: [{`,
  `        ownerUid: profile.uid,
        fillTimer: null,
        members: [{`,
  'private lobby timer field'
);

modes = replaceOnce(
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
  'private room start fill timer'
);

// Private leave cleans timer when empty.
modes = replaceOnce(
  modes,
  `      if (!lobby.members.length) privateLobbies.delete(code);
      else {`,
  `      if (!lobby.members.length) {
        clearPrivateBotFill(lobby);
        privateLobbies.delete(code);
      } else {`,
  'private leave cleanup'
);

// Disconnect lobby cleanup too (second occurrence with lobby.code).
modes = replaceOnce(
  modes,
  `        if (!lobby.members.length) privateLobbies.delete(lobby.code);
        else {`,
  `        if (!lobby.members.length) {
          clearPrivateBotFill(lobby);
          privateLobbies.delete(lobby.code);
        } else {`,
  'private disconnect cleanup'
);

write('server/product-modes.js', modes);
console.log('[OK] server/product-modes.js - 2v2/private fill');

// ------------------------------------------------------------------
// package.json
// ------------------------------------------------------------------
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:bot-ai'] = 'node scripts/test-release-bot-ai.mjs';

if (!String(pkg.scripts.test || '').includes('test:bot-ai')) {
  pkg.scripts.test = `${pkg.scripts.test || 'npm run test:core'} && npm run test:bot-ai`;
}
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json - test:bot-ai');

console.log('AI FILL & BOT RUNTIME CYCLE APLICADO.');
