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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dbtcg';

// Enable CORS for Vercel frontend & Localhost testing
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── MONGODB ATLAS CONNECTION ──
mongoose.connect(MONGODB_URI)
  .then(() => console.log('🍃 Connected to MongoDB Atlas Database!'))
  .catch(err => console.warn('⚠️ MongoDB connection warning (running fallback mode):', err.message));

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
    res.status(500).json({ success: false, message: 'Erro ao cadastrar usuário no banco de dados.' });
  }
});

// 2. Login User from MongoDB
app.post('/api/auth/login', async (req, res) => {
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
    res.status(500).json({ success: false, message: 'Erro ao realizar login.' });
  }
});

// 3. User Progress & Inventory Cloud Sync
app.post('/api/user/sync', async (req, res) => {
  try {
    const { uid, userData } = req.body;
    if (!uid || !userData) return res.status(400).json({ success: false, message: 'Dados inválidos.' });

    const updatedUser = await User.findOneAndUpdate(
      { uid },
      { $set: userData },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    res.status(200).json({ success: true, user: updatedUser.toPublicJSON() });
  } catch (err) {
    console.error('[MongoDB] Sync Error:', err);
    res.status(500).json({ success: false, message: 'Erro ao sincronizar dados na nuvem.' });
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
const matchmakingQueue = [];
const activeRooms = {};

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // ── 1. MATCHMAKING SYSTEM ──
  socket.on('join_matchmaking', (userData) => {
    socket.userData = userData || { uid: socket.id, username: 'Guerreiro Z', leader: 'goku', deck: [] };
    
    // Remove if already in queue to avoid duplicates
    const existingIndex = matchmakingQueue.findIndex(s => s.id === socket.id || (s.userData && s.userData.uid === socket.userData.uid));
    if (existingIndex !== -1) {
      matchmakingQueue.splice(existingIndex, 1);
    }

    if (matchmakingQueue.length > 0) {
      // Pair with the waiting opponent
      const opponentSocket = matchmakingQueue.shift();
      
      // Ensure opponent is still connected
      if (!opponentSocket.connected) {
        return socket.emit('retry_matchmaking');
      }

      const roomCode = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      socket.join(roomCode);
      opponentSocket.join(roomCode);

      socket.roomCode = roomCode;
      opponentSocket.roomCode = roomCode;

      const initiative = Math.random() < 0.5 ? 'player' : 'opponent';

      // Notify Host (Opponent waiting first)
      opponentSocket.emit('match_found', {
        isHost: true,
        roomCode: roomCode,
        opponent: {
          uid: socket.userData.uid,
          username: socket.userData.username,
          leader: socket.userData.leader,
          deck: socket.userData.deck
        },
        initiative: initiative
      });

      // Notify Guest (Socket joining second)
      socket.emit('match_found', {
        isHost: false,
        roomCode: roomCode,
        opponent: {
          uid: opponentSocket.userData.uid,
          username: opponentSocket.userData.username,
          leader: opponentSocket.userData.leader,
          deck: opponentSocket.userData.deck
        },
        initiative: initiative === 'player' ? 'opponent' : 'player'
      });

      // Instantiate Authoritative Game Engine for the room
      const engine = new ServerGameEngine(
        (eng) => {
          io.to(roomCode).emit('state_update', eng.getFullSyncState());
        },
        (type, data) => {
          io.to(roomCode).emit('game_fx', { type, data });
        }
      );
      engine.onFx = (type, data) => {
        io.to(roomCode).emit('game_fx', { type, data });
      };
      
      // Start Authoritative Match
      engine.startMatch(
        opponentSocket.userData.leader, 
        socket.userData.leader, 
        opponentSocket.userData.deck, 
        false, 
        {
          playerDeck: engine.secureShuffle(opponentSocket.userData.deck),
          opponentDeck: engine.secureShuffle(socket.userData.deck),
          initiative: initiative
        }
      );

      activeRooms[roomCode] = {
        engine,
        players: {
          [opponentSocket.id]: 'player',
          [socket.id]: 'opponent'
        }
      };

      console.log(`[Matchmaking] Room created: ${roomCode} | Host: ${opponentSocket.userData.username} vs Guest: ${socket.userData.username}`);
    } else {
      // Push to waiting queue
      matchmakingQueue.push(socket);
      socket.emit('waiting_for_opponent');
      console.log(`[Matchmaking] ${socket.userData.username} added to queue (Total in queue: ${matchmakingQueue.length})`);
    }
  });

  socket.on('leave_matchmaking', () => {
    const index = matchmakingQueue.findIndex(s => s.id === socket.id);
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
      console.log(`[Matchmaking] ${socket.id} left queue`);
    }
  });

  // ── 2. GAME ACTION & STATE RELAY ──
  socket.on('game_action', (payload) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !activeRooms[roomCode]) return;
    
    const room = activeRooms[roomCode];
    const engine = room.engine;
    const actorKey = room.players[socket.id];
    
    if (!actorKey) return;

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
    const index = matchmakingQueue.findIndex(s => s.id === socket.id);
    if (index !== -1) matchmakingQueue.splice(index, 1);

    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('opponent_disconnected');
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

  // ── 5. DISCONNECTION HANDLING ──
  socket.on('disconnect', () => {
    // Remove from queue
    const qIndex = matchmakingQueue.findIndex(s => s.id === socket.id);
    if (qIndex !== -1) {
      matchmakingQueue.splice(qIndex, 1);
    }

    // Notify opponent if in room
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('opponent_disconnected', {
        uid: socket.userData?.uid || socket.id,
        message: 'Oponente desconectou-se da partida.'
      });
    }

    console.log(`[Socket] Client disconnected: ${socket.id}`);
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
  console.log(`🍃 MongoDB Atlas Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting/Fallback'}`);
  console.log(`🌐 CORS: Enabled for all origins (* / Vercel)`);
  console.log(`=======================================================`);
});
