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
  const bak = `${full}.release-fix-04.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(full, bak);
}
function copySource(sourceName, targetRel) {
  const src = fs.readFileSync(path.join(sourceDir, sourceName), 'utf8');
  if (fs.existsSync(path.join(root, targetRel))) backup(targetRel);
  write(targetRel, src);
  console.log(`[OK] ${targetRel}`);
}
function replaceBetween(src, startMarker, endMarker, replacement) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0) throw new Error(`Bloco nao encontrado: ${startMarker}`);
  return src.slice(0, a) + replacement.trimEnd() + '\n\n' + src.slice(b);
}

for (const rel of [
  'server.js',
  'package.json',
  'js/socket-config.js',
  'js/multiplayer-manager.js',
  'js/leaderboard-manager.js',
  'js/auth-manager.js'
]) backup(rel);

copySource('ranked-rules-source.js', 'js/ranked-rules.js');
copySource('socket-config-source.js', 'js/socket-config.js');
copySource('multiplayer-manager-source.js', 'js/multiplayer-manager.js');
copySource('leaderboard-manager-source.js', 'js/leaderboard-manager.js');
copySource('test-release-multiplayer-source.mjs', 'scripts/test-release-multiplayer.mjs');

// AuthManager emits session changes so SocketManager can re-auth immediately.
let auth = read('js/auth-manager.js');
const saveNeedle = `      if (this.token) localStorage.setItem(this.tokenKey, this.token);
      else localStorage.removeItem(this.tokenKey);
    } catch {}
  }`;

const saveReplacement = `      if (this.token) localStorage.setItem(this.tokenKey, this.token);
      else localStorage.removeItem(this.tokenKey);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dbclash-auth-changed', {
          detail: { token: this.token || null }
        }));
      }
    } catch {}
  }`;

if (!auth.includes(saveNeedle)) {
  throw new Error('AuthManager saveLocalCache nao corresponde ao estado esperado do Fix 03.');
}
auth = auth.replace(saveNeedle, saveReplacement);
write('js/auth-manager.js', auth);
console.log('[OK] js/auth-manager.js');

// Server imports.
let server = read('server.js');

server = server.replace(
  "import { createSessionToken, requireSession } from './server/auth-session.js';",
  "import { createSessionToken, requireSession, verifySessionToken } from './server/auth-session.js';"
);

if (!server.includes("from './js/ranked-rules.js'")) {
  const economyImportEnd = "} from './js/economy-rules.js';";
  const idx = server.indexOf(economyImportEnd);
  if (idx < 0) throw new Error('Import economy-rules nao encontrado no server.js.');
  const pos = idx + economyImportEnd.length;
  server =
    server.slice(0, pos) +
    "\nimport { applyRankedResult, RECONNECT_GRACE_MS } from './js/ranked-rules.js';" +
    server.slice(pos);
}

// Leaderboard grows to Top 100 and includes uid for current-user marking.
server = server.replace(".limit(20)", ".limit(100)");
server = server.replace(
  ".select('displayName rankPoints division victories losses level selectedLeader');",
  ".select('uid displayName rankPoints division victories losses level selectedLeader');"
);

const socketBlock = `// Server-side State Storage
const matchmakingQueue = [];
const activeRooms = {};
let roomCounter = 0;

function findRoomByUid(uid) {
  if (!uid) return null;
  for (const [roomCode, room] of Object.entries(activeRooms)) {
    for (const role of ['player', 'opponent']) {
      if (room.slots?.[role]?.uid === uid) return { roomCode, room, role };
    }
  }
  return null;
}

async function loadRankedProfile(uid, requestedLeader) {
  const user = await User.findOne({ uid });
  if (!user) return { ok: false, code: 'USER_NOT_FOUND', message: 'Conta nao encontrada.' };

  const cardInventory = migrateLegacyInventory(user.toObject());
  user.cardInventory = cardInventory;
  user.ownedCards = inventoryToOwnedCards(cardInventory);

  const leader = typeof requestedLeader === 'string' ? requestedLeader : user.selectedLeader;
  if (!user.unlockedLeaders.includes(leader)) {
    return { ok: false, code: 'LEADER_LOCKED', message: 'Lutador bloqueado nesta conta.' };
  }

  const custom = user.customDecks?.[leader];
  const customValidation = validateDeck(custom, cardInventory, leader, user.unlockedLeaders);

  let deck = customValidation.ok ? [...custom] : getStarterDeckForLeader(leader);
  const starterValidation = validateDeck(deck, cardInventory, leader, user.unlockedLeaders);
  if (!starterValidation.ok) {
    return { ok: false, code: starterValidation.code, message: starterValidation.message };
  }

  await user.save();

  return {
    ok: true,
    user,
    uid: user.uid,
    username: user.displayName,
    leader,
    deck
  };
}

