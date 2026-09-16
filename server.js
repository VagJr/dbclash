/* ==========================================================================
   Dragon Ball Clash Action TCG — Dedicated Socket.io Backend Server
   Optimized for Render (Free Tier) with MongoDB Atlas & Vercel CORS
   ========================================================================== */

import express from 'express';
import {
  installHttpSecurity,
  socketCorsOptions,
  installSocketPacketGuard,
  validateProductionEnvironment
} from './server/security-middleware.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { GameEngine as ServerGameEngine } from './server/server-engine.js';
import { RaidRoomEngine } from './server/raid-room-engine.js';
import { BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, RaidBotController, isBotUid } from './server/bot-ai.js';
import { registerProductModes } from './server/product-modes.js';
import { applyQuestEventToUser } from './js/daily-quest-rules.js';
import { getStarterDeckForLeader } from './js/card-database.js';
import { User } from './server/user-model.js';
import crypto from 'node:crypto';
import { createSessionToken, requireSession, verifySessionToken } from './server/auth-session.js';
import {
  DEFAULT_UNLOCKED_LEADERS,
  createDefaultInventory,
  migrateLegacyInventory,
  inventoryToOwnedCards,
  validateDeck,
  craftCardState,
  unlockLeaderState,
  openPackState,
  rollPack
} from './js/economy-rules.js';
import { applyRankedResult, RECONNECT_GRACE_MS, levelForXp } from './js/ranked-rules.js';
import {
  RAID_BOSSES,
  RAID_MIN_PLAYERS,
  RAID_MAX_PLAYERS,
  RAID_QUEUE_FILL_MS,
  RAID_RECONNECT_GRACE_MS,
  raidRewardForBoss
} from './js/raid-rules.js';

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dbtcg';
validateProductionEnvironment();

// HTTP security, CORS allowlist and API rate limits
installHttpSecurity(app);
app.use(express.json({ limit: '64kb', strict: true }));

// ── MONGODB ATLAS CONNECTION ──
mongoose.connect(MONGODB_URI)
  .then(() => console.log('🍃 Connected to MongoDB Atlas Database!'))
  .catch(err => {
    if (process.env.NODE_ENV === 'production') {
      console.error('[MongoDB] Production connection failed:', err.message);
      process.exitCode = 1;
      setTimeout(() => process.exit(1), 50);
      return;
    }
    console.warn('[MongoDB] Local connection warning:', err.message);
  });

// Health Check & Anti-Sleep Ping Endpoints
app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'online', timestamp: Date.now(), uptime: process.uptime() });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    server: 'Dragon Ball Clash Backend', 
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    activeConnections: io ? io.engine.clientsCount : 0 
  });
});

// ── REST API ENDPOINTS FOR AUTH & MONGO SYNC ──

// 1. Register User in MongoDB
app.post('/api/auth/register', async (req, res) => {
  try {
    const { displayName, email, password } = req.body || {};
    if (!email || !password || !displayName) {
      return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatorios!' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      const isUsernameAccount = cleanEmail.endsWith('@dbtcg.local');
      return res.status(400).json({
        success: false,
        code: 'ACCOUNT_EXISTS',
        message: isUsernameAccount
          ? 'Este nome de usuario ja esta cadastrado!'
          : 'Este e-mail ja esta cadastrado!'
      });
    }

    const unlockedLeaders = [...DEFAULT_UNLOCKED_LEADERS];
    const cardInventory = createDefaultInventory(unlockedLeaders);
    const uid = 'user_' + crypto.randomUUID();

    const newUser = new User({
      uid,
      displayName: String(displayName).trim().slice(0, 32),
      email: cleanEmail,
      password,
      isGuest: false,
      unlockedLeaders,
      selectedLeader: 'goku',
      customDecks: {},
      cardInventory,
      ownedCards: inventoryToOwnedCards(cardInventory),
      zeni: 500,
      gems: 10,
      dust: 300
    });

    await newUser.save();
    const token = createSessionToken(newUser);
    res.status(201).json({ success: true, token, user: newUser.toPublicJSON() });
  } catch (err) {
    console.error('[MongoDB] Register Error:', err);
    res.status(500).json({ success: false, message: 'Erro ao cadastrar usuario.' });
  }
});

// 2. Login User from MongoDB
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Digite o e-mail e a senha!' });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'E-mail ou senha invalidos.' });
    }

    const migrated = migrateLegacyInventory(user.toObject());
    user.cardInventory = migrated;
    user.ownedCards = inventoryToOwnedCards(migrated);
    if (user.dust === undefined || user.dust === null) user.dust = 300;
    await user.save();

    const token = createSessionToken(user);
    res.status(200).json({ success: true, token, user: user.toPublicJSON() });
  } catch (err) {
    console.error('[MongoDB] Login Error:', err);
    res.status(500).json({ success: false, message: 'Erro ao realizar login.' });
  }
});

