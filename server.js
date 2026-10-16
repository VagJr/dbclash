/* ==========================================================================
   Dragon Ball Clash Action TCG — Dedicated Socket.io Backend Server
   Optimized for Render (Free Tier) with MongoDB Atlas & Vercel CORS
   ========================================================================== */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import { GameEngine as ServerGameEngine } from './server/server-engine.js';
import { User } from './server/user-model.js';

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || '';

// Enable CORS for Vercel frontend & Localhost testing
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

// ── MONGODB ATLAS CONNECTION ──
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('🍃 SUCCESS: Connected to MongoDB Atlas Database!'))
    .catch(err => console.warn('⚠️ MongoDB Atlas Connection Error:', err.message));
} else {
  console.warn('⚠️ Warning: MONGODB_URI environment variable is not defined. Set MONGODB_URI in Render Environment Variables!');
}

// Health Check & Anti-Sleep Ping Endpoints
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'online', 
    timestamp: Date.now(), 
    uptime: process.uptime(),
    dbConnected: mongoose.connection.readyState === 1
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    server: 'Dragon Ball Clash Backend', 
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'connecting/disconnected',
    activeConnections: io ? io.engine.clientsCount : 0 
  });
});

// Serve Studio Maker Web Application
app.get('/studio', (req, res) => {
  res.sendFile(process.cwd() + '/studio.html');
});

// Custom Injected Cards Store in Server Database
const injectedCustomCards = {};

app.post('/api/inject-card', (req, res) => {
  try {
    const { cardId, dataUrl } = req.body;
    if (cardId && dataUrl) {
      injectedCustomCards[cardId] = dataUrl;
      console.log(`🔥 [Studio API] Custom card ${cardId} injected into server database!`);
      return res.status(200).json({ success: true, cardId });
    }
  } catch (e) {}
  res.status(400).json({ success: false, message: 'Invalid payload' });
});

// ── REST API ENDPOINTS FOR AUTH & MONGO SYNC ──

// Helper: Ensure DB connection is active
const requireDB = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ 
      success: false, 
      message: 'O servidor no Render ainda está estabelecendo conexão com o MongoDB Atlas. Tente novamente em alguns segundos.' 
    });
    return false;
  }
  return true;
};

// 1. Register User in MongoDB
app.post('/api/auth/register', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { displayName, email, password, initialData } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatórios!' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Este e-mail já está cadastrado!' });
    }

    const uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const newUser = new User({
      uid,
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      password,
      isGuest: false,
      ...(initialData || {})
    });

    await newUser.save();
    console.log(`[MongoDB] New User Registered: ${newUser.displayName} (${newUser.email})`);
    res.status(201).json({ success: true, user: newUser.toPublicJSON() });
  } catch (err) {
    console.error('[MongoDB] Register Error:', err);
    res.status(500).json({ success: false, message: `Erro no banco de dados: ${err.message}` });
  }
});

// 2. Login User from MongoDB
app.post('/api/auth/login', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Digite o e-mail e a senha!' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado!' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Senha incorreta!' });
    }

    console.log(`[MongoDB] User Logged In: ${user.displayName}`);
    res.status(200).json({ success: true, user: user.toPublicJSON() });
  } catch (err) {
    console.error('[MongoDB] Login Error:', err);
    res.status(500).json({ success: false, message: `Erro ao realizar login: ${err.message}` });
  }
});

// 3. User Progress & Inventory Cloud Sync
app.post('/api/user/sync', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { uid, userData } = req.body;
    if (!uid || !userData) return res.status(400).json({ success: false, message: 'Dados inválidos.' });

    const updatedUser = await User.findOneAndUpdate(
      { uid },
      { $set: userData },
      { returnDocument: 'after' }
    );

    if (!updatedUser) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    res.status(200).json({ success: true, user: updatedUser.toPublicJSON() });
  } catch (err) {
    console.error('[MongoDB] Sync Error:', err);
    res.status(500).json({ success: false, message: `Erro de sincronização: ${err.message}` });
  }
});

