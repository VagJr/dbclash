import os

def update_multiplayer_manager():
    filepath = 'c:/dbtcg/js/multiplayer-manager.js'
    
    code = """/* ==========================================================================
   Dragon Ball Clash Action TCG — Socket.io Multiplayer & Matchmaking
   Supports Dedicated Render Server, Low Latency WebSockets, Ranked 1v1, 2v2 & Raid
   ========================================================================== */

import { socketManager } from './socket-config.js';
import { deckBuilder } from './deck-builder.js';
import { authManager } from './auth-manager.js';
import { raidEngine, RAID_BOSSES } from './raid-engine.js';
import { sceneManager, GAME_SCENES } from './scene-manager.js';
import { LEADERS, getStarterDeckForLeader } from './card-database.js';
import * as chatModule from './chat-manager.js';
const chatManager = chatModule.chatManager;

export class MultiplayerManager {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.roomCode = null;
    this.isHost = false;
    this.isMultiplayer = false;
    this.mode = '1v1';
    this.myUid = null;
    this.opponentUid = null;
    this.mmInterval = null;
    this.syncInterval = null;
    this.isPaired = false;

    // Inject multiplayer hook into game engine
    this.engine.onLocalAction = (actionType, data) => this.broadcastMove(actionType, data);
    
    this.initSocketListeners();
  }

  initSocketListeners() {
    socketManager.on('waiting_for_opponent', () => {
      console.log('[MultiplayerManager] Waiting for opponent in queue...');
    });

    socketManager.on('retry_matchmaking', () => {
      console.log('[MultiplayerManager] Opponent disconnected, retrying...');
      socketManager.emit('join_matchmaking', this.lastUserData || {});
    });

    socketManager.on('match_found', (payload) => {
      console.log(`[MultiplayerManager] Match Found! Room: ${payload.roomCode} | Host: ${payload.isHost}`);
      this.isPaired = true;
      this.isHost = payload.isHost;
      this.roomCode = payload.roomCode;
      this.opponentUid = payload.opponent.uid;
      
      this.clearMatchmaking();

      const mmModal = document.getElementById('matchmaking-modal');
      if (mmModal) mmModal.classList.remove('active');

      try { chatManager.setRoom(this.roomCode); } catch(e){}

      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner(
          `GUERREIRO ENCONTRADO: ${payload.opponent.username}!`,
          'act-attack', 'VS JOGADOR REAL'
        );
      }

      const pLeader = this.pendingLeaderKey || (typeof authManager !== 'undefined' && authManager.user?.selectedLeader) || 'goku';
      const pDeck = this.myDeck || deckBuilder.getDeckForLeader(pLeader);
      const pDeckShuffled = this.engine.secureShuffle([...pDeck]);
      const oDeckShuffled = this.engine.secureShuffle([...payload.opponent.deck]);

      const setupObj = {
        playerDeck: pDeckShuffled,
        opponentDeck: oDeckShuffled,
        initiative: payload.initiative
      };

      this.startSyncedMatch(pLeader, payload.opponent.leader || payload.opponent.username, setupObj);
    });

    socketManager.on('state_update', (payload) => {
      if (this.isMultiplayer) {
        let stateObj = payload;
        if (!this.isHost && payload) {
          stateObj = { ...payload, player: payload.opponent, opponent: payload.player };
          if (payload.initiative === 'player') stateObj.initiative = 'opponent';
          else if (payload.initiative === 'opponent') stateObj.initiative = 'player';
          if (payload.winner) {
            stateObj.winner = payload.winner === 'player' ? 'opponent' : 'player';
          }
          if (payload.pendingAttack) {
            stateObj.pendingAttack = { ...payload.pendingAttack, attackerKey: payload.pendingAttack.attackerKey === 'player' ? 'opponent' : 'player' };
          }
          if (payload.beamClashData) {
            stateObj.beamClashData = {
              ...payload.beamClashData,
              p1Progress: 100 - payload.beamClashData.p1Progress
            };
          }
        }
        this.engine.applyFullSyncState(stateObj);
      }
    });

    socketManager.on('game_fx', (payload) => {
      if (this.isMultiplayer) {
        let fxData = payload.data || {};
        if (!this.isHost) {
          if (fxData.attackerKey) {
            fxData.attackerKey = fxData.attackerKey === 'player' ? 'opponent' : 'player';
          }
          if (fxData.defenderKey) {
            fxData.defenderKey = fxData.defenderKey === 'player' ? 'opponent' : 'player';
          }
        }
        this.engine.fx(payload.type, fxData);
      }
    });

    socketManager.on('opponent_disconnected', (payload) => {
      if (this.isMultiplayer && typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner(
          'OPONENTE DESCONECTOU! VITÓRIA POR W.O.',
          'act-defense', 'FIM DE PARTIDA'
        );
      }
    });
  }

  broadcastMove(actionType, data) {
    if (!this.isMultiplayer || !this.roomCode) return;
    try {
      socketManager.emit('game_action', {
        action: actionType,
        data: data || {}
      });
    } catch(e) {
      console.warn("Failed to send action:", e);
    }
  }

  // --- 1v1 MATCHMAKING (15 SECONDS TIMER) ---
  startRanked1v1Matchmaking(leaderKey, deck) {
    this.mode = '1v1';
    this.isMultiplayer = true;
    this.isPaired = false;
    this.engine.multiplayerMode = '1v1';
    
    const mmModal = document.getElementById('matchmaking-modal');
    const mmTimer = document.getElementById('mm-timer');
    const cancelBtn = document.getElementById('mm-cancel-btn');
    
    if (mmModal) mmModal.classList.add('active');
    
    let seconds = 0;
    if (mmTimer) mmTimer.textContent = '00:00';
    
    this.clearMatchmaking();
    
    const baseUid = (typeof authManager !== 'undefined' && authManager.user?.uid) 
      ? authManager.user.uid 
      : 'user';
    this.myUid = baseUid + '_' + Math.random().toString(36).substring(2, 11);
    const pLeader = leaderKey || (typeof authManager !== 'undefined' && authManager.user?.selectedLeader) || 'goku';
    this.pendingLeaderKey = pLeader;
    
    const myUsername = (typeof authManager !== 'undefined' && authManager.user?.displayName) 
      ? authManager.user.displayName : 'Guerreiro Z';
    
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);

    this.myLeader = pLeader;
    this.myDeck = finalDeck;

    this.lastUserData = {
      uid: this.myUid,
      username: myUsername,
      leader: pLeader,
      deck: finalDeck,
      mode: '1v1'
    };

    console.log(`[MultiplayerManager] 1v1 Queue: ${myUsername} (${this.myUid})`);

    socketManager.emit('join_matchmaking', this.lastUserData);

    this.mmInterval = setInterval(() => {
      seconds++;
      const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      if (mmTimer) mmTimer.textContent = `${mins}:${secs}`;
      
      // Matchmaking timer: Exactly 15 seconds wait time before bot fallback
      if (seconds >= 15) {
        socketManager.emit('leave_matchmaking');
        this.fallbackToBotAI(leaderKey, deck);
      }
    }, 1000);

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        socketManager.emit('leave_matchmaking');
        this.clearMatchmaking();
        if (mmModal) mmModal.classList.remove('active');
      };
    }
  }

  // --- 2v2 MATCHMAKING (15 SECONDS TIMER) ---
  startRanked2v2Matchmaking(leaderKey, deck) {
    this.mode = '2v2';
    this.isMultiplayer = true;
    this.isPaired = false;
    this.engine.multiplayerMode = '2v2';
    
    const mmModal = document.getElementById('matchmaking-modal');
    const mmTimer = document.getElementById('mm-timer');
    const cancelBtn = document.getElementById('mm-cancel-btn');
    
    if (mmModal) mmModal.classList.add('active');
    
    let seconds = 0;
    if (mmTimer) mmTimer.textContent = '00:00';
    
    this.clearMatchmaking();
    
    const pLeader = leaderKey || (typeof authManager !== 'undefined' && authManager.user?.selectedLeader) || 'goku';
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);

    this.lastUserData = {
      uid: (authManager.user?.uid || 'user') + '_' + Math.random().toString(36).substring(2, 7),
      username: authManager.user?.displayName || 'Guerreiro Z',
      leader: pLeader,
      deck: finalDeck,
      mode: '2v2'
    };

    socketManager.emit('join_matchmaking', this.lastUserData);

    this.mmInterval = setInterval(() => {
      seconds++;
      const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      if (mmTimer) mmTimer.textContent = `${mins}:${secs}`;
      
      // Matchmaking timer: Exactly 15 seconds for 2v2
      if (seconds >= 15) {
        socketManager.emit('leave_matchmaking');
        this.fallbackToBot2v2(pLeader, finalDeck);
      }
    }, 1000);

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        socketManager.emit('leave_matchmaking');
        this.clearMatchmaking();
        if (mmModal) mmModal.classList.remove('active');
      };
    }
  }

  // --- RAID CO-OP MATCHMAKING (15 SECONDS TIMER) ---
  startCoOpRaidMatchmaking(bossId = 'cell_max', leaderKey = 'goku', deck) {
    this.mode = 'raid';
    this.isMultiplayer = true;
    this.isPaired = false;
    this.engine.multiplayerMode = 'raid';
    
    const mmModal = document.getElementById('matchmaking-modal');
    const mmTimer = document.getElementById('mm-timer');
    const cancelBtn = document.getElementById('mm-cancel-btn');
    
    if (mmModal) mmModal.classList.add('active');
    
    let seconds = 0;
    if (mmTimer) mmTimer.textContent = '00:00';
    
    this.clearMatchmaking();
    
    const pLeader = leaderKey || (typeof authManager !== 'undefined' && authManager.user?.selectedLeader) || 'goku';
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);

    this.lastUserData = {
      uid: (authManager.user?.uid || 'user') + '_' + Math.random().toString(36).substring(2, 7),
      username: authManager.user?.displayName || 'Guerreiro Z',
      leader: pLeader,
      deck: finalDeck,
      mode: 'raid',
      bossId: bossId
    };

    socketManager.emit('join_matchmaking', this.lastUserData);

    this.mmInterval = setInterval(() => {
      seconds++;
      const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      if (mmTimer) mmTimer.textContent = `${mins}:${secs}`;
      
      // Matchmaking timer: Exactly 15 seconds for Raid Co-Op
      if (seconds >= 15) {
        socketManager.emit('leave_matchmaking');
        this.fallbackToBotRaid(bossId, pLeader, finalDeck);
      }
    }, 1000);

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        socketManager.emit('leave_matchmaking');
        this.clearMatchmaking();
        if (mmModal) mmModal.classList.remove('active');
      };
    }
  }

  startSyncedMatch(pLeader, oLeader, setupObj) {
    this.engine.multiplayerMode = '1v1';
    this.engine.startMatch(pLeader, oLeader, [], false, setupObj);
    sceneManager.switchScene(GAME_SCENES.ARENA);
  }

  clearMatchmaking() {
    this.isPaired = false;
    if (this.mmInterval) {
      clearInterval(this.mmInterval);
      this.mmInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    delete this.myLeader;
    delete this.myDeck;
  }

  // --- BOT FALLBACKS ---
  fallbackToBotAI(leaderKey, deck) {
    this.clearMatchmaking();
    const mmModal = document.getElementById('matchmaking-modal');
    if (mmModal) mmModal.classList.remove('active');
    
    this.isMultiplayer = false;
    this.roomCode = null;
    try { chatManager.setRoom(null); } catch(e) {}
    
    const pLeader = leaderKey || authManager.user?.selectedLeader || 'goku';
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);
    
    const possibleOpponents = ['vegeta', 'frieza', 'gohan', 'piccolo', 'trunks'];
    const aiLeader = possibleOpponents[Math.floor(Math.random() * possibleOpponents.length)];
    
    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.triggerActionBanner('BOT IA ENCONTRADO! BATALHA INICIADA', 'act-attack', 'VS BOT SUPREMO');
    }
    
    this.engine.multiplayerMode = '1v1';
    this.engine.startMatch(pLeader, aiLeader, finalDeck, true);
    sceneManager.switchScene(GAME_SCENES.ARENA);
  }

  fallbackToBot2v2(pLeader, finalDeck) {
    this.clearMatchmaking();
    const mmModal = document.getElementById('matchmaking-modal');
    if (mmModal) mmModal.classList.remove('active');

    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.triggerActionBanner('DUETO 2V2 INICIADO!', 'act-attack', 'TIME A VS TIME B');
    }

    this.engine.multiplayerMode = '2v2';
    this.engine.startMatch(pLeader, 'vegeta', finalDeck, true);

    // Set 2v2 Entities
    this.engine.p1 = this.engine.player; // Team A Member 1 (You)
    this.engine.p2 = this.engine.opponent; // Team B Member 1 (Vegeta)
    this.engine.p3 = { name: 'Gohan (Parceiro)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') }; // Team A Member 2
    this.engine.p4 = { name: 'Frieza (Oponente 2)', leader: { ...LEADERS.frieza }, hp: 400, maxHp: 400, shields: 8, ki: 5, isAwakened: false, hand: [], deck: getStarterDeckForLeader('frieza') }; // Team B Member 2

    this.engine.turnOrder = ['p1', 'p2', 'p3', 'p4'];

    sceneManager.switchScene(GAME_SCENES.ARENA);
  }

  fallbackToBotRaid(bossId = 'cell_max', pLeader, finalDeck) {
    this.clearMatchmaking();
    const mmModal = document.getElementById('matchmaking-modal');
    if (mmModal) mmModal.classList.remove('active');

    const bossData = RAID_BOSSES[bossId] || RAID_BOSSES.cell_max;

    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.triggerActionBanner(`MODO RAID CO-OP: ${bossData.name.toUpperCase()}`, 'act-attack', '4 GUERREIROS Z VS CHEFÃO GIGANTE');
    }

    this.engine.multiplayerMode = 'raid';
    this.engine.startMatch(pLeader, 'frieza', finalDeck, true);

    // Configure Opponent as 2000 HP Raid Boss (Top UI - p2)
    this.engine.p2 = {
      name: bossData.name,
      leader: {
        id: bossData.id,
        name: bossData.name,
        awakenedName: `${bossData.name} (FÚRIA TOTAL)`,
        maxHp: bossData.hp,
        color: bossData.color,
        awakenThresholdHp: Math.floor(bossData.hp * 0.5)
      },
      hp: bossData.hp,
      maxHp: bossData.hp,
      shields: 12,
      ki: 6,
      isAwakened: false,
      isOpenGuard: false,
      hand: [],
      deck: getStarterDeckForLeader('frieza')
    };

    // Configure 4 Bottom Player Entities (p1, p3, p5, p6)
    this.engine.p1 = this.engine.player; // You
    this.engine.p3 = { name: 'Vegeta (P2)', leader: { ...LEADERS.vegeta }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('vegeta') };
    this.engine.p5 = { name: 'Gohan (P3)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') };
    this.engine.p6 = { name: 'Trunks (P4)', leader: { ...LEADERS.trunks }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('trunks') };

    // Turn order: 4 Warriors -> Boss
    this.engine.turnOrder = ['p1', 'p3', 'p5', 'p6', 'p2'];

    sceneManager.switchScene(GAME_SCENES.ARENA);
  }

  createRoom(leaderKey, deck, mode = '1v1') { return "0000"; }
  joinRoom(roomCode, leaderKey, deck) { return true; }
  startRanked2v2(leaderKey, deck) { return this.startRanked2v2Matchmaking(leaderKey, deck); }
  startCoOpRaid(bossId = 'cell_max', leaderKey = 'goku') { return this.startCoOpRaidMatchmaking(bossId, leaderKey); }
  startAiMatch(leaderKey, opponentLeaderKey, deck) {
    this.fallbackToBotAI(leaderKey, deck);
  }
}
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Updated multiplayer-manager.js successfully!")

if __name__ == '__main__':
    update_multiplayer_manager()