function roomOpponentRole(role) {
  return role === 'player' ? 'opponent' : 'player';
}

function sendRoomState(roomCode) {
  const room = activeRooms[roomCode];
  if (!room) return;

  room.stateVersion += 1;

  for (const role of ['player', 'opponent']) {
    const slot = room.slots[role];
    if (!slot?.socketId || !slot.connected) continue;
    const socket = io.sockets.sockets.get(slot.socketId);
    if (!socket) continue;

    const state = room.engine.getFullSyncState(role);
    state.stateVersion = room.stateVersion;
    state.matchId = room.matchId;
    socket.emit('state_update', state);
  }
}

function sendRoomFx(roomCode, type, data) {
  const room = activeRooms[roomCode];
  if (!room) return;
  for (const role of ['player', 'opponent']) {
    const slot = room.slots[role];
    if (!slot?.socketId || !slot.connected) continue;
    io.to(slot.socketId).emit('game_fx', { type, data });
  }
}

async function updateRankedUser(uid, isWin) {
  const user = await User.findOne({ uid });
  if (!user) return null;

  const result = applyRankedResult(user.toObject(), isWin);
  user.rankPoints = result.rankPoints;
  user.xp = result.xp;
  user.level = result.level;
  user.division = result.division;
  user.victories = result.victories;
  user.losses = result.losses;
  await user.save();
  return user;
}

async function finalizeRankedRoom(roomCode, winnerRole, reason = 'KO') {
  const room = activeRooms[roomCode];
  if (!room || room.finished) return;

  if (!['player', 'opponent'].includes(winnerRole)) {
    room.finished = true;
    for (const role of ['player', 'opponent']) {
      const slot = room.slots[role];
      if (slot?.socketId) {
        io.to(slot.socketId).emit('match_cancelled', {
          matchId: room.matchId,
          message: 'Partida encerrada sem resultado ranked.'
        });
      }
    }
    setTimeout(() => delete activeRooms[roomCode], 5000);
    return;
  }

  room.finished = true;
  room.engine.winner = winnerRole;
  room.engine.state = 'GAME_OVER';

  const loserRole = roomOpponentRole(winnerRole);
  const winnerUser = await updateRankedUser(room.slots[winnerRole].uid, true);
  const loserUser = await updateRankedUser(room.slots[loserRole].uid, false);

  sendRoomState(roomCode);

  const winnerSocketId = room.slots[winnerRole].socketId;
  const loserSocketId = room.slots[loserRole].socketId;

  if (winnerSocketId && winnerUser) {
    io.to(winnerSocketId).emit('ranked_result', {
      matchId: room.matchId,
      result: 'win',
      reason,
      user: winnerUser.toPublicJSON()
    });
  }
  if (loserSocketId && loserUser) {
    io.to(loserSocketId).emit('ranked_result', {
      matchId: room.matchId,
      result: 'loss',
      reason,
      user: loserUser.toPublicJSON()
    });
  }

  setTimeout(() => {
    const current = activeRooms[roomCode];
    if (current?.finished) delete activeRooms[roomCode];
  }, 15000);
}

function clearReconnectTimer(slot) {
  if (slot?.reconnectTimer) {
    clearTimeout(slot.reconnectTimer);
    slot.reconnectTimer = null;
  }
}

function attachSocketToRoom(socket, roomCode, role, resumed = false) {
  const room = activeRooms[roomCode];
  if (!room) return false;

  const slot = room.slots[role];
  if (!slot || slot.uid !== socket.authUid) return false;

  clearReconnectTimer(slot);
  slot.socketId = socket.id;
  slot.connected = true;
  socket.roomCode = roomCode;
  socket.matchRole = role;
  socket.join(roomCode);

  const otherRole = roomOpponentRole(role);
  const other = room.slots[otherRole];
  if (other?.socketId && other.connected) {
    io.to(other.socketId).emit('opponent_reconnected', { matchId: room.matchId });
  }

  const opponent = room.slots[otherRole];
  const state = room.engine.getFullSyncState(role);
  state.stateVersion = room.stateVersion;
  state.matchId = room.matchId;

  socket.emit(resumed ? 'match_resumed' : 'match_found', {
    isHost: role === 'player',
    role,
    roomCode,
    matchId: room.matchId,
    opponent: {
      uid: opponent.uid,
      username: opponent.username,
      leader: opponent.leader
    },
    nextActionSeq: room.lastSeq[role],
    state
  });

  return true;
}

