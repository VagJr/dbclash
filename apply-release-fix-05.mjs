import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

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
  if (!fs.existsSync(full)) throw new Error(`Arquivo obrigatorio nao encontrado: ${rel}`);
  const bak = `${full}.release-fix-05.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(full, bak);
}
function copySource(sourceName, targetRel) {
  const src = fs.readFileSync(path.join(sourceDir, sourceName), 'utf8');
  if (fs.existsSync(path.join(root, targetRel))) backup(targetRel);
  write(targetRel, src);
  console.log(`[OK] ${targetRel}`);
}

for (const rel of [
  'server.js',
  'package.json',
  'js/raid-engine.js',
  'js/multiplayer-manager.js'
]) backup(rel);

copySource('raid-rules-source.js', 'js/raid-rules.js');
copySource('raid-room-engine-source.js', 'server/raid-room-engine.js');
copySource('raid-engine-client-source.js', 'js/raid-engine.js');
copySource('multiplayer-manager-fix05-source.js', 'js/multiplayer-manager.js');
copySource('test-release-raid-source.mjs', 'scripts/test-release-raid.mjs');

let server = read('server.js');

if (!server.includes("from './server/raid-room-engine.js'")) {
  server = server.replace(
    "import { GameEngine as ServerGameEngine } from './server/server-engine.js';",
    `import { GameEngine as ServerGameEngine } from './server/server-engine.js';\nimport { RaidRoomEngine } from './server/raid-room-engine.js';`
  );
}

const rankedImportOld = "import { applyRankedResult, RECONNECT_GRACE_MS } from './js/ranked-rules.js';";
const rankedImportNew = `import { applyRankedResult, RECONNECT_GRACE_MS, levelForXp } from './js/ranked-rules.js';
import {
  RAID_BOSSES,
  RAID_MIN_PLAYERS,
  RAID_MAX_PLAYERS,
  RAID_QUEUE_FILL_MS,
  RAID_RECONNECT_GRACE_MS,
  raidRewardForBoss
} from './js/raid-rules.js';`;
if (!server.includes(rankedImportOld)) {
  throw new Error('Import ranked-rules do Fix 04 nao encontrado.');
}
server = server.replace(rankedImportOld, rankedImportNew);

const helperMarker = "io.use(async (socket, next) => {";
const helperIndex = server.indexOf(helperMarker);
if (helperIndex < 0) throw new Error('Fix 04 socket auth marker nao encontrado.');

const raidHelpers = `
const raidQueues = new Map();
const activeRaidRooms = {};
let raidRoomCounter = 0;

function getRaidQueue(bossId) {
  const id = RAID_BOSSES[bossId] ? bossId : 'cell_max';
  if (!raidQueues.has(id)) raidQueues.set(id, { entries: [], fillTimer: null });
  return raidQueues.get(id);
}

function removeFromRaidQueuesByUid(uid) {
  if (!uid) return;
  for (const queue of raidQueues.values()) {
    queue.entries = queue.entries.filter(entry => entry.uid !== uid);
    if (queue.entries.length < RAID_MIN_PLAYERS && queue.fillTimer) {
      clearTimeout(queue.fillTimer);
      queue.fillTimer = null;
    }
  }
}

function findRaidRoomByUid(uid) {
  if (!uid) return null;
  for (const [roomCode, room] of Object.entries(activeRaidRooms)) {
    const slot = room.slots[uid];
    if (slot) return { roomCode, room, slot };
  }
  return null;
}

function emitRaidState(roomCode) {
  const room = activeRaidRooms[roomCode];
  if (!room) return;

  for (const slot of Object.values(room.slots)) {
    if (!slot.connected || !slot.socketId) continue;
    const socket = io.sockets.sockets.get(slot.socketId);
    if (!socket) continue;

    const state = room.engine.getStateFor(slot.uid);
    state.roomCode = roomCode;
    state.matchId = room.matchId;
    socket.emit('raid_state', state);
  }
}

