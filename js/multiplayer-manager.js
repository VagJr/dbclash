/* ==========================================================================
   Dragon Ball Clash Action TCG - Multiplayer Manager & Matchmaking
   ========================================================================== */

import { firebaseManager } from './firebase-config.js';
import { deckBuilder } from './deck-builder.js';

export class MultiplayerManager {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.roomCode = null;
    this.isHost = false;
    this.isMultiplayer = false;
  }

  createRoom(leaderKey, deck) {
    this.roomCode = firebaseManager.generateRoomCode();
    this.isHost = true;
    this.isMultiplayer = true;
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(leaderKey);
    this.engine.startMatch(leaderKey, 'vegeta', finalDeck, false);
    return this.roomCode;
  }

  joinRoom(roomCode, leaderKey, deck) {
    this.roomCode = roomCode;
    this.isHost = false;
    this.isMultiplayer = true;
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(leaderKey);
    this.engine.startMatch(leaderKey, 'goku', finalDeck, false);
    return true;
  }

  startAiMatch(leaderKey, opponentLeaderKey, deck) {
    this.isMultiplayer = false;
    this.roomCode = null;
    const pLeader = leaderKey || 'goku';
    const oLeader = opponentLeaderKey || 'vegeta';
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);
    this.engine.startMatch(pLeader, oLeader, finalDeck, true);
  }
}