async function loadAuthedUser(req, res) {
  const user = await User.findOne({ uid: req.auth.uid });
  if (!user) {
    res.status(404).json({ success: false, message: 'Usuario nao encontrado.' });
    return null;
  }

  const migrated = migrateLegacyInventory(user.toObject());
  user.cardInventory = migrated;
  user.ownedCards = inventoryToOwnedCards(migrated);
  if (user.dust === undefined || user.dust === null) user.dust = 300;
  return user;
}

app.get('/api/user/me', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;
    await user.save();
    res.json({ success: true, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao carregar perfil.' });
  }
});

// Old unrestricted sync is permanently disabled.
app.post('/api/user/sync', (req, res) => {
  res.status(410).json({ success: false, message: 'Endpoint legado removido. Use mutacoes autenticadas.' });
});

app.patch('/api/user/preferences', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    if (typeof req.body?.selectedLeader === 'string') {
      if (!user.unlockedLeaders.includes(req.body.selectedLeader)) {
        return res.status(400).json({ success: false, message: 'Lutador bloqueado.' });
      }
      user.selectedLeader = req.body.selectedLeader;
    }

    // customDecks cannot be bulk-overwritten here. Decks use /api/deck/save.
    await user.save();
    res.json({ success: true, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao salvar preferencias.' });
  }
});

app.post('/api/deck/save', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    const { leaderId, deck } = req.body || {};
    const validation = validateDeck(deck, user.cardInventory, leaderId, user.unlockedLeaders);
    if (!validation.ok) {
      return res.status(400).json({ success: false, code: validation.code, message: validation.message });
    }

    user.customDecks = { ...(user.customDecks || {}), [leaderId]: [...deck] };
    user.markModified('customDecks');
    await user.save();

    res.json({ success: true, deck: [...deck], user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao salvar deck.' });
  }
});

app.post('/api/economy/craft', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    const result = craftCardState(user.toObject(), req.body?.cardId);
    if (!result.ok) {
      return res.status(400).json({ success: false, code: result.code, cost: result.cost });
    }

    user.dust = result.dust;
    user.cardInventory = result.cardInventory;
    user.ownedCards = result.ownedCards;
    user.markModified('cardInventory');
    await user.save();

    res.json({ success: true, cardId: result.cardId, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao criar carta.' });
  }
});

app.post('/api/economy/unlock-leader', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    const result = unlockLeaderState(user.toObject(), req.body?.leaderId);
    if (!result.ok) {
      return res.status(400).json({ success: false, code: result.code, cost: result.cost });
    }

    user.zeni = result.zeni;
    user.unlockedLeaders = result.unlockedLeaders;
    user.cardInventory = result.cardInventory;
    user.ownedCards = result.ownedCards;
    user.markModified('cardInventory');
    await user.save();

    res.json({ success: true, leaderId: req.body.leaderId, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao desbloquear lutador.' });
  }
});

app.post('/api/economy/open-pack', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    const secureRandom = () => crypto.randomInt(0, 0x100000000) / 0x100000000;
    const cards = rollPack(secureRandom);
    const result = openPackState(user.toObject(), cards);

    if (!result.ok) {
      return res.status(400).json({ success: false, code: result.code, cost: result.cost });
    }

    user.zeni = result.zeni;
    user.dust = result.dust;
    user.cardInventory = result.cardInventory;
    user.ownedCards = result.ownedCards;
    user.markModified('cardInventory');
    applyQuestEventToUser(user, 'pack_open');
    await user.save();

    res.json({
      success: true,
      cards,
      results: result.results,
      user: user.toPublicJSON()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao abrir booster.' });
  }
});

// 4. Global Leaderboard Endpoint (Top 20 Ranked)

// 4. Global Leaderboard Endpoint (Top 20 Ranked)
app.get('/api/leaderboard', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({ success: true, leaderboard: [] });
    }
    const topPlayers = await User.find({ isGuest: false })
      .sort({ rankPoints: -1 })
      .limit(100)
      .select('uid displayName rankPoints division victories losses level selectedLeader');

    res.status(200).json({ success: true, leaderboard: topPlayers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar placar de líderes.' });
  }
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: socketCorsOptions(),
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 65536,
  perMessageDeflate: false
});

installSocketPacketGuard(io);

