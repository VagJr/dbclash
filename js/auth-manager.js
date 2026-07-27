/* ==========================================================================
   Dragon Ball Clash Action TCG — Authentication & Account Manager
   Handles Login, Sign-Up, Guest Auth, Cloud Save & Progress Sync
   ========================================================================== */

import { getStarterDeckForLeader } from './card-database.js';
import { db } from './firebase-config.js';
import { ref, set } from 'firebase/database';

export class AuthManager {
  constructor() {
    this.user = null;
    this.storageKey = 'dbtcg_user_account';
    this.initLocalUser();
  }

  initLocalUser() {
    if (typeof localStorage === 'undefined') {
      this.createGuestUser();
      return;
    }
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.user = JSON.parse(saved);
      } catch (e) {
        this.createGuestUser();
      }
    } else {
      this.createGuestUser();
    }
  }

  getDefaultOwnedCards() {
    const starterGoku = getStarterDeckForLeader('goku') || [];
    const starterVegeta = getStarterDeckForLeader('vegeta') || [];
    const starterGohan = getStarterDeckForLeader('gohan') || [];
    const starterFrieza = getStarterDeckForLeader('frieza') || [];
    const starterPiccolo = getStarterDeckForLeader('piccolo') || [];
    const starterTrunks = getStarterDeckForLeader('trunks') || [];
    const setOwned = new Set([
      ...starterGoku,
      ...starterVegeta,
      ...starterGohan,
      ...starterFrieza,
      ...starterPiccolo,
      ...starterTrunks
    ]);
    return Array.from(setOwned);
  }

  get isLoggedIn() {
    return this.user && !this.user.isGuest;
  }

  addCardToInventory(cardId) {
    if (!this.user) return;
    if (!this.user.ownedCards) this.user.ownedCards = this.getDefaultOwnedCards();
    if (!this.user.ownedCards.includes(cardId)) {
      this.user.ownedCards.push(cardId);
      this.saveUser();
    }
  }

  createGuestUser() {
    const guestId = 'guest_' + Math.floor(100000 + Math.random() * 900000);
    this.user = {
      uid: guestId,
      displayName: `Guerreiro Z ${guestId.slice(-4)}`,
      email: `${guestId}@dbtcg.local`,
      isGuest: true,
      level: 1,
      xp: 0,
      rankPoints: 1000,
      division: 'Bronze I',
      victories: 0,
      losses: 0,
      unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
      selectedLeader: 'goku',
      customDecks: {},
      ownedCards: this.getDefaultOwnedCards(),
      raidTrophies: 0,
      createdAt: new Date().toISOString()
    };
    this.saveUser();
  }

  saveUser() {
    if (this.user && typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(this.user));
    }
  }

  login(email, password) {
    if (!email) return { success: false, message: 'Digite um email válido!' };
    const username = email.split('@')[0];
    this.user = {
      ...this.user,
      displayName: username.toUpperCase(),
      email,
      isGuest: false
    };
    this.saveUser();
    return { success: true, user: this.user };
  }

  signUp(displayName, email, password) {
    if (!email || !displayName) return { success: false, message: 'Preencha todos os campos!' };
    this.user = {
      uid: 'user_' + Date.now(),
      displayName: displayName.trim(),
      email: email.trim(),
      isGuest: false,
      level: 1,
      xp: 0,
      rankPoints: 1000,
      division: 'Bronze I',
      victories: 0,
      losses: 0,
      unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
      selectedLeader: 'goku',
      customDecks: {},
      ownedCards: this.getDefaultOwnedCards(),
      raidTrophies: 0,
      createdAt: new Date().toISOString()
    };
    this.saveUser();
    return { success: true, user: this.user };
  }

  recordMatchResult(isWin, rankPointsDelta = 25) {
    if (!this.user) return;
    if (isWin) {
      this.user.victories += 1;
      this.user.rankPoints += rankPointsDelta;
      this.user.xp += 150;
    } else {
      this.user.losses += 1;
      this.user.rankPoints = Math.max(0, this.user.rankPoints - Math.floor(rankPointsDelta * 0.6));
      this.user.xp += 50;
    }
    this.updateDivision();
    this.updateDivision();
    this.saveUser();
  }

  saveUser() {
    if (!this.user) return;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.user));
      }
      if (db && !this.user.isGuest) {
        set(ref(db, `users/${this.user.uid}`), this.user);
      }
    } catch(e) {}
  }

  updateDivision() {
    const rp = this.user.rankPoints;
    if (rp < 1200) this.user.division = 'Bronze I';
    else if (rp < 1500) this.user.division = 'Prata III';
    else if (rp < 1800) this.user.division = 'Ouro II';
    else if (rp < 2200) this.user.division = 'Platina I';
    else if (rp < 2700) this.user.division = 'Diamante Supreme';
    else if (rp < 3300) this.user.division = 'Mestre Z';
    else this.user.division = 'Grandmaster Kami';
  }
}

export const authManager = new AuthManager();
