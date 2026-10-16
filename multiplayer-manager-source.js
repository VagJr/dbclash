/* ==========================================================================
   Dragon Ball Clash Action TCG - Server Authoritative Multiplayer
   Ranked 1v1 + reconnect/resume + ordered commands
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
    this.matchId = null;
    this.isHost = false;
    this.isMultiplayer = false;
    this.mode = '1v1';
    this.opponentUid = null;
    this.mmInterval = null;
    this.isPaired = false;
    this.pendingLeaderKey = null;
    this.actionSeq = 0;
    this.latestStateVersion = -1;

    this.engine.onLocalAction = (actionType, data) => this.broadcastMove(actionType, data);
    this.initSocketListeners();
  }

  initSocketListeners() {
    socketManager.on('waiting_for_opponent', () => {
      console.log('[Multiplayer] Waiting for ranked opponent...');
    });

    socketManager.on('ranked_error', payload => {
      this.clearMatchmaking();
      const modal = document.getElementById('matchmaking-modal');
      if (modal) modal.classList.remove('active');
      if (typeof alert !== 'undefined') alert(payload?.message || 'Falha no matchmaking ranked.');
    });

    socketManager.on('match_found', payload => {
      this.enterServerMatch(payload, false);
    });

    socketManager.on('match_resumed', payload => {
      this.enterServerMatch(payload, true);
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('PARTIDA RECONECTADA', 'act-defense', 'ESTADO RESTAURADO');
      }
    });

    socketManager.on('state_update', payload => {
      if (!this.isMultiplayer || !payload) return;

      const version = Number(payload.stateVersion ?? -1);
      if (version >= 0 && version < this.latestStateVersion) return;
      if (version >= 0) this.latestStateVersion = version;

      const stateObj = this.normalizeServerState(payload);
      this.engine.applyFullSyncState(stateObj);
    });

    socketManager.on('game_fx', payload => {
      if (!this.isMultiplayer || !payload) return;
      const fxData = { ...(payload.data || {}) };

      if (!this.isHost) {
        if (fxData.attackerKey) {
          fxData.attackerKey = fxData.attackerKey === 'player' ? 'opponent' : 'player';
        }
        if (fxData.defenderKey) {
          fxData.defenderKey = fxData.defenderKey === 'player' ? 'opponent' : 'player';
        }
      }

      this.engine.fx(payload.type, fxData);
    });

    socketManager.on('opponent_reconnecting', payload => {
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner(
          'CONEXAO DO OPONENTE PERDIDA',
          'act-defense',
          `${Math.ceil((payload?.graceMs || 30000) / 1000)}s PARA RECONECTAR`
        );
      }
    });

    socketManager.on('opponent_reconnected', () => {
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('OPONENTE RECONECTADO', 'act-defense', 'PARTIDA CONTINUA');
      }
    });

    socketManager.on('ranked_result', payload => {
      if (payload?.user) {
        authManager.user = authManager.normalizeUser(payload.user);
        authManager.user.isGuest = false;
        authManager.saveLocalCache();
      }
    });

    socketManager.on('match_cancelled', payload => {
      this.leaveCurrentMatch();
      if (typeof alert !== 'undefined') {
        alert(payload?.message || 'Partida encerrada sem alteracao de ranking.');
      }
    });
  }

  normalizeServerState(payload) {
    if (this.isHost) return payload;

    const stateObj = {
      ...payload,
      player: payload.opponent,
      opponent: payload.player
    };

    if (payload.initiative === 'player') stateObj.initiative = 'opponent';
    else if (payload.initiative === 'opponent') stateObj.initiative = 'player';

    if (payload.winner === 'player') stateObj.winner = 'opponent';
    else if (payload.winner === 'opponent') stateObj.winner = 'player';

    if (payload.pendingAttack) {
      stateObj.pendingAttack = {
        ...payload.pendingAttack,
        attackerKey: payload.pendingAttack.attackerKey === 'player' ? 'opponent' : 'player'
      };
    }

    if (payload.beamClashData) {
      stateObj.beamClashData = {
        ...payload.beamClashData,
        p1Progress: 100 - payload.beamClashData.p1Progress,
        attackerKey: payload.beamClashData.attackerKey === 'player' ? 'opponent' : 'player',
        defenderKey: payload.beamClashData.defenderKey === 'player' ? 'opponent' : 'player'
      };
    }

    return stateObj;
  }

  enterServerMatch(payload, resumed) {
    this.isMultiplayer = true;
    this.isPaired = true;
    this.isHost = payload.role === 'player' || payload.isHost === true;
    this.roomCode = payload.roomCode;
    this.matchId = payload.matchId || this.matchId;
    this.opponentUid = payload.opponent?.uid || null;
    this.latestStateVersion = -1;
    this.actionSeq = Number(payload.nextActionSeq || 0);

    this.clearMatchmakingTimer();

    const modal = document.getElementById('matchmaking-modal');
    if (modal) modal.classList.remove('active');

    try { chatManager.setRoom(this.roomCode); } catch {}

    this.engine.reset();
    this.engine.isAiMatch = false;
    sceneManager.switchScene(GAME_SCENES.ARENA);

    if (payload.state) {
      this.engine.applyFullSyncState(this.normalizeServerState(payload.state));
    }

    if (!resumed && typeof uiManager !== 'undefined' && uiManager) {
      uiManager.triggerActionBanner(
        `GUERREIRO ENCONTRADO: ${payload.opponent?.username || 'RIVAL'}!`,
        'act-attack',
        'RANKED 1V1'
      );
    }
  }

  broadcastMove(actionType, data) {
    if (!this.isMultiplayer || !this.roomCode) return false;

    this.actionSeq += 1;
    return socketManager.emit('game_action', {
      action: actionType,
      data: data || {},
      seq: this.actionSeq,
      matchId: this.matchId
    });
  }

  async startRanked1v1Matchmaking(leaderKey) {
    if (!authManager.isLoggedIn) {
      if (typeof alert !== 'undefined') {
        alert('Ranked exige uma conta online autenticada.');
      }
      return false;
    }

    this.mode = 'ranked_1v1';
    this.isMultiplayer = true;
    this.isPaired = false;
    this.pendingLeaderKey = leaderKey || authManager.user?.selectedLeader || 'goku';

    socketManager.setAuthToken(authManager.token);
    const connected = await socketManager.waitForConnection();
    if (!connected) {
      this.isMultiplayer = false;
      if (typeof alert !== 'undefined') alert('Nao foi possivel conectar ao servidor ranked.');
      return false;
    }

    const modal = document.getElementById('matchmaking-modal');
    const timer = document.getElementById('mm-timer');
    const cancelBtn = document.getElementById('mm-cancel-btn');

    if (modal) modal.classList.add('active');
    if (timer) timer.textContent = '00:00';

    this.clearMatchmakingTimer();

    socketManager.emit('join_matchmaking', {
      leader: this.pendingLeaderKey
    });

    let seconds = 0;
    this.mmInterval = setInterval(() => {
      seconds += 1;
      if (timer) {
        timer.textContent =
          `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      }
    }, 1000);

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        socketManager.emit('leave_matchmaking');
        this.clearMatchmaking();
        if (modal) modal.classList.remove('active');
      };
    }

    return true;
  }

  clearMatchmakingTimer() {
    if (this.mmInterval) {
      clearInterval(this.mmInterval);
      this.mmInterval = null;
    }
  }

  clearMatchmaking() {
    this.clearMatchmakingTimer();
    this.isPaired = false;
    if (!this.roomCode) this.isMultiplayer = false;
  }

  leaveCurrentMatch() {
    this.clearMatchmakingTimer();
    this.isMultiplayer = false;
    this.isPaired = false;
    this.roomCode = null;
    this.matchId = null;
    this.opponentUid = null;
    this.latestStateVersion = -1;
    this.actionSeq = 0;
    try { chatManager.setRoom(null); } catch {}
  }

  fallbackToBotAI(leaderKey, deck) {
    this.leaveCurrentMatch();

    const modal = document.getElementById('matchmaking-modal');
    if (modal) modal.classList.remove('active');

    const pLeader = leaderKey || authManager.user?.selectedLeader || 'goku';
    const finalDeck = Array.isArray(deck) ? deck : deckBuilder.getDeckForLeader(pLeader);
    const possibleOpponents = ['vegeta', 'frieza', 'gohan', 'piccolo', 'trunks'];
    const aiLeader = possibleOpponents[Math.floor(Math.random() * possibleOpponents.length)];

    this.engine.startMatch(pLeader, aiLeader, finalDeck, true);
    sceneManager.switchScene(GAME_SCENES.ARENA);
  }

  createRoom() { return null; }
  joinRoom() { return false; }
  startRanked2v2() {
    if (typeof alert !== 'undefined') alert('2v2 sera habilitado no Release Fix 06.');
    return false;
  }

  startCoOpRaid(bossId = 'cell_max', leaderKey = 'goku') {
    this.isMultiplayer = false;
    raidEngine.startRaid(bossId, [leaderKey, 'vegeta', 'gohan'], this.engine);
    this.engine.startMatch(leaderKey, 'frieza', deckBuilder.getDeckForLeader(leaderKey), true);
    return 'RAID';
  }

  startAiMatch(leaderKey, opponentLeaderKey, deck) {
    this.leaveCurrentMatch();
    const pLeader = leaderKey || authManager.user?.selectedLeader || 'goku';
    const aiLeader = opponentLeaderKey || 'vegeta';
    const finalDeck = Array.isArray(deck) ? deck : deckBuilder.getDeckForLeader(pLeader);
    this.engine.startMatch(pLeader, aiLeader, finalDeck, true);
    sceneManager.switchScene(GAME_SCENES.ARENA);
  }
}