// Server-side State Storage
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
  if (isBotUid(uid)) return null;
  const user = await User.findOne({ uid });
  if (!user) return null;

  const result = applyRankedResult(user.toObject(), isWin);
  user.rankPoints = result.rankPoints;
  user.xp = result.xp;
  user.level = result.level;
  user.division = result.division;
  user.victories = result.victories;
  user.losses = result.losses;
  applyQuestEventToUser(user, 'online_match');
  if (isWin) applyQuestEventToUser(user, 'online_win');
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
  room.botController?.dispose?.();
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
  const roomCode = `room_${Date.now()}_${roomCounter}`;
  const matchId = `ranked_${crypto.randomUUID()}`;
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

  console.log(`[Ranked Bot] ${matchId}: ${human.username} vs ${bot.username}`);
  return true;
}


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
    if (queue.entries.length === 0 && queue.fillTimer) {
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

    if (user && !slot.abandoned) {
      applyQuestEventToUser(user, 'raid_complete');
      await user.save();
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

  if (connected.length < 1) {
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
  const used = new Set(connected.slice(0, RAID_MAX_PLAYERS).map(entry => entry.uid));
  queue.entries = connected.filter(entry => !used.has(entry.uid));

  raidRoomCounter += 1;
  const roomCode = `raid_${Date.now()}_${raidRoomCounter}`;
  const matchId = `raidmatch_${crypto.randomUUID()}`;

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
      isBot: !!entry.isBot,
      abandoned: false,
      reconnectTimer: null
    };
  }

  activeRaidRooms[roomCode] = room;

  room.engine = new RaidRoomEngine({
    bossId,
    players: team,
    onState: () => {
      emitRaidState(roomCode);
      room.botController?.poke();
    },
    onEvent: (type, data) => io.to(roomCode).emit('raid_event', { type, data }),
    onComplete: result => {
      finalizeRaidRoom(roomCode, result).catch(err => {
        console.error('[Raid] Finalize error:', err);
      });
    }
  });

  room.botController = new RaidBotController({ engine: room.engine });
  room.botController.poke();

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

  if (queue.entries.length >= 1 && !queue.fillTimer) {
    queue.fillTimer = setTimeout(() => {
      queue.fillTimer = null;
      startRaidFromQueue(bossId).catch(console.error);
    }, RAID_QUEUE_FILL_MS);
    queue.fillTimer.unref?.();
  }
}

const raidTickInterval = setInterval(() => {
  const now = Date.now();
  for (const room of Object.values(activeRaidRooms)) {
    if (!room.finalized) room.engine.tick(now);
  }
}, 1000);
if (raidTickInterval.unref) raidTickInterval.unref();

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
  console.log(`[Socket] Client connected: ${socket.id}`);

  attemptResume(socket).catch(err => {
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

    let profile;
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
      scheduleRankedBotFill(entry);
      socket.emit('waiting_for_opponent', { botFillMs: BOT_FILL_DELAY_MS });
      return;
    }

    const opponentEntry = matchmakingQueue.splice(opponentIndex, 1)[0];
    clearMatchmakingBotTimer(opponentEntry);
    const opponentSocket = io.sockets.sockets.get(opponentEntry.socketId);

    if (!opponentSocket?.connected) {
      matchmakingQueue.push(entry);
      scheduleRankedBotFill(entry);
      socket.emit('waiting_for_opponent', { botFillMs: BOT_FILL_DELAY_MS });
      return;
    }

    roomCounter += 1;
    const roomCode = `room_${Date.now()}_${roomCounter}`;
    const matchId = `ranked_${crypto.randomUUID()}`;
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

    console.log(`[Ranked] ${matchId}: ${opponentEntry.username} vs ${entry.username}`);
  });

  socket.on('leave_matchmaking', () => {
    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
      if (matchmakingQueue[i].socketId === socket.id || matchmakingQueue[i].uid === socket.authUid) {
        clearMatchmakingBotTimer(matchmakingQueue[i]);
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
      console.error(`[Engine] Action error ${payload.action}:`, err);
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
      if (matchmakingQueue[i].socketId === socket.id) {
        clearMatchmakingBotTimer(matchmakingQueue[i]);
        matchmakingQueue.splice(i, 1);
      }
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

    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

registerProductModes(app, io);

// Self-Ping Tick to Keep Render Awake
setInterval(() => {
  const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL;
  if (externalUrl) {
    fetch(`${externalUrl}/ping`)
      .then(res => res.json())
      .then(data => console.log(`[Keep-Alive] Self HTTP ping successful:`, data.status))
      .catch(err => console.warn(`[Keep-Alive] Self ping warning:`, err.message));
  } else {
    console.log(`[Keep-Alive] Internal Tick - Server active with ${io.engine.clientsCount} clients.`);
  }
}, 240000); // 4 minutes

httpServer.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🔥 Dragon Ball Clash Dedicated Server Running!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🍃 MongoDB Atlas Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting/Fallback'}`);
  console.log(`🌐 CORS: production allowlist enabled`);
  console.log(`=======================================================`);
});