async function applyRaidReward(uid, bossId) {
  const user = await User.findOne({ uid });
  if (!user) return null;

  const reward = raidRewardForBoss(bossId);
  user.zeni = Math.max(0, Number(user.zeni) || 0) + reward.zeni;
  user.xp = Math.max(0, Number(user.xp) || 0) + reward.xp;
  user.level = levelForXp(user.xp);
  user.raidTrophies = Math.max(0, Number(user.raidTrophies) || 0) + reward.trophies;
  user.gems = Math.max(0, Number(user.gems) || 0) + reward.gems;
  await user.save();
  return { user, reward };
}

async function finalizeRaidRoom(roomCode, result) {
  const room = activeRaidRooms[roomCode];
  if (!room || room.finalized) return;
  room.finalized = true;

  emitRaidState(roomCode);

  for (const slot of Object.values(room.slots)) {
    let reward = { zeni: 0, xp: 0, trophies: 0, gems: 0 };
    let user = await User.findOne({ uid: slot.uid });

    if (result === 'VICTORY' && !slot.abandoned) {
      const applied = await applyRaidReward(slot.uid, room.bossId);
      if (applied) {
        reward = applied.reward;
        user = applied.user;
      }
    }

    if (slot.socketId && user) {
      const state = room.engine.getStateFor(slot.uid);
      state.roomCode = roomCode;
      state.matchId = room.matchId;

      io.to(slot.socketId).emit('raid_result', {
        result,
        reward,
        state,
        user: user.toPublicJSON()
      });
    }
  }

  setTimeout(() => {
    delete activeRaidRooms[roomCode];
  }, 20000);
}

function clearRaidReconnect(slot) {
  if (slot?.reconnectTimer) {
    clearTimeout(slot.reconnectTimer);
    slot.reconnectTimer = null;
  }
}

function attachSocketToRaid(socket, roomCode, resumed = false) {
  const room = activeRaidRooms[roomCode];
  if (!room || room.finalized) return false;

  const slot = room.slots[socket.authUid];
  if (!slot) return false;

  clearRaidReconnect(slot);
  slot.socketId = socket.id;
  slot.connected = true;
  socket.raidRoomCode = roomCode;
  socket.raidMatchId = room.matchId;
  socket.roomCode = roomCode;
  socket.join(roomCode);

  const state = room.engine.getStateFor(slot.uid);
  state.roomCode = roomCode;
  state.matchId = room.matchId;

  socket.emit(resumed ? 'raid_match_resumed' : 'raid_match_found', {
    roomCode,
    matchId: room.matchId,
    bossId: room.bossId,
    nextActionSeq: room.lastSeq[slot.uid] || 0,
    state
  });

  socket.to(roomCode).emit('raid_teammate_reconnected', {
    uid: slot.uid,
    username: slot.username
  });

  return true;
}

async function attemptRaidResume(socket) {
  if (!socket.authUid) return false;
  const found = findRaidRoomByUid(socket.authUid);
  if (!found) return false;
  return attachSocketToRaid(socket, found.roomCode, true);
}

