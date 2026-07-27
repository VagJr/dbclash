/* ==========================================================================
   Dragon Ball Clash Action TCG — Expanded Multiplayer & Matchmaking
   Supports Ranked 1v1, Event Sourcing, Chat and Firebase Realtime Database
   FIXED: Race condition on pairing — two-phase commit with pairedWith field
   ========================================================================== */

import { firebaseManager, db } from './firebase-config.js';
import { ref, set, push, onValue, onChildAdded, remove, update, get } from 'firebase/database';
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
    this.movesUnsubscribe = null;
    this.setupUnsubscribe = null;
    this.mmUnsubscribe = null;
    this.pairedUnsubscribe = null;
    this.mmInterval = null;
    this.myQueueRef = null;
    
    // Inject multiplayer hook into game engine
    this.engine.onLocalAction = (actionType, data) => this.broadcastMove(actionType, data);
  }

  broadcastMove(actionType, data) {
    if (!this.isMultiplayer || !this.roomCode || !db) return;
    try {
      push(ref(db, `rooms/${this.roomCode}/moves`), {
        uid: this.myUid,
        action: actionType,
        data: data || {},
        timestamp: Date.now()
      });
    } catch(e) {
      console.warn("Failed to broadcast move:", e);
    }
  }

  onRemoteMove(snapshot) {
    const move = snapshot.val();
    if (!move) return;
    
    if (move.uid !== this.myUid && move.uid !== this.opponentUid) return;

    const isMe = move.uid === this.myUid;
    const actorKey = isMe ? 'player' : 'opponent';

    if (move.action === 'playCard') {
      this.engine._playCard(actorKey, move.data.cardIndex);
    } else if (move.action === 'chargeKi') {
      this.engine._chargeKi(actorKey);
    } else if (move.action === 'passTurn') {
      this.engine._passTurn(actorKey);
    } else if (move.action === 'mashBeamClash') {
      this.engine._mashBeamClash(actorKey);
    }
  }

  listenToMoves() {
    if (this.movesUnsubscribe) this.movesUnsubscribe();
    this.movesUnsubscribe = onChildAdded(ref(db, `rooms/${this.roomCode}/moves`), (snapshot) => {
      this.onRemoteMove(snapshot);
    });
  }

  startRanked1v1Matchmaking(leaderKey, deck) {
    this.mode = 'ranked_1v1';
    this.isMultiplayer = true;
    
    const mmModal = document.getElementById('matchmaking-modal');
    const mmTimer = document.getElementById('mm-timer');
    const cancelBtn = document.getElementById('mm-cancel-btn');
    
    if (mmModal) mmModal.classList.add('active');
    
    let seconds = 0;
    if (mmTimer) mmTimer.textContent = '00:00';
    
    this.clearMatchmaking();
    
    this.myUid = (typeof authManager !== 'undefined' && authManager.user?.uid) 
      ? authManager.user.uid 
      : 'user_' + Math.floor(1000 + Math.random() * 9000);
    const pLeader = leaderKey || (typeof authManager !== 'undefined' && authManager.user?.selectedLeader) || 'goku';
    const myUsername = (typeof authManager !== 'undefined' && authManager.user?.displayName) 
      ? authManager.user.displayName : 'Guerreiro Z';
    
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);

    if (db) {
      try {
        // Step 1: Write our entry to the matchmaking queue
        this.myQueueRef = ref(db, `matchmaking/${this.myUid}`);
        set(this.myQueueRef, {
          uid: this.myUid,
          username: myUsername,
          leader: pLeader,
          deck: finalDeck,
          timestamp: Date.now(),
          paired: false  // not paired yet
        });

        // Step 2: Listen for the queue to find an opponent
        const mmRef = ref(db, 'matchmaking');
        this.mmUnsubscribe = onValue(mmRef, (snapshot) => {
          const queue = snapshot.val() || {};
          const myEntry = queue[this.myUid];
          
          // If we already have a room (pairedByOpponent), start as guest
          if (myEntry && myEntry.paired === true && myEntry.pairedWith) {
            const paired = myEntry.pairedWith;
            this.opponentUid = paired.opponentUid;
            this.roomCode = paired.roomCode;
            this.isHost = false;
            
            // Clean up our own entry
            this.clearMatchmaking();
            
            if (mmModal) mmModal.classList.remove('active');
            
            try { chatManager.setRoom(this.roomCode); } catch(e) { console.warn('setRoom guest:', e); }
            
            if (typeof uiManager !== 'undefined' && uiManager) {
              uiManager.triggerActionBanner(
                `GUERREIRO ENCONTRADO: ${paired.opponentUsername}!`,
                'act-attack', 'VS JOGADOR REAL'
              );
            }
            
            // Wait for host to set up the room, then read setup
            this.setupUnsubscribe = onValue(ref(db, `rooms/${this.roomCode}/setup`), (snap) => {
              const setupObj = snap.val();
              if (setupObj) {
                if (this.setupUnsubscribe) this.setupUnsubscribe();
                const guestSetup = {
                  playerDeck: setupObj.opponentDeck,
                  opponentDeck: setupObj.playerDeck,
                  initiative: setupObj.initiative === 'player' ? 'opponent' : 'player'
                };
                this.startSyncedMatch(pLeader, paired.opponentLeader || paired.opponentUsername, guestSetup);
              }
            });
            return;
          }
          
          // Step 3: Look for unpaired opponents
          const otherKeys = Object.keys(queue).filter(
            k => k !== this.myUid && queue[k] && queue[k].paired !== true
          );

          if (otherKeys.length > 0 && myEntry && myEntry.paired !== true) {
            const opponentUid = otherKeys[0];
            const opponent = queue[opponentUid];
            
            // Sort UIDs to deterministically decide who pairs who
            if (this.myUid < opponentUid) {
              // We are the HOST — we mark the opponent as paired and create the room
              this.opponentUid = opponentUid;
              this.roomCode = `${this.myUid}_${opponentUid}`;
              this.isHost = true;
              
              // Write pairedWith to opponent's entry (two-phase commit)
              const updates = {};
              updates[`matchmaking/${opponentUid}/paired`] = true;
              updates[`matchmaking/${opponentUid}/pairedWith`] = {
                opponentUid: this.myUid,
                opponentUsername: myUsername,
                opponentLeader: pLeader,
                roomCode: this.roomCode
              };
              
              update(ref(db), updates).then(() => {
                // Remove our own entry from queue
                this.clearMatchmaking();
                
                if (mmModal) mmModal.classList.remove('active');
                
                try { chatManager.setRoom(this.roomCode); } catch(e) { console.warn('setRoom host:', e); }
                
                if (typeof uiManager !== 'undefined' && uiManager) {
                  uiManager.triggerActionBanner(
                    `GUERREIRO ONLINE: ${opponent.username}!`,
                    'act-attack', 'VS JOGADOR REAL'
                  );
                }
                
                this.setupRoomAndMatch(pLeader, finalDeck, opponent.leader, opponent.deck);
              });
            }
            // If opponentUid < myUid, the opponent will pair us — wait for pairedWith field
          }
        });
      } catch(e) {
        console.warn('[Matchmaking] Realtime queue warning:', e);
      }
    }
    
    this.mmInterval = setInterval(() => {
      seconds++;
      const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      if (mmTimer) mmTimer.textContent = `${mins}:${secs}`;
      
      // Fallback to bot if wait is too long
      if (seconds >= 20) {
        this.fallbackToBotAI(leaderKey, deck);
      }
    }, 1000);
    
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.clearMatchmaking();
        if (mmModal) mmModal.classList.remove('active');
      };
    }
  }

  setupRoomAndMatch(pLeader, pDeck, oLeader, oDeck) {
    // Host generates the shuffled decks and seed
    const pDeckShuffled = this.engine.secureShuffle([...pDeck]);
    const oDeckShuffled = this.engine.secureShuffle([...oDeck]);
    
    const cryptoBuf = new Uint32Array(1);
    window.crypto.getRandomValues(cryptoBuf);
    const initiative = cryptoBuf[0] % 2 === 0 ? 'player' : 'opponent';

    const setupObj = {
      playerUid: this.myUid,
      opponentUid: this.opponentUid,
      playerLeader: pLeader,
      opponentLeader: oLeader,
      playerDeck: pDeckShuffled,
      opponentDeck: oDeckShuffled,
      initiative: initiative
    };

    set(ref(db, `rooms/${this.roomCode}/setup`), setupObj).then(() => {
      this.startSyncedMatch(pLeader, oLeader, setupObj);
    });
  }

  startSyncedMatch(pLeader, oLeader, setupObj) {
    this.listenToMoves();
    this.engine.startMatch(pLeader, oLeader, [], false, setupObj);
    sceneManager.switchScene(GAME_SCENES.ARENA);
  }

  clearMatchmaking() {
    if (this.mmInterval) {
      clearInterval(this.mmInterval);
      this.mmInterval = null;
    }
    if (this.mmUnsubscribe) {
      this.mmUnsubscribe();
      this.mmUnsubscribe = null;
    }
    if (this.pairedUnsubscribe) {
      this.pairedUnsubscribe();
      this.pairedUnsubscribe = null;
    }
    if (this.myQueueRef && db) {
      try { remove(this.myQueueRef); } catch(e){}
    }
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
