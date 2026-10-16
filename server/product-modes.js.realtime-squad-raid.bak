import crypto from 'node:crypto';
import { User } from './user-model.js';
import { Dojo } from './dojo-model.js';
import { GameEngine as ServerGameEngine } from './server-engine.js';
import { TagTeamEngine } from './tag-team-engine.js';
import { BOT_FILL_DELAY_MS, createBotProfile, DuelBotController, TagTeamBotController, isBotUid } from './bot-ai.js';
import { requireSession } from './auth-session.js';
import { getStarterDeckForLeader } from '../js/card-database.js';
import { migrateLegacyInventory, validateDeck, inventoryToOwnedCards } from '../js/economy-rules.js';
import { applyRankedResult, RECONNECT_GRACE_MS } from '../js/ranked-rules.js';
import {
  ensureDailyQuestState,
  questView,
  claimDailyQuestState,
  applyQuestEventToUser
} from '../js/daily-quest-rules.js';

const TEAM_SIZE = 2;
const TEAM_MATCH_SIZE = 4;
const DOJO_MAX_MEMBERS = 30;

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(0, alphabet.length)];
  return code;
}

async function loadProfile(uid, requestedLeader) {
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
  const deck = customValidation.ok ? [...custom] : getStarterDeckForLeader(leader);
  const validation = validateDeck(deck, cardInventory, leader, user.unlockedLeaders);
  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
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

async function updateRankedTeamUser(uid, isWin) {
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

async function refreshDojoPower(dojo) {
  if (!dojo) return null;
  const users = await User.find({ uid: { $in: dojo.members || [] } }).select('rankPoints');
  dojo.power = users.reduce((sum, user) => sum + Math.max(0, Number(user.rankPoints) || 0), 0);
  await dojo.save();
  return dojo;
}

function dojoJSON(dojo, rank = null) {
  return {
    id: String(dojo._id),
    name: dojo.name,
    tag: dojo.tag,
    ownerUid: dojo.ownerUid,
    membersCount: dojo.members.length,
    maxMembers: DOJO_MAX_MEMBERS,
    power: dojo.power,
    victories: dojo.victories,
    losses: dojo.losses,
    rank
  };
}

export function registerProductModes(app, io) {
  // ------------------------------------------------------------------
  // Daily quests
  // ------------------------------------------------------------------
  app.get('/api/quests/daily', requireSession, async (req, res) => {
    try {
      const user = await User.findOne({ uid: req.auth.uid });
      if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado.' });

      user.dailyQuests = ensureDailyQuestState(user.dailyQuests);
      user.markModified('dailyQuests');
      await user.save();

      res.json({ success: true, date: user.dailyQuests.date, quests: questView(user.dailyQuests) });
    } catch (err) {
      console.error('[Quests] daily:', err);
      res.status(500).json({ success: false, message: 'Erro ao carregar missoes.' });
    }
  });

  app.post('/api/quests/claim', requireSession, async (req, res) => {
    try {
      const user = await User.findOne({ uid: req.auth.uid });
      if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado.' });

      const result = claimDailyQuestState(user.toObject(), user.dailyQuests, req.body?.questId);
      if (!result.ok) {
        return res.status(400).json({ success: false, code: result.code, message: 'Missao ainda nao pode ser resgatada.' });
      }

      user.dailyQuests = result.state;
      user.zeni = result.zeni;
      user.dust = result.dust;
      user.gems = result.gems;
      user.markModified('dailyQuests');
      await user.save();

      res.json({ success: true, reward: result.reward, user: user.toPublicJSON(), quests: questView(user.dailyQuests) });
    } catch (err) {
      console.error('[Quests] claim:', err);
      res.status(500).json({ success: false, message: 'Erro ao resgatar missao.' });
    }
  });

  // ------------------------------------------------------------------
  // Persistent Dojos
  // ------------------------------------------------------------------
  app.get('/api/dojos', requireSession, async (_req, res) => {
    try {
      const dojos = await Dojo.find({}).limit(50);
      for (const dojo of dojos) await refreshDojoPower(dojo);
      dojos.sort((a, b) => b.power - a.power || a.createdAt - b.createdAt);
      res.json({ success: true, dojos: dojos.map((dojo, index) => dojoJSON(dojo, index + 1)) });
    } catch (err) {
      console.error('[Dojo] list:', err);
      res.status(500).json({ success: false, message: 'Erro ao carregar Dojos.' });
    }
  });

  app.get('/api/dojos/mine', requireSession, async (req, res) => {
    try {
      const user = await User.findOne({ uid: req.auth.uid });
      if (!user?.dojoId) return res.json({ success: true, dojo: null });
      const dojo = await Dojo.findById(user.dojoId);
      if (!dojo) {
        user.dojoId = null;
        await user.save();
        return res.json({ success: true, dojo: null });
      }
      await refreshDojoPower(dojo);
      res.json({ success: true, dojo: dojoJSON(dojo) });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro ao carregar seu Dojo.' });
    }
  });

  app.post('/api/dojos/create', requireSession, async (req, res) => {
    try {
      const user = await User.findOne({ uid: req.auth.uid });
      if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado.' });
      if (user.dojoId) return res.status(400).json({ success: false, message: 'Voce ja participa de um Dojo.' });

      const name = String(req.body?.name || '').trim().slice(0, 24);
      const tag = String(req.body?.tag || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (name.length < 3 || tag.length < 2) {
        return res.status(400).json({ success: false, message: 'Nome ou TAG invalido.' });
      }

      const dojo = new Dojo({ name, tag, ownerUid: user.uid, members: [user.uid] });
      await dojo.save();
      user.dojoId = String(dojo._id);
      await user.save();
      await refreshDojoPower(dojo);

      res.status(201).json({ success: true, dojo: dojoJSON(dojo), user: user.toPublicJSON() });
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ success: false, message: 'Nome ou TAG ja esta em uso.' });
      console.error('[Dojo] create:', err);
      res.status(500).json({ success: false, message: 'Erro ao criar Dojo.' });
    }
  });

  app.post('/api/dojos/join', requireSession, async (req, res) => {
    try {
      const user = await User.findOne({ uid: req.auth.uid });
      if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado.' });
      if (user.dojoId) return res.status(400).json({ success: false, message: 'Saia do seu Dojo atual primeiro.' });

      const dojo = await Dojo.findById(req.body?.dojoId);
      if (!dojo) return res.status(404).json({ success: false, message: 'Dojo nao encontrado.' });
      if (dojo.members.length >= DOJO_MAX_MEMBERS) return res.status(400).json({ success: false, message: 'Dojo lotado.' });
      if (!dojo.members.includes(user.uid)) dojo.members.push(user.uid);
      user.dojoId = String(dojo._id);
      await user.save();
      await refreshDojoPower(dojo);
      res.json({ success: true, dojo: dojoJSON(dojo), user: user.toPublicJSON() });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro ao entrar no Dojo.' });
    }
  });

  app.post('/api/dojos/leave', requireSession, async (req, res) => {
    try {
      const user = await User.findOne({ uid: req.auth.uid });
      if (!user?.dojoId) return res.json({ success: true, dojo: null });
      const dojo = await Dojo.findById(user.dojoId);

      user.dojoId = null;
      await user.save();

      if (!dojo) return res.json({ success: true, dojo: null, user: user.toPublicJSON() });
      dojo.members = dojo.members.filter(uid => uid !== user.uid);

      if (dojo.members.length === 0) {
        await Dojo.deleteOne({ _id: dojo._id });
      } else {
        if (dojo.ownerUid === user.uid) dojo.ownerUid = dojo.members[0];
        await refreshDojoPower(dojo);
      }

      res.json({ success: true, dojo: null, user: user.toPublicJSON() });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Erro ao sair do Dojo.' });
    }
  });

  // ------------------------------------------------------------------
  // Product mode state: ranked 2v2 + private 1v1/2v2
  // ------------------------------------------------------------------
  const teamQueue = [];
  const teamRooms = new Map();
  const privateLobbies = new Map();
  const privateDuels = new Map();
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

  function userInProductMode(uid) {
    if (!uid) return false;
    for (const room of teamRooms.values()) if (room.slots[uid]) return true;
    for (const room of privateDuels.values()) {
      if (room.slots.player.uid === uid || room.slots.opponent.uid === uid) return true;
    }
    for (const lobby of privateLobbies.values()) if (lobby.members.some(member => member.uid === uid)) return true;
    return teamQueue.some(entry => entry.uid === uid);
  }

  function clearTimer(slot) {
    if (slot?.reconnectTimer) {
      clearTimeout(slot.reconnectTimer);
      slot.reconnectTimer = null;
    }
  }

  // ---- Private 1v1 ---------------------------------------------------
  function sendPrivateDuelState(code) {
    const room = privateDuels.get(code);
    if (!room) return;
    room.stateVersion += 1;
    for (const role of ['player', 'opponent']) {
      const slot = room.slots[role];
      if (!slot.connected || !slot.socketId) continue;
      const state = room.engine.getFullSyncState(role);
      state.stateVersion = room.stateVersion;
      state.matchId = room.matchId;
      state.private = true;
      io.to(slot.socketId).emit('state_update', state);
    }
  }

  function attachPrivateDuel(socket, code, role, resumed = false) {
    const room = privateDuels.get(code);
    if (!room || room.finished) return false;
    const slot = room.slots[role];
    if (!slot || slot.uid !== socket.authUid) return false;

    clearTimer(slot);
    slot.socketId = socket.id;
    slot.connected = true;
    socket.privateDuelCode = code;
    socket.privateDuelRole = role;
    socket.roomCode = code;
    socket.join(code);

    const otherRole = role === 'player' ? 'opponent' : 'player';
    const state = room.engine.getFullSyncState(role);
    state.stateVersion = room.stateVersion;
    state.matchId = room.matchId;
    state.private = true;

    socket.emit(resumed ? 'match_resumed' : 'match_found', {
      role,
      isHost: role === 'player',
      roomCode: code,
      matchId: room.matchId,
      private: true,
      opponent: {
        uid: room.slots[otherRole].uid,
        username: room.slots[otherRole].username,
        leader: room.slots[otherRole].leader
      },
      nextActionSeq: room.lastSeq[role],
      state
    });
    return true;
  }

  function startPrivateDuel(lobby) {
    const [a, b] = lobby.members;
    const code = lobby.code;
    const room = {
      code,
      matchId: `private1v1_${crypto.randomUUID()}`,
      stateVersion: 0,
      finished: false,
      lastSeq: { player: 0, opponent: 0 },
      slots: {
        player: { ...a, connected: true, reconnectTimer: null },
        opponent: { ...b, connected: true, reconnectTimer: null }
      },
      engine: null
    };

    room.engine = new ServerGameEngine(
      eng => {
        sendPrivateDuelState(code);
        room.botController?.poke();
        if (eng.state === 'GAME_OVER' && eng.winner && !room.finished) {
          room.finished = true;
          setTimeout(() => privateDuels.delete(code), 15000);
        }
      },
      (type, data) => io.to(code).emit('game_fx', { type, data })
    );

    privateDuels.set(code, room);
    const aSocket = io.sockets.sockets.get(a.socketId);
    const bSocket = io.sockets.sockets.get(b.socketId);
    aSocket?.join(code);
    bSocket?.join(code);

    room.engine.startMatch(a.leader, b.leader, a.deck, false, {
      playerDeck: room.engine.secureShuffle(a.deck),
      opponentDeck: room.engine.secureShuffle(b.deck),
      initiative: crypto.randomInt(0, 2) === 0 ? 'player' : 'opponent'
    });

    if (b?.isBot) {
      room.botController = new DuelBotController({ engine: room.engine, botKey: 'opponent' });
      room.botController.poke();
    }

    if (aSocket) attachPrivateDuel(aSocket, code, 'player', false);
    if (bSocket) attachPrivateDuel(bSocket, code, 'opponent', false);
  }

  // ---- Tag Team 2v2 --------------------------------------------------
  function sendTeamState(roomCode) {
    const room = teamRooms.get(roomCode);
    if (!room) return;
    for (const slot of Object.values(room.slots)) {
      if (!slot.connected || !slot.socketId) continue;
      const state = room.engine.getStateFor(slot.uid);
      if (!state) continue;
      state.roomCode = roomCode;
      state.matchId = room.matchId;
      state.ranked = room.ranked;
      io.to(slot.socketId).emit('team_state', state);
    }
  }

  async function finalizeTeamRoom(roomCode, winnerSide) {
    const room = teamRooms.get(roomCode);
    if (!room || room.finalized) return;
    room.finalized = true;
    sendTeamState(roomCode);

    for (const slot of Object.values(room.slots)) {
      let user = await User.findOne({ uid: slot.uid });
      const won = slot.side === winnerSide;
      if (room.ranked) user = await updateRankedTeamUser(slot.uid, won);
      if (slot.socketId && user) {
        io.to(slot.socketId).emit('team_result', {
          result: won ? 'win' : 'loss',
          ranked: room.ranked,
          winnerSide,
          user: user.toPublicJSON(),
          state: room.engine.getStateFor(slot.uid)
        });
      }
    }

    setTimeout(() => teamRooms.delete(roomCode), 20000);
  }

  function attachTeamSocket(socket, roomCode, resumed = false) {
    const room = teamRooms.get(roomCode);
    if (!room || room.finalized) return false;
    const slot = room.slots[socket.authUid];
    if (!slot) return false;

    clearTimer(slot);
    slot.socketId = socket.id;
    slot.connected = true;
    socket.teamRoomCode = roomCode;
    socket.teamSide = slot.side;
    socket.roomCode = roomCode;
    socket.join(roomCode);

    socket.emit(resumed ? 'team_match_resumed' : 'team_match_found', {
      roomCode,
      matchId: room.matchId,
      ranked: room.ranked,
      teamSide: slot.side,
      nextActionSeq: room.lastSeq[slot.uid] || 0,
      state: room.engine.getStateFor(slot.uid)
    });

    socket.to(roomCode).emit('team_teammate_reconnected', { uid: slot.uid, username: slot.username });
    return true;
  }

  function startTeamRoom(entries, { ranked = true, roomCode = null } = {}) {
    const members = [...entries];
    if (members.length !== TEAM_MATCH_SIZE) throw new Error('2v2 requires four players.');

    const code = roomCode || `team_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const matchId = `${ranked ? 'ranked2v2' : 'private2v2'}_${crypto.randomUUID()}`;
    const teamA = members.slice(0, TEAM_SIZE);
    const teamB = members.slice(TEAM_SIZE, TEAM_MATCH_SIZE);

    const room = {
      roomCode: code,
      matchId,
      ranked,
      finalized: false,
      lastSeq: {},
      slots: {},
      engine: null
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

    room.engine = new TagTeamEngine({
      teamA,
      teamB,
      onState: () => {
        sendTeamState(code);
        room.botController?.poke();
      },
      onFx: (type, data) => io.to(code).emit('game_fx', { type, data }),
      onComplete: winnerSide => finalizeTeamRoom(code, winnerSide).catch(console.error)
    });

    room.botController = new TagTeamBotController({ teamEngine: room.engine });
    room.botController.poke();

    teamRooms.set(code, room);
    for (const entry of members) {
      const socket = io.sockets.sockets.get(entry.socketId);
      if (socket) attachTeamSocket(socket, code, false);
    }
    return room;
  }

  function emitPrivateLobbyStatus(lobby) {
    const required = lobby.mode === '2v2' ? 4 : 2;
    for (const member of lobby.members) {
      const socket = io.sockets.sockets.get(member.socketId);
      if (socket?.connected) {
        socket.emit('private_room_status', {
          code: lobby.code,
          mode: lobby.mode,
          count: lobby.members.length,
          required,
          ownerUid: lobby.ownerUid
        });
      }
    }
  }

  async function maybeStartPrivateLobby(lobby) {
    const required = lobby.mode === '2v2' ? 4 : 2;
    if (lobby.members.length < required) return;
    clearPrivateBotFill(lobby);
    privateLobbies.delete(lobby.code);
    if (lobby.mode === '2v2') startTeamRoom(lobby.members, { ranked: false, roomCode: lobby.code });
    else startPrivateDuel(lobby);
  }

  function removeFromTeamQueue(uid) {
    for (let i = teamQueue.length - 1; i >= 0; i--) {
      if (teamQueue[i].uid === uid) teamQueue.splice(i, 1);
    }
    if (!teamQueue.length) clearTeamFillTimer();
    else scheduleTeamBotFill();
  }

  async function attemptProductResume(socket) {
    if (!socket.authUid) return false;
    for (const [code, room] of teamRooms.entries()) {
      if (room.slots[socket.authUid] && !room.finalized) return attachTeamSocket(socket, code, true);
    }
    for (const [code, room] of privateDuels.entries()) {
      for (const role of ['player', 'opponent']) {
        if (room.slots[role].uid === socket.authUid && !room.finished) return attachPrivateDuel(socket, code, role, true);
      }
    }
    return false;
  }

  io.on('connection', socket => {
    attemptProductResume(socket).catch(console.error);

    socket.on('join_2v2_matchmaking', async payload => {
      if (!socket.authUid) return socket.emit('team_error', { message: '2v2 ranked exige conta autenticada.' });
      if (socket.roomCode || socket.raidRoomCode || userInProductMode(socket.authUid)) {
        return socket.emit('team_error', { message: 'Voce ja esta em outra fila ou partida.' });
      }

      const profile = await loadProfile(socket.authUid, payload?.leader);
      if (!profile.ok) return socket.emit('team_error', { code: profile.code, message: profile.message });

      removeFromTeamQueue(socket.authUid);
      teamQueue.push({
        socketId: socket.id,
        uid: profile.uid,
        username: profile.username,
        leader: profile.leader,
        deck: profile.deck
      });

      for (const entry of teamQueue) {
        io.to(entry.socketId).emit('team_queue_status', { count: teamQueue.length, required: TEAM_MATCH_SIZE });
      }

      if (teamQueue.length >= TEAM_MATCH_SIZE) {
        clearTeamFillTimer();
        const team = teamQueue.splice(0, TEAM_MATCH_SIZE);
        startTeamRoom(team, { ranked: true });
        if (teamQueue.length) scheduleTeamBotFill();
      } else {
        scheduleTeamBotFill();
      }
    });

    socket.on('leave_2v2_matchmaking', () => removeFromTeamQueue(socket.authUid));

    socket.on('team_action', payload => {
      const room = teamRooms.get(socket.teamRoomCode);
      if (!room || room.finalized || payload?.matchId !== room.matchId) return;
      const slot = room.slots[socket.authUid];
      if (!slot || !slot.connected || slot.socketId !== socket.id) return;

      const seq = Math.floor(Number(payload?.seq) || 0);
      if (seq <= (room.lastSeq[slot.uid] || 0)) return;
      room.lastSeq[slot.uid] = seq;
      room.engine.action(slot.uid, payload.action, payload.data || {});
    });

    socket.on('create_private_room', async payload => {
      if (!socket.authUid) return socket.emit('private_room_error', { message: 'Conta autenticada obrigatoria.' });
      if (socket.roomCode || socket.raidRoomCode || userInProductMode(socket.authUid)) {
        return socket.emit('private_room_error', { message: 'Saia da fila ou partida atual primeiro.' });
      }

      const mode = payload?.mode === '2v2' ? '2v2' : '1v1';
      const profile = await loadProfile(socket.authUid, payload?.leader);
      if (!profile.ok) return socket.emit('private_room_error', { message: profile.message });

      let code = randomCode();
      while (privateLobbies.has(code) || privateDuels.has(code) || teamRooms.has(code)) code = randomCode();

      const lobby = {
        code,
        mode,
        ownerUid: profile.uid,
        fillTimer: null,
        members: [{
          socketId: socket.id,
          uid: profile.uid,
          username: profile.username,
          leader: profile.leader,
          deck: profile.deck
        }]
      };
      privateLobbies.set(code, lobby);
      schedulePrivateBotFill(lobby);
      socket.privateLobbyCode = code;
      socket.emit('private_room_created', {
        code,
        mode,
        count: 1,
        required: mode === '2v2' ? 4 : 2,
        botFillMs: BOT_FILL_DELAY_MS
      });
    });

    socket.on('join_private_room', async payload => {
      if (!socket.authUid) return socket.emit('private_room_error', { message: 'Conta autenticada obrigatoria.' });
      const code = String(payload?.code || '').trim().toUpperCase();
      const lobby = privateLobbies.get(code);
      if (!lobby) return socket.emit('private_room_error', { message: 'Sala privada nao encontrada.' });
      if (socket.roomCode || socket.raidRoomCode || userInProductMode(socket.authUid)) {
        return socket.emit('private_room_error', { message: 'Voce ja esta em outra fila ou partida.' });
      }

      const required = lobby.mode === '2v2' ? 4 : 2;
      if (lobby.members.length >= required) return socket.emit('private_room_error', { message: 'Sala lotada.' });

      const profile = await loadProfile(socket.authUid, payload?.leader);
      if (!profile.ok) return socket.emit('private_room_error', { message: profile.message });
      if (lobby.members.some(member => member.uid === profile.uid)) return;

      lobby.members.push({
        socketId: socket.id,
        uid: profile.uid,
        username: profile.username,
        leader: profile.leader,
        deck: profile.deck
      });
      socket.privateLobbyCode = code;
      emitPrivateLobbyStatus(lobby);
      await maybeStartPrivateLobby(lobby);
    });

    socket.on('leave_private_room', () => {
      const code = socket.privateLobbyCode;
      const lobby = privateLobbies.get(code);
      if (!lobby) return;
      lobby.members = lobby.members.filter(member => member.uid !== socket.authUid);
      socket.privateLobbyCode = null;
      if (!lobby.members.length) {
        clearPrivateBotFill(lobby);
        privateLobbies.delete(code);
      }
      else {
        if (lobby.ownerUid === socket.authUid) lobby.ownerUid = lobby.members[0].uid;
        emitPrivateLobbyStatus(lobby);
      }
    });

    // Private 1v1 commands share the public game_action event name, but are
    // routed only when privateDuelCode is present.
    socket.on('game_action', payload => {
      const room = privateDuels.get(socket.privateDuelCode);
      if (!room || room.finished || payload?.matchId !== room.matchId) return;
      const role = socket.privateDuelRole;
      const slot = room.slots[role];
      if (!role || !slot || slot.uid !== socket.authUid) return;
      const seq = Math.floor(Number(payload?.seq) || 0);
      if (seq <= room.lastSeq[role]) return;
      room.lastSeq[role] = seq;

      switch (payload.action) {
        case 'playCard': room.engine._playCard(role, payload.data?.cardIndex, payload.data?.cardId); break;
        case 'chargeKi': room.engine._chargeKi(role); break;
        case 'passTurn': room.engine._passTurn(role); break;
        case 'mashBeamClash': room.engine._mashBeamClash(role); break;
        default: break;
      }
    });

    socket.on('disconnect', () => {
      removeFromTeamQueue(socket.authUid);

      const lobby = privateLobbies.get(socket.privateLobbyCode);
      if (lobby) {
        lobby.members = lobby.members.filter(member => member.uid !== socket.authUid);
        if (!lobby.members.length) {
          clearPrivateBotFill(lobby);
          privateLobbies.delete(lobby.code);
        }
        else {
          if (lobby.ownerUid === socket.authUid) lobby.ownerUid = lobby.members[0].uid;
          emitPrivateLobbyStatus(lobby);
        }
      }

      const teamRoom = teamRooms.get(socket.teamRoomCode);
      if (teamRoom && !teamRoom.finalized) {
        const slot = teamRoom.slots[socket.authUid];
        if (slot && slot.socketId === socket.id) {
          slot.connected = false;
          slot.socketId = null;
          socket.to(socket.teamRoomCode).emit('team_teammate_disconnected', {
            uid: slot.uid,
            username: slot.username,
            graceMs: RECONNECT_GRACE_MS
          });
          clearTimer(slot);
          slot.reconnectTimer = setTimeout(() => {
            const current = teamRooms.get(socket.teamRoomCode);
            const currentSlot = current?.slots?.[slot.uid];
            if (!current || current.finalized || currentSlot?.connected) return;
            current.engine.abandon(slot.uid);
          }, RECONNECT_GRACE_MS);
        }
      }

      const duel = privateDuels.get(socket.privateDuelCode);
      const role = socket.privateDuelRole;
      if (duel && !duel.finished && role) {
        const slot = duel.slots[role];
        if (slot && slot.socketId === socket.id) {
          slot.connected = false;
          slot.socketId = null;
          clearTimer(slot);
          slot.reconnectTimer = setTimeout(() => {
            const current = privateDuels.get(socket.privateDuelCode);
            if (!current || current.finished || current.slots[role].connected) return;
            const otherRole = role === 'player' ? 'opponent' : 'player';
            if (!current.slots[otherRole].connected) {
              current.finished = true;
              privateDuels.delete(socket.privateDuelCode);
              return;
            }
            current.engine.state = 'GAME_OVER';
            current.engine.winner = otherRole;
            current.finished = true;
            sendPrivateDuelState(socket.privateDuelCode);
            setTimeout(() => privateDuels.delete(socket.privateDuelCode), 10000);
          }, RECONNECT_GRACE_MS);
        }
      }
    });
  });
}