// 4. Global Leaderboard Endpoint (Top 20 Ranked)
app.get('/api/leaderboard', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({ success: true, leaderboard: [] });
    }
    const topPlayers = await User.find({ isGuest: false })
      .sort({ rankPoints: -1 })
      .limit(20)
      .select('displayName rankPoints division victories losses level selectedLeader');

    res.status(200).json({ success: true, leaderboard: topPlayers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar placar de líderes.' });
  }
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

// Server-side State Storage
const matchmakingQueues = {
  '1v1': [],
  '2v2': [],
  'raid': []
};
const queueTimers = {};
const activeRooms = {};

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // ── 1. MATCHMAKING SYSTEM ──
  socket.on('join_matchmaking', (userData) => {
    socket.userData = userData || { uid: socket.id, username: 'Guerreiro Z', leader: 'goku', deck: [], mode: '1v1' };
    const mode = socket.userData.mode || '1v1';
    
    // Ensure queue exists
    if (!matchmakingQueues[mode]) matchmakingQueues[mode] = [];
    const queue = matchmakingQueues[mode];

    // Remove if already in any queue to avoid duplicates
    Object.values(matchmakingQueues).forEach(q => {
      const existingIndex = q.findIndex(s => s.id === socket.id || (s.userData && s.userData.uid === socket.userData.uid));
      if (existingIndex !== -1) {
        q.splice(existingIndex, 1);
      }
    });

    queue.push(socket);
    socket.emit('waiting_for_opponent');
    console.log(`[Matchmaking] ${socket.userData.username} added to ${mode} queue (Total: ${queue.length})`);

    const maxPlayers = mode === '1v1' ? 2 : 4;

    if (queue.length === 1) {
      // Start timer for the first player in queue
      // 2v2/raid get 20s (longer to gather 4), 1v1 gets 15s
      const timerMs = (mode === '2v2' || mode === 'raid') ? 20000 : 15000;
      queueTimers[mode] = setTimeout(() => {
        startMatchFromQueue(mode);
      }, timerMs);
    } else if (queue.length >= maxPlayers) {
      // Room full, start immediately
      clearTimeout(queueTimers[mode]);
      startMatchFromQueue(mode);
    }
  });

  socket.on('leave_matchmaking', () => {
    Object.keys(matchmakingQueues).forEach(mode => {
      const q = matchmakingQueues[mode];
      const index = q.findIndex(s => s.id === socket.id);
      if (index !== -1) {
        q.splice(index, 1);
        console.log(`[Matchmaking] ${socket.id} left ${mode} queue`);
        if (q.length === 0 && queueTimers[mode]) {
          clearTimeout(queueTimers[mode]);
        }
      }
    });
  });

  function startMatchFromQueue(mode) {
    const queue = matchmakingQueues[mode];
    if (!queue || queue.length === 0) return;

    const maxPlayers = mode === '1v1' ? 2 : 4;
    const playersToMatch = queue.splice(0, maxPlayers).filter(s => s.connected);

    if (playersToMatch.length <= 1) {
      return;
    }

    const roomCode = `room_${mode}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const initiative = Math.random() < 0.5 ? 'player' : 'opponent';

    const hostSocket = playersToMatch[0];

    // ──────────────────────────────────────────────
    // ALL PLAYERS DATA — distribute across teams
    //   1v1:        slot 0 & 1  (player / opponent)
    //   2v2 Team A: slot 0 (p1), slot 1 (p2)
    //   2v2 Team B: slot 2 (opp1), slot 3 (opp2)
    //   Raid:       slots 0-3 (p1-p4, all allies)
    // ──────────────────────────────────────────────
    const BOT_NAMES_2V2 = ['Goku Bot', 'Vegeta Bot'];
    const BOT_LEADERS_2V2 = ['goku', 'vegeta', 'frieza', 'piccolo'];
    const BOT_NAMES_RAID = ['Gohan Bot', 'Trunks Bot'];
    const BOT_LEADERS_RAID = ['gohan', 'trunks'];

    // Pre-fill all slots with bots
    const isRaid = mode === 'raid';
    const botLeaders = isRaid ? BOT_LEADERS_RAID : BOT_LEADERS_2V2;
    const botNames = isRaid ? BOT_NAMES_RAID : BOT_NAMES_2V2;

    const allPlayersData = [];
    for (let i = 0; i < maxPlayers; i++) {
      allPlayersData.push({
        uid: `bot_${i}_${Date.now()}`,
        username: botNames[i % botNames.length] || `Bot ${i}`,
        leader: botLeaders[i] || (isRaid ? 'gohan' : 'goku'),
        deck: []
      });
    }

    if (mode === '2v2') {
      // Cross-team distribution:
      //   Player 0 → slot 0 (p1, Team A, HOST)
      //   Player 1 → slot 2 (opp1, Team B)
      //   Player 2 → slot 1 (p2, Team A)
      //   Player 3 → slot 3 (opp2, Team B)
      const teamSlots = { A: [0, 1], B: [2, 3] };
      const teamCount = { A: 0, B: 0 };
      const teamCycle = ['A', 'B', 'A', 'B']; // player 0→A, 1→B, 2→A, 3→B
      const slotForPlayer = [];

      playersToMatch.forEach((s, index) => {
        const team = teamCycle[index];
        const slot = teamSlots[team][teamCount[team]];
        teamCount[team]++;
        if (slot !== undefined) {
          allPlayersData[slot] = {
            uid: s.userData.uid,
            username: s.userData.username,
            leader: s.userData.leader,
            deck: s.userData.deck
          };
          slotForPlayer[index] = slot;
        }
      });

      playersToMatch.forEach((s, index) => {
        const slot = slotForPlayer[index];
        if (slot === undefined) return;
        s.join(roomCode);
        s.roomCode = roomCode;
        const isHost = slot === 0;
        const oppSocket = playersToMatch.find((other, j) => j !== index) || null;

        s.emit('match_found', {
          isHost,
          mode,
          guestIndex: slot,
          roomCode,
          opponent: oppSocket ? {
            uid: oppSocket.userData.uid,
            username: oppSocket.userData.username,
            leader: oppSocket.userData.leader,
            deck: oppSocket.userData.deck
          } : { uid: `bot_opp`, username: 'Oponente Bot', leader: 'frieza', deck: [] },
          allPlayers: allPlayersData,
          initiative: isHost ? initiative : (initiative === 'player' ? 'opponent' : 'player')
        });
      });

      activeRooms[roomCode] = { engine: null, players: {}, mode };
      playersToMatch.forEach((s, i) => {
        if (slotForPlayer[i] !== undefined) {
          activeRooms[roomCode].players[s.id] = slotForPlayer[i];
        }
      });

    } else if (mode === 'raid') {
      // Raid: all players on same team, sequential slots
      playersToMatch.forEach((s, index) => {
        allPlayersData[index] = {
          uid: s.userData.uid,
          username: s.userData.username,
          leader: s.userData.leader,
          deck: s.userData.deck
        };
      });

      playersToMatch.forEach((s, index) => {
        s.join(roomCode);
        s.roomCode = roomCode;
        const isHost = index === 0;
        const oppSocket = index === 0 ? playersToMatch[1] : playersToMatch[0];

        s.emit('match_found', {
          isHost,
          mode,
          guestIndex: index,
          roomCode,
          opponent: oppSocket ? {
            uid: oppSocket.userData.uid,
            username: oppSocket.userData.username,
            leader: oppSocket.userData.leader,
            deck: oppSocket.userData.deck
          } : { uid: `bot_ally`, username: 'Aliado Bot', leader: 'goku', deck: [] },
          allPlayers: allPlayersData,
          initiative: isHost ? initiative : (initiative === 'player' ? 'opponent' : 'player')
        });
      });

      activeRooms[roomCode] = { engine: null, players: {}, mode };
      playersToMatch.forEach((s, i) => {
        activeRooms[roomCode].players[s.id] = i;
      });

    } else {
      // 1v1: sequential
      playersToMatch.forEach((s, index) => {
        allPlayersData[index] = {
          uid: s.userData.uid,
          username: s.userData.username,
          leader: s.userData.leader,
          deck: s.userData.deck
        };
      });

      playersToMatch.forEach((s, index) => {
        s.join(roomCode);
        s.roomCode = roomCode;
        const isHost = index === 0;
        const oppSocket = isHost ? playersToMatch[1] : hostSocket;

        s.emit('match_found', {
          isHost,
          mode,
          guestIndex: index,
          roomCode,
          opponent: {
            uid: oppSocket.userData.uid,
            username: oppSocket.userData.username,
            leader: oppSocket.userData.leader,
            deck: oppSocket.userData.deck
          },
          allPlayers: allPlayersData,
          initiative: isHost ? initiative : (initiative === 'player' ? 'opponent' : 'player')
        });
      });

      const engine = new ServerGameEngine(
        (eng) => { io.to(roomCode).emit('state_update', eng.getFullSyncState()); },
        (type, data) => { io.to(roomCode).emit('game_fx', { type, data }); }
      );
      engine.onFx = (type, data) => { io.to(roomCode).emit('game_fx', { type, data }); };
      
      engine.startMatch(
        hostSocket.userData.leader, 
        playersToMatch[1].userData.leader, 
        hostSocket.userData.deck, 
        false, 
        {
          playerDeck: engine.secureShuffle(hostSocket.userData.deck),
          opponentDeck: engine.secureShuffle(playersToMatch[1].userData.deck),
          initiative: initiative
        }
      );

      activeRooms[roomCode] = { engine, players: {} };
      playersToMatch.forEach((s, i) => {
        activeRooms[roomCode].players[s.id] = i === 0 ? 'player' : 'opponent';
      });
    }

    console.log(`[Matchmaking] Room created (${mode}): ${roomCode} with ${playersToMatch.length} players`);
  }

  // ── 2. GAME ACTION & STATE RELAY ──
  socket.on('mode_state_sync', (payload) => {
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('mode_state_update', payload);
    }
  });

  socket.on('mode_action_broadcast', (payload) => {
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('mode_action_received', payload);
    }
  });

  socket.on('mode_fx_broadcast', (payload) => {
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('mode_fx_received', payload);
    }
  });

  socket.on('game_action', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !activeRooms[roomCode]) return;
    
    const room = activeRooms[roomCode];
    const engine = room.engine;
    const actorKey = room.players[socket.id];
    
    if (!actorKey) return;

    // Only process game_action for 1v1 (server authoritative)
    // 2v2/raid use mode_action_broadcast for client-side engine
    if (room.mode && room.mode !== '1v1') return;

    try {
      if (payload.action === 'playCard') {
        engine._playCard(actorKey, payload.data.cardIndex, payload.data.cardId);
      } else if (payload.action === 'chargeKi') {
        engine._chargeKi(actorKey);
      } else if (payload.action === 'passTurn') {
        engine._passTurn(actorKey);
      } else if (payload.action === 'mashBeamClash') {
        engine._mashBeamClash(actorKey);
      }
    } catch (e) {
      console.error(`[Engine] Error processing action ${payload.action}:`, e);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    Object.keys(matchmakingQueues).forEach(mode => {
      const q = matchmakingQueues[mode];
      const index = q.findIndex(s => s.id === socket.id);
      if (index !== -1) {
        q.splice(index, 1);
        console.log(`[Matchmaking] ${socket.id} left ${mode} queue on disconnect`);
      }
    });

    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('opponent_disconnected', {
        uid: socket.userData?.uid || socket.id,
        message: 'Oponente desconectou-se da partida.'
      });
      delete activeRooms[socket.roomCode]; // Clean up engine
    }
  });

  // ── 3. CHAT SYSTEM ──
  socket.on('send_chat', (payload) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = {
      user: payload.user || socket.userData?.username || 'Guerreiro Z',
      text: payload.text || '',
      time: time,
      roomCode: payload.roomCode || null
    };

    if (payload.roomCode) {
      io.to(payload.roomCode).emit('chat_message', msg);
    } else {
      io.emit('chat_message', msg);
    }
  });

  // ── 4. KEEP ALIVE PING ACKNOWLEDGEMENT ──
  socket.on('keep_alive_ping', () => {
    socket.emit('keep_alive_pong', { serverTime: Date.now() });
  });
});

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
  console.log(`🍃 MONGODB_URI Status: ${MONGODB_URI ? 'URI Configured (Connecting async...)' : 'MISSING MONGODB_URI'}`);
  console.log(`🌐 CORS: Enabled for all origins (* / Vercel)`);
  console.log(`=======================================================`);
});
