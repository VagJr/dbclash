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
      console.log(`[MultiplayerManager] Match Found! Room: ${payload.roomCode} | Host: ${payload.isHost} | Mode: ${payload.mode}`);
      this.isPaired = true;
      this.isHost = payload.isHost;
      this.guestIndex = payload.guestIndex || 0;
      this.mode = payload.mode || this.mode || '1v1';
      this.roomCode = payload.roomCode;
      this.opponentUid = payload.opponent.uid;
      this.allPlayersData = payload.allPlayers || []; // Store all 4 players' data for 2v2/raid
      
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
        initiative: payload.initiative,
        allPlayers: this.allPlayersData // Pass all players data to engine
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

    // ── MODE SYNC: Non-host receives authoritative state from host ──
    socketManager.on('mode_state_update', (payload) => {
      if (!this.isMultiplayer || this.isHost) return;
      if (typeof uiManager === 'undefined' || !uiManager) return;

      if (payload.mode === '2v2') {
        uiManager.mode2v2.applyFullState(payload);
      } else if (payload.mode === 'raid') {
        uiManager.modeRaid.applyFullState(payload);
      }
    });

    // ── MODE SYNC: Host receives action from non-host player ──
    socketManager.on('mode_action_received', (payload) => {
      if (!this.isMultiplayer || !this.isHost) return;
      if (typeof uiManager === 'undefined' || !uiManager) return;

      const { action, fighterId, handIndex, targetId, mode } = payload;

      if (mode === '2v2') {
        const eng = uiManager.mode2v2;
        if (action === 'playCard') eng.playCard(fighterId, handIndex, targetId);
        else if (action === 'passTurn') {
          if (eng.activeFighterId === fighterId) eng.passTurn(fighterId);
        }
        else if (action === 'chargeKi') {
          eng.chargeKi(fighterId); // o próprio engine já avança o turno
        }
        else if (action === 'mashBeamClash') {
          eng.mashBeamClash(fighterId);
        }
      } else if (mode === 'raid') {
        const eng = uiManager.modeRaid;
        if (action === 'playCard') eng.playCard(fighterId, handIndex);
        else if (action === 'passTurn') {
          if (eng.activeFighterId === fighterId) eng.passTurn(fighterId);
        }
        else if (action === 'chargeKi') {
          eng.chargeKi(fighterId); // o próprio engine já avança o turno
        }
        else if (action === 'mashBeamClash') {
          eng.mashBeamClash(fighterId);
        }
      }
    });

    // ── MODE FX: Non-host receives visual/audio effects from host ──
    socketManager.on('mode_fx_received', (payload) => {
      if (!this.isMultiplayer || this.isHost) return;
      if (typeof uiManager === 'undefined' || !uiManager) return;
      if (typeof soundEngine === 'undefined' || !soundEngine) return;

      const { type, data, mode } = payload;
      if (mode && mode !== this.mode) return;

      if (type === 'playCard') {
        soundEngine.playCardPlay();
      } else if (type === 'zvanish') {
        soundEngine.playZVanish();
      } else if (type === 'chargeKi') {
        soundEngine.playClick();
      } else if (type === 'awaken') {
        soundEngine.playAwaken();
      } else if (type === 'beamDamage') {
        soundEngine.playBeamDamage();
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

  startMatchmaking(mode = '1v1', leaderKey, deck) {
    this.mode = mode;
    this.isMultiplayer = true;
    this.isPaired = false;
    const mmModal = document.getElementById('matchmaking-modal');
    const mmTimer = document.getElementById('mm-timer');
    const cancelBtn = document.getElementById('mm-cancel-btn');
    
    if (mmModal) mmModal.classList.add('active');
    
    // 2v2/raid modes need more time to gather 4 players
    const is4PlayerMode = (mode === '2v2' || mode === 'raid');
    let secondsLeft = is4PlayerMode ? 25 : 15;
    if (mmTimer) mmTimer.textContent = `00:${String(secondsLeft).padStart(2, '0')}`;
    
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
      mode: mode
    };

    console.log(`[MultiplayerManager] Queueing for ${mode.toUpperCase()} as: ${myUsername} (${this.myUid})`);

    socketManager.emit('join_matchmaking', this.lastUserData);

    this.mmInterval = setInterval(() => {
      secondsLeft--;
      const secs = String(Math.max(0, secondsLeft)).padStart(2, '0');
      if (mmTimer) mmTimer.textContent = `00:${secs}`;
      
      // If match was already found, clear timer and stop
      if (this.isPaired) {
        this.clearMatchmaking();
        return;
      }
      
      // Queue timeout: fallback to bot AI
      if (secondsLeft <= 0) {
        socketManager.emit('leave_matchmaking');
        this.fallbackToBotAI(mode, pLeader, finalDeck);
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

  startRanked1v1Matchmaking(leaderKey, deck) {
    return this.startMatchmaking('1v1', leaderKey, deck);
  }

  startSyncedMatch(pLeader, oLeader, setupObj) {
    if (typeof uiManager !== 'undefined' && uiManager) {
      const currentMode = this.mode || '1v1';
      uiManager.activeGameMode = currentMode;

      // Clean up inactive mode engines before starting a new match
      uiManager.cleanupInactiveModes(currentMode);

      if (currentMode === '2v2') {
        if (this.isHost) {
          // Host roda o engine e broadcast de estado
          uiManager.mode2v2.onNetworkSync = (state) => {
            socketManager.emit('mode_state_sync', state);
          };
          uiManager.mode2v2.onFx = (type, data) => {
            uiManager.handleFXEvent(type, data);
            socketManager.emit('mode_fx_broadcast', { mode: '2v2', type, data });
          };
          uiManager.mode2v2.startMatch(pLeader, setupObj.playerDeck || [], setupObj.allPlayers || []);
        } else {
          // Non-host: inicializa identidades dos lutadores
          uiManager.mode2v2.setPlayerIdentities(setupObj.allPlayers || []);
        }
      } else if (currentMode === 'raid') {
        if (this.isHost) {
          uiManager.modeRaid.onNetworkSync = (state) => {
            socketManager.emit('mode_state_sync', state);
          };
          uiManager.modeRaid.onFx = (type, data) => {
            uiManager.handleFXEvent(type, data);
            socketManager.emit('mode_fx_broadcast', { mode: 'raid', type, data });
          };
          uiManager.modeRaid.startRaid('cell_max', pLeader, setupObj.playerDeck || [], setupObj.allPlayers || []);
        } else {
          // Non-host: inicializa identidades dos players
          uiManager.modeRaid.setPlayerIdentities(setupObj.allPlayers || []);
        }
      } else {
        this.engine.startMatch(pLeader, oLeader, [], false, setupObj);
      }
    } else {
      this.engine.startMatch(pLeader, oLeader, [], false, setupObj);
    }
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

  fallbackToBotAI(mode = '1v1', leaderKey, deck) {
    this.clearMatchmaking();
    const mmModal = document.getElementById('matchmaking-modal');
    if (mmModal) mmModal.classList.remove('active');
    
    this.isMultiplayer = false;
    this.roomCode = null;
    try { chatManager.setRoom(null); } catch(e) { console.warn('setRoom fallback:', e); }
    
    const pLeader = leaderKey || authManager.user?.selectedLeader || 'goku';
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);
    
    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.activeGameMode = mode;

      // Clean up inactive mode engines before starting bot AI match
      uiManager.cleanupInactiveModes(mode);

      if (mode === '2v2') {
        uiManager.triggerActionBanner('BOTS Z ENCONTRADOS! DUPLA DE IA', 'act-attack', 'VS TIME BOT');
        // Reconecta onFx ao fxEngine (bot mode sem servidor)
        uiManager.mode2v2.onFx = (type, data) => uiManager.handleFXEvent(type, data);
        uiManager.mode2v2.startMatch(pLeader, finalDeck);
      } else if (mode === 'raid') {
        uiManager.triggerActionBanner('EQUIPE Z DE BOTS PRONTA! RAID INICIADO', 'act-awaken', 'VS CHEFE SUPREMO');
        // Reconecta onFx ao fxEngine (bot mode sem servidor)
        uiManager.modeRaid.onFx = (type, data) => uiManager.handleFXEvent(type, data);
        uiManager.modeRaid.startRaid('cell_max', pLeader, finalDeck);
      } else {
        uiManager.triggerActionBanner('BOT IA ENCONTRADO! BATALHA INICIADA', 'act-attack', 'VS BOT SUPREMO');
        const possibleOpponents = ['vegeta', 'frieza', 'gohan', 'piccolo', 'trunks'];
        const aiLeader = possibleOpponents[Math.floor(Math.random() * possibleOpponents.length)];
        this.engine.startMatch(pLeader, aiLeader, finalDeck, true);
      }
    }
    sceneManager.switchScene(GAME_SCENES.ARENA);
  }

  createRoom(leaderKey, deck, mode = '1v1') { return "0000"; }
  joinRoom(roomCode, leaderKey, deck) { return true; }
  startRanked2v2(leaderKey, deck) { return this.startMatchmaking('2v2', leaderKey, deck); }
  startCoOpRaid(bossId = 'cell_max', leaderKey = 'goku') { return this.startMatchmaking('raid', leaderKey, null); }
  startAiMatch(leaderKey, opponentLeaderKey, deck) {
    this.fallbackToBotAI('1v1', leaderKey, deck);
  }
}