async function startRaidFromQueue(bossId) {
  const queue = getRaidQueue(bossId);
  if (queue.fillTimer) {
    clearTimeout(queue.fillTimer);
    queue.fillTimer = null;
  }

  const connected = [];
  for (const entry of queue.entries) {
    const socket = io.sockets.sockets.get(entry.socketId);
    if (socket?.connected && socket.authUid === entry.uid) connected.push(entry);
  }

  if (connected.length < RAID_MIN_PLAYERS) {
    queue.entries = connected;
    return false;
  }

  const team = connected.slice(0, RAID_MAX_PLAYERS);
  const used = new Set(team.map(entry => entry.uid));
  queue.entries = connected.filter(entry => !used.has(entry.uid));

  raidRoomCounter += 1;
  const roomCode = \`raid_\${Date.now()}_\${raidRoomCounter}\`;
  const matchId = \`raidmatch_\${crypto.randomUUID()}\`;

  const room = {
    roomCode,
    matchId,
    bossId,
    engine: null,
    finalized: false,
    lastSeq: {},
    slots: {}
  };

  for (const entry of team) {
    room.lastSeq[entry.uid] = 0;
    room.slots[entry.uid] = {
      uid: entry.uid,
      username: entry.username,
      leader: entry.leader,
      socketId: entry.socketId,
      connected: true,
      abandoned: false,
      reconnectTimer: null
    };
  }

  activeRaidRooms[roomCode] = room;

  room.engine = new RaidRoomEngine({
    bossId,
    players: team,
    onState: () => emitRaidState(roomCode),
    onEvent: (type, data) => io.to(roomCode).emit('raid_event', { type, data }),
    onComplete: result => {
      finalizeRaidRoom(roomCode, result).catch(err => {
        console.error('[Raid] Finalize error:', err);
      });
    }
  });

  for (const entry of team) {
    const socket = io.sockets.sockets.get(entry.socketId);
    if (socket) attachSocketToRaid(socket, roomCode, false);
  }

  return true;
}

function scheduleRaidQueueStart(bossId) {
  const queue = getRaidQueue(bossId);
  if (queue.entries.length >= RAID_MAX_PLAYERS) {
    startRaidFromQueue(bossId).catch(console.error);
    return;
  }

  if (queue.entries.length >= RAID_MIN_PLAYERS && !queue.fillTimer) {
    queue.fillTimer = setTimeout(() => {
      queue.fillTimer = null;
      startRaidFromQueue(bossId).catch(console.error);
    }, RAID_QUEUE_FILL_MS);
  }
}

const raidTickInterval = setInterval(() => {
  const now = Date.now();
  for (const room of Object.values(activeRaidRooms)) {
    if (!room.finalized) room.engine.tick(now);
  }
}, 1000);
if (raidTickInterval.unref) raidTickInterval.unref();

`;

server = server.slice(0, helperIndex) + raidHelpers + server.slice(helperIndex);

const connectionMarker = `  attemptResume(socket).catch(err => {
    console.warn('[Resume] Failed:', err.message);
  });

`;
const connectionInsert = `  attemptResume(socket).catch(err => {
    console.warn('[Resume] Failed:', err.message);
  });
  attemptRaidResume(socket).catch(err => {
    console.warn('[Raid Resume] Failed:', err.message);
  });

  socket.on('join_raid_queue', async payload => {
    if (!socket.authUid) {
      return socket.emit('raid_error', {
        code: 'AUTH_REQUIRED',
        message: 'Raid exige conta autenticada.'
      });
    }

    if (findRoomByUid(socket.authUid)) {
      return socket.emit('raid_error', {
        code: 'IN_RANKED',
        message: 'Saia da partida ranked antes de entrar em Raid.'
      });
    }

    const existingRaid = findRaidRoomByUid(socket.authUid);
    if (existingRaid) {
      attachSocketToRaid(socket, existingRaid.roomCode, true);
      return;
    }

    const bossId = RAID_BOSSES[payload?.bossId] ? payload.bossId : 'cell_max';
    const profile = await loadRankedProfile(socket.authUid, payload?.leader);

    if (!profile.ok) {
      return socket.emit('raid_error', {
        code: profile.code,
        message: profile.message
      });
    }

    removeFromRaidQueuesByUid(socket.authUid);
    const queue = getRaidQueue(bossId);
    queue.entries.push({
      socketId: socket.id,
      uid: profile.uid,
      username: profile.username,
      leader: profile.leader,
      deck: profile.deck
    });

    for (const entry of queue.entries) {
      const target = io.sockets.sockets.get(entry.socketId);
      if (target?.connected) {
        target.emit('raid_queue_status', {
          bossId,
          count: queue.entries.length,
          minPlayers: RAID_MIN_PLAYERS,
          maxPlayers: RAID_MAX_PLAYERS
        });
      }
    }

    scheduleRaidQueueStart(bossId);
  });

  socket.on('leave_raid_queue', () => {
    if (socket.authUid) removeFromRaidQueuesByUid(socket.authUid);
  });

  socket.on('raid_action', payload => {
    const roomCode = socket.raidRoomCode;
    const room = activeRaidRooms[roomCode];
    if (!room || room.finalized) return;
    if (payload?.matchId !== room.matchId) return;

    const slot = room.slots[socket.authUid];
    if (!slot || slot.socketId !== socket.id || !slot.connected) return;

    const seq = Math.floor(Number(payload?.seq) || 0);
    if (seq <= (room.lastSeq[slot.uid] || 0)) return;
    room.lastSeq[slot.uid] = seq;

    switch (payload.action) {
      case 'playCard':
        room.engine.playCard(slot.uid, payload.data?.cardIndex, payload.data?.cardId);
        break;
      case 'chargeKi':
        room.engine.chargeKi(slot.uid);
        break;
      case 'passTurn':
        room.engine.passTurn(slot.uid);
        break;
      default:
        break;
    }
  });

  socket.on('leave_raid', payload => {
    const roomCode = socket.raidRoomCode;
    const room = activeRaidRooms[roomCode];
    if (!room || payload?.matchId !== room.matchId) return;

    const slot = room.slots[socket.authUid];
    if (!slot) return;

    slot.abandoned = true;
    slot.connected = false;
    slot.socketId = null;
    room.engine.abandonPlayer(slot.uid);

    socket.leave(roomCode);
    socket.raidRoomCode = null;
    socket.raidMatchId = null;
    if (socket.roomCode === roomCode) socket.roomCode = null;
  });

`;
if (!server.includes(connectionMarker)) {
  throw new Error('Fix 04 connection marker nao encontrado.');
}
server = server.replace(connectionMarker, connectionInsert);

const disconnectMarker = `  socket.on('disconnect', () => {
    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
`;
const disconnectInsert = `  socket.on('disconnect', () => {
    removeFromRaidQueuesByUid(socket.authUid);

    const raidRoomCode = socket.raidRoomCode;
    const raidRoom = activeRaidRooms[raidRoomCode];
    if (raidRoom && !raidRoom.finalized && socket.authUid) {
      const raidSlot = raidRoom.slots[socket.authUid];
      if (raidSlot && raidSlot.socketId === socket.id && !raidSlot.abandoned) {
        raidSlot.connected = false;
        raidSlot.socketId = null;

        socket.to(raidRoomCode).emit('raid_teammate_disconnected', {
          uid: raidSlot.uid,
          username: raidSlot.username,
          graceMs: RAID_RECONNECT_GRACE_MS
        });

        clearRaidReconnect(raidSlot);
        raidSlot.reconnectTimer = setTimeout(() => {
          const current = activeRaidRooms[raidRoomCode];
          const currentSlot = current?.slots?.[raidSlot.uid];
          if (!current || current.finalized || !currentSlot || currentSlot.connected) return;

          currentSlot.abandoned = true;
          current.engine.abandonPlayer(currentSlot.uid);
        }, RAID_RECONNECT_GRACE_MS);
      }
    }

    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
`;
if (!server.includes(disconnectMarker)) {
  throw new Error('Fix 04 disconnect marker nao encontrado.');
}
server = server.replace(disconnectMarker, disconnectInsert);

write('server.js', server);
console.log('[OK] server.js');

const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:raid'] = 'node scripts/test-release-raid.mjs';
pkg.scripts.test =
  'npm run test:core && npm run test:content && npm run test:account && npm run test:multiplayer && npm run test:raid';
pkg.scripts.check = 'npm test';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json');

console.log('PATCH RELEASE FIX 05 APLICADO.');
