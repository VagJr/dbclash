/* ==========================================================================
   Dragon Ball Clash Action TCG — Authentication & Account Manager
   Handles MongoDB Atlas Cloud Auth, Login, Sign-Up, Progress Sync & Local Cache
   ========================================================================== */

import { getStarterDeckForLeader } from './card-database.js';

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

  getServerUrl() {
    if (typeof socketManager !== 'undefined' && socketManager && socketManager.serverUrl) {
      return socketManager.serverUrl;
    }
    if (typeof window !== 'undefined' && window.SERVER_URL) return window.SERVER_URL;
    return 'https://dbclash-server.onrender.com';
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
      zeni: 500,
      gems: 10,
      createdAt: new Date().toISOString()
    };
    this.saveUser();
  }

  saveUser() {
    if (!this.user) return;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.user));
      }
      // If logged in with real MongoDB user, sync to cloud asynchronously
      if (!this.user.isGuest && this.user.uid) {
        const serverUrl = this.getServerUrl();
        fetch(`${serverUrl}/api/user/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: this.user.uid, userData: this.user })
        }).catch(err => console.warn('[AuthManager] Cloud sync fallback:', err.message));
      }
    } catch(e) {}
  }

  async login(email, password) {
    if (!email || !password) return { success: false, message: 'Digite e-mail e senha!' };
    try {
      const serverUrl = this.getServerUrl();
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.user = data.user;
        this.saveUser();
        return { success: true, user: this.user };
      } else {
        return { success: false, message: data.message || 'Erro ao realizar login.' };
      }
    } catch (err) {
      console.warn('[AuthManager] Online login failed, attempting local fallback:', err);
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
  }

  async signUp(displayName, email, password) {
    if (!email || !password || !displayName) {
      return { success: false, message: 'Preencha todos os campos!' };
    }
    try {
      const serverUrl = this.getServerUrl();
      const res = await fetch(`${serverUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          initialData: {
            ownedCards: this.user ? this.user.ownedCards : this.getDefaultOwnedCards(),
            unlockedLeaders: this.user ? this.user.unlockedLeaders : ['goku', 'vegeta', 'gohan', 'frieza'],
            selectedLeader: this.user ? this.user.selectedLeader : 'goku',
            customDecks: this.user ? this.user.customDecks : {},
            zeni: this.user ? (this.user.zeni || 500) : 500,
            gems: this.user ? (this.user.gems || 10) : 10
          }
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.user = data.user;
        this.saveUser();
        return { success: true, user: this.user };
      } else {
        return { success: false, message: data.message || 'Erro ao criar conta.' };
      }
    } catch (err) {
      console.warn('[AuthManager] Online signup failed, using local registration:', err);
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
        zeni: 500,
        gems: 10,
        createdAt: new Date().toISOString()
      };
      this.saveUser();
      return { success: true, user: this.user };
    }
  }

  async fetchLeaderboard() {
    try {
      const serverUrl = this.getServerUrl();
      const res = await fetch(`${serverUrl}/api/leaderboard`);
      const data = await res.json();
      if (data.success) return data.leaderboard;
      return [];
    } catch (err) {
      return [];
    }
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
    this.saveUser();
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
