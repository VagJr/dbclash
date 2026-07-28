/* ==========================================================================
   Dragon Ball Clash Action TCG — Socket.io Multiplayer & Matchmaking
   Supports Dedicated Render Server, Low Latency WebSockets, Ranked 1v1 & AI
   ========================================================================== */

import { socketManager } from './socket-config.js';
import { deckBuilder } from './deck-builder.js';
import { authManager } from './auth-manager.js';
import { raidEngine } from './raid-engine.js';
import { sceneManager, GAME_SCENES } from './scene-manager.js';
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
        // In multiplayer, the engine is fully authoritative from the backend.
        // Reverse opponent and player if we are the guest
        let stateObj = payload;
        if (!this.isHost && payload) {
          stateObj = { ...payload, player: payload.opponent, opponent: payload.player };
          if (payload.initiative === 'player') stateObj.initiative = 'opponent';
          else if (payload.initiative === 'opponent') stateObj.initiative = 'player';
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
        // If we are guest, server's "player" is our "opponent" and vice versa
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

  // Removed onRemoteMove as server is now completely authoritative

  startRanked1v1Matchmaking(leaderKey, deck) {
    this.mode = 'ranked_1v1';
    this.isMultiplayer = true;
    this.isPaired = false;
    
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
    this.pendingLeaderKey = pLeader; // Store exactly what we queued with
    
    const myUsername = (typeof authManager !== 'undefined' && authManager.user?.displayName) 
      ? authManager.user.displayName : 'Guerreiro Z';
    
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);

    this.myLeader = pLeader;
    this.myDeck = finalDeck;

    this.lastUserData = {
      uid: this.myUid,
      username: myUsername,
      leader: pLeader,
      deck: finalDeck
    };

    console.log(`[MultiplayerManager] Entering queue as: ${myUsername} (${this.myUid})`);

    socketManager.emit('join_matchmaking', this.lastUserData);

    this.mmInterval = setInterval(() => {
      seconds++;
      const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      if (mmTimer) mmTimer.textContent = `${mins}:${secs}`;
      
      // Extended timer to 60 seconds for comfortable local/online pairing
      if (seconds >= 60) {
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

  startSyncedMatch(pLeader, oLeader, setupObj) {
    this.engine.startMatch(pLeader, oLeader, [], false, setupObj);
    sceneManager.switchScene(GAME_SCENES.ARENA);
    // State will automatically be synced from the server's initial emit
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

  fallbackToBotAI(leaderKey, deck) {
    this.clearMatchmaking();
    const mmModal = document.getElementById('matchmaking-modal');
    if (mmModal) mmModal.classList.remove('active');
    
    this.isMultiplayer = false;
    this.roomCode = null;
    try { chatManager.setRoom(null); } catch(e) { console.warn('setRoom fallback:', e); }
    
    const pLeader = leaderKey || authManager.user?.selectedLeader || 'goku';
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);
    
    const possibleOpponents = ['vegeta', 'frieza', 'gohan', 'piccolo', 'trunks'];
    const aiLeader = possibleOpponents[Math.floor(Math.random() * possibleOpponents.length)];
    
    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.triggerActionBanner('BOT IA ENCONTRADO! BATALHA INICIADA', 'act-attack', 'VS BOT SUPREMO');
    }
    
    this.engine.startMatch(pLeader, aiLeader, finalDeck, true);
    sceneManager.switchScene(GAME_SCENES.ARENA);
  }

  createRoom(leaderKey, deck, mode = '1v1') { return "0000"; }
  joinRoom(roomCode, leaderKey, deck) { return true; }
  startRanked2v2(leaderKey, deck) { return this.startRanked1v1Matchmaking(leaderKey, deck); }
  startCoOpRaid(bossId = 'cell_max', leaderKey = 'goku') {
    this.isMultiplayer = false;
    raidEngine.startRaid(bossId, [leaderKey, 'vegeta', 'gohan'], this.engine);
    this.engine.startMatch(leaderKey, 'frieza', deckBuilder.getDeckForLeader(leaderKey), true);
    return "RAID";
  }
  startAiMatch(leaderKey, opponentLeaderKey, deck) {
    this.fallbackToBotAI(leaderKey, deck);
  }
}