async function attemptResume(socket) {
  if (!socket.authUid) return false;
  const found = findRoomByUid(socket.authUid);
  if (!found || found.room.finished) return false;
  return attachSocketToRoom(socket, found.roomCode, found.role, true);
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next();

    const payload = verifySessionToken(token);
    if (!payload?.uid) return next(new Error('AUTH_INVALID'));

    const user = await User.findOne({ uid: payload.uid })
      .select('uid displayName selectedLeader unlockedLeaders');

    if (!user) return next(new Error('AUTH_INVALID'));

    socket.authUid = user.uid;
    socket.authUser = {
      uid: user.uid,
      displayName: user.displayName,
      selectedLeader: user.selectedLeader,
      unlockedLeaders: user.unlockedLeaders
    };

    next();
  } catch (err) {
    next(new Error('AUTH_INVALID'));
  }
});

io.on('connection', socket => {
  console.log(\`[Socket] Client connected: \${socket.id}\`);

  attemptResume(socket).catch(err => {
    console.warn('[Resume] Failed:', err.message);
  });

  socket.on('join_matchmaking', async payload => {
    if (!socket.authUid) {
      return socket.emit('ranked_error', {
        code: 'AUTH_REQUIRED',
        message: 'Ranked exige conta autenticada.'
      });
    }

    const existingRoom = findRoomByUid(socket.authUid);
    if (existingRoom && !existingRoom.room.finished) {
      attachSocketToRoom(socket, existingRoom.roomCode, existingRoom.role, true);
      return;
    }

    const profile = await loadRankedProfile(socket.authUid, payload?.leader);
    if (!profile.ok) {
      return socket.emit('ranked_error', {
        code: profile.code,
        message: profile.message
      });
    }

    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
      if (matchmakingQueue[i].uid === socket.authUid || matchmakingQueue[i].socketId === socket.id) {
        matchmakingQueue.splice(i, 1);
      }
    }

    const entry = {
      socketId: socket.id,
      uid: profile.uid,
      username: profile.username,
      leader: profile.leader,
      deck: profile.deck
    };

    let opponentIndex = matchmakingQueue.findIndex(item => item.uid !== entry.uid);
    if (opponentIndex < 0) {
      matchmakingQueue.push(entry);
      socket.emit('waiting_for_opponent');
      return;
    }

    const opponentEntry = matchmakingQueue.splice(opponentIndex, 1)[0];
    const opponentSocket = io.sockets.sockets.get(opponentEntry.socketId);

    if (!opponentSocket?.connected) {
      matchmakingQueue.push(entry);
      socket.emit('waiting_for_opponent');
      return;
    }

    roomCounter += 1;
    const roomCode = \`room_\${Date.now()}_\${roomCounter}\`;
    const matchId = \`ranked_\${crypto.randomUUID()}\`;
    const initiative = crypto.randomInt(0, 2) === 0 ? 'player' : 'opponent';

    const engine = new ServerGameEngine(
      eng => {
        sendRoomState(roomCode);
        const room = activeRooms[roomCode];
        if (room && eng.state === 'GAME_OVER' && eng.winner && !room.finished) {
          finalizeRankedRoom(roomCode, eng.winner, 'KO').catch(err => {
            console.error('[Ranked] Finalize error:', err);
          });
        }
      },
      (type, data) => sendRoomFx(roomCode, type, data)
    );

    activeRooms[roomCode] = {
      roomCode,
      matchId,
      engine,
      finished: false,
      stateVersion: 0,
      lastSeq: { player: 0, opponent: 0 },
      slots: {
        player: {
          uid: opponentEntry.uid,
          username: opponentEntry.username,
          leader: opponentEntry.leader,
          socketId: opponentSocket.id,
          connected: true,
          reconnectTimer: null
        },
        opponent: {
          uid: entry.uid,
          username: entry.username,
          leader: entry.leader,
          socketId: socket.id,
          connected: true,
          reconnectTimer: null
        }
      }
    };

    opponentSocket.roomCode = roomCode;
    opponentSocket.matchRole = 'player';
    socket.roomCode = roomCode;
    socket.matchRole = 'opponent';
    opponentSocket.join(roomCode);
    socket.join(roomCode);

    engine.startMatch(
      opponentEntry.leader,
      entry.leader,
      opponentEntry.deck,
      false,
      {
        playerDeck: engine.secureShuffle(opponentEntry.deck),
        opponentDeck: engine.secureShuffle(entry.deck),
        initiative
      }
    );

    attachSocketToRoom(opponentSocket, roomCode, 'player', false);
    attachSocketToRoom(socket, roomCode, 'opponent', false);

    console.log(\`[Ranked] \${matchId}: \${opponentEntry.username} vs \${entry.username}\`);
  });

  socket.on('leave_matchmaking', () => {
    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
      if (matchmakingQueue[i].socketId === socket.id || matchmakingQueue[i].uid === socket.authUid) {
        matchmakingQueue.splice(i, 1);
      }
    }
  });

  socket.on('game_action', payload => {
    const roomCode = socket.roomCode;
    const room = activeRooms[roomCode];
    if (!room || room.finished) return;
    if (payload?.matchId && payload.matchId !== room.matchId) return;

    const role = socket.matchRole;
    const slot = room.slots[role];
    if (!role || !slot || slot.uid !== socket.authUid) return;

    const seq = Math.floor(Number(payload?.seq) || 0);
    if (seq <= room.lastSeq[role]) return;
    room.lastSeq[role] = seq;

    try {
      switch (payload.action) {
        case 'playCard':
          room.engine._playCard(role, payload.data?.cardIndex, payload.data?.cardId);
          break;
        case 'chargeKi':
          room.engine._chargeKi(role);
          break;
        case 'passTurn':
          room.engine._passTurn(role);
          break;
        case 'mashBeamClash':
          room.engine._mashBeamClash(role);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(\`[Engine] Action error \${payload.action}:\`, err);
    }
  });

  socket.on('send_chat', payload => {
    const text = String(payload?.text || '').trim();
    if (!text) return;

    const safeText = text.slice(0, 300);
    const requestedRoom = payload?.roomCode || null;

    if (requestedRoom && socket.roomCode !== requestedRoom) return;

    const msg = {
      user: socket.authUser?.displayName || 'Guerreiro Z',
      text: safeText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      roomCode: requestedRoom
    };

    if (requestedRoom) io.to(requestedRoom).emit('chat_message', msg);
    else io.emit('chat_message', msg);
  });

  socket.on('keep_alive_ping', () => {
    socket.emit('keep_alive_pong', { serverTime: Date.now() });
  });

  socket.on('disconnect', () => {
    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
      if (matchmakingQueue[i].socketId === socket.id) matchmakingQueue.splice(i, 1);
    }

    const roomCode = socket.roomCode;
    const room = activeRooms[roomCode];
    const role = socket.matchRole;

    if (room && role && !room.finished) {
      const slot = room.slots[role];
      if (slot && slot.socketId === socket.id) {
        slot.connected = false;
        slot.socketId = null;

        const otherRole = roomOpponentRole(role);
        const other = room.slots[otherRole];

        if (other?.socketId && other.connected) {
          io.to(other.socketId).emit('opponent_reconnecting', {
            matchId: room.matchId,
            graceMs: RECONNECT_GRACE_MS
          });
        }

        clearReconnectTimer(slot);
        slot.reconnectTimer = setTimeout(() => {
          const current = activeRooms[roomCode];
          if (!current || current.finished) return;

          const currentSlot = current.slots[role];
          const currentOther = current.slots[otherRole];

          if (currentSlot.connected) return;

          if (!currentOther.connected) {
            finalizeRankedRoom(roomCode, null, 'DOUBLE_DISCONNECT').catch(console.error);
            return;
          }

          finalizeRankedRoom(roomCode, otherRole, 'WO').catch(console.error);
        }, RECONNECT_GRACE_MS);
      }
    }

    console.log(\`[Socket] Client disconnected: \${socket.id}\`);
  });
});`;

server = replaceBetween(
  server,
  '// Server-side State Storage',
  '// Self-Ping Tick to Keep Render Awake',
  socketBlock
);

write('server.js', server);
console.log('[OK] server.js');

const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:multiplayer'] = 'node scripts/test-release-multiplayer.mjs';
pkg.scripts.test =
  'npm run test:core && npm run test:content && npm run test:account && npm run test:multiplayer';
pkg.scripts.check = 'npm test';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json');

console.log('PATCH RELEASE FIX 04 APLICADO.');
