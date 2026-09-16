/* ==========================================================================
   Dragon Ball Clash Action TCG - Single Account Authority
   Server-authenticated accounts + guest-only local cache.
   ========================================================================== */

import {
  DEFAULT_UNLOCKED_LEADERS,
  createDefaultInventory,
  inventoryToOwnedCards,
  migrateLegacyInventory,
  validateDeck,
  craftCardState,
  unlockLeaderState,
  openPackState,
  rollPack
} from './economy-rules.js';
import { getStarterDeckForLeader } from './card-database.js';
import { socketManager } from './socket-config.js';

export class AuthManager {
  constructor() {
    this.storageKey = 'dbtcg_user_account';
    this.tokenKey = 'dbtcg_session_token';
    this.user = null;
    this.token = null;
    this.initLocalUser();
  }

  getServerUrl() {
    if (socketManager?.serverUrl) return socketManager.serverUrl;
    if (typeof window !== 'undefined' && window.SERVER_URL) return window.SERVER_URL;
    return 'https://dbclash-server.onrender.com';
  }

  get isLoggedIn() {
    return !!(this.user && !this.user.isGuest && this.token);
  }

  initLocalUser() {
    if (typeof localStorage === 'undefined') {
      this.createGuestUser();
      return;
    }

    try {
      const savedUser = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      const token = localStorage.getItem(this.tokenKey);

      // Never resurrect an old "logged account" without a signed session.
      if (savedUser && !savedUser.isGuest && token) {
        this.user = this.normalizeUser(savedUser);
        this.token = token;
        return;
      }

      if (savedUser?.isGuest) {
        this.user = this.normalizeUser(savedUser);
        this.token = null;
        this.saveLocalCache();
        return;
      }
    } catch {}

    this.createGuestUser();
  }

  normalizeUser(raw = {}) {
    const unlockedLeaders = Array.isArray(raw.unlockedLeaders) && raw.unlockedLeaders.length
      ? [...new Set(raw.unlockedLeaders)]
      : [...DEFAULT_UNLOCKED_LEADERS];

    const cardInventory = migrateLegacyInventory({ ...raw, unlockedLeaders });

    return {
      uid: raw.uid || `guest_${Date.now()}`,
      displayName: raw.displayName || 'Guest Fighter',
      email: raw.email || '',
      isGuest: raw.isGuest !== false,
      level: Math.max(1, Number(raw.level) || 1),
      xp: Math.max(0, Number(raw.xp) || 0),
      rankPoints: Math.max(0, Number(raw.rankPoints) || 1000),
      division: raw.division || 'Bronze I',
      victories: Math.max(0, Number(raw.victories) || 0),
      losses: Math.max(0, Number(raw.losses) || 0),
      unlockedLeaders,
      selectedLeader: unlockedLeaders.includes(raw.selectedLeader) ? raw.selectedLeader : unlockedLeaders[0],
      customDecks: raw.customDecks && typeof raw.customDecks === 'object' ? raw.customDecks : {},
      cardInventory,
      ownedCards: inventoryToOwnedCards(cardInventory),
      raidTrophies: Math.max(0, Number(raw.raidTrophies) || 0),
      zeni: Math.max(0, Number(raw.zeni) || 0),
      gems: Math.max(0, Number(raw.gems) || 0),
      dust: Math.max(0, Number(raw.dust) || 0),
      dojoId: raw.dojoId || null,
      dailyQuests: raw.dailyQuests && typeof raw.dailyQuests === 'object' ? raw.dailyQuests : {},
      createdAt: raw.createdAt || new Date().toISOString()
    };
  }

  createGuestUser() {
    const uid = `guest_${Math.floor(100000 + Math.random() * 900000)}`;
    const unlockedLeaders = [...DEFAULT_UNLOCKED_LEADERS];
    const cardInventory = createDefaultInventory(unlockedLeaders);

    this.user = {
      uid,
      displayName: `Guerreiro Z ${uid.slice(-4)}`,
      email: '',
      isGuest: true,
      level: 1,
      xp: 0,
      rankPoints: 1000,
      division: 'Bronze I',
      victories: 0,
      losses: 0,
      unlockedLeaders,
      selectedLeader: 'goku',
      customDecks: {},
      cardInventory,
      ownedCards: inventoryToOwnedCards(cardInventory),
      raidTrophies: 0,
      zeni: 1500,
      gems: 10,
      dust: 300,
      dojoId: null,
      dailyQuests: {},
      createdAt: new Date().toISOString()
    };
    this.token = null;
    this.saveLocalCache();
    return this.user;
  }

  saveLocalCache() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.storageKey, JSON.stringify(this.user));
      if (this.token) localStorage.setItem(this.tokenKey, this.token);
      else localStorage.removeItem(this.tokenKey);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dbclash-auth-changed', {
          detail: { token: this.token || null }
        }));
      }
    } catch {}
  }

  logout() {
    this.token = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.storageKey);
    }
    this.createGuestUser();
  }

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${this.getServerUrl()}${path}`, { ...options, headers });
    let data = {};
    try { data = await response.json(); } catch {}

    if (response.status === 401 && this.token) {
      this.logout();
    }

    return { response, data };
  }

  async login(email, password) {
    if (!email || !password) return { success: false, message: 'Digite e-mail e senha!' };

    try {
      const { data } = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password })
      });

      if (!data.success || !data.user || !data.token) {
        return { success: false, message: data.message || 'Credenciais invalidas.' };
      }

      this.user = this.normalizeUser(data.user);
      this.user.isGuest = false;
      this.token = data.token;
      this.saveLocalCache();
      return { success: true, user: this.user };
    } catch {
      return { success: false, message: 'Servidor indisponivel. Login online nao pode ser simulado localmente.' };
    }
  }

  async signUp(displayName, email, password) {
    if (!displayName || !email || !password) return { success: false, message: 'Preencha todos os campos!' };

    try {
      const { data } = await this.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          password
        })
      });

      if (!data.success || !data.user || !data.token) {
        return { success: false, message: data.message || 'Erro ao criar conta.' };
      }

      this.user = this.normalizeUser(data.user);
      this.user.isGuest = false;
      this.token = data.token;
      this.saveLocalCache();
      return { success: true, user: this.user };
    } catch {
      return { success: false, message: 'Servidor indisponivel. Cadastro online nao pode ser criado localmente.' };
    }
  }

  async refreshProfile() {
    if (!this.isLoggedIn) return { success: false, message: 'Conta online nao autenticada.' };
    try {
      const { data } = await this.request('/api/user/me');
      if (!data.success || !data.user) return { success: false, message: data.message || 'Falha ao atualizar perfil.' };
      this.user = this.normalizeUser(data.user);
      this.user.isGuest = false;
      this.saveLocalCache();
      return { success: true, user: this.user };
    } catch {
      return { success: false, message: 'Servidor indisponivel.' };
    }
  }

  async updatePreferences(patch = {}) {
    const allowed = {};
    if (typeof patch.selectedLeader === 'string') allowed.selectedLeader = patch.selectedLeader;
    if (patch.customDecks && typeof patch.customDecks === 'object') allowed.customDecks = patch.customDecks;

    if (this.user.isGuest) {
      if (allowed.selectedLeader && this.user.unlockedLeaders.includes(allowed.selectedLeader)) {
        this.user.selectedLeader = allowed.selectedLeader;
      }
      if (allowed.customDecks) this.user.customDecks = allowed.customDecks;
      this.saveLocalCache();
      return { success: true, user: this.user };
    }

    try {
      const { data } = await this.request('/api/user/preferences', {
        method: 'PATCH',
        body: JSON.stringify(allowed)
      });
      if (!data.success || !data.user) return { success: false, message: data.message || 'Falha ao salvar preferencias.' };
      this.user = this.normalizeUser(data.user);
      this.user.isGuest = false;
      this.saveLocalCache();
      return { success: true, user: this.user };
    } catch {
      return { success: false, message: 'Servidor indisponivel.' };
    }
  }

  getCardCount(cardId) {
    return Math.max(0, Number(this.user?.cardInventory?.[cardId]) || 0);
  }

  getDeckForLeader(leaderId) {
    const custom = this.user?.customDecks?.[leaderId];
    const validation = validateDeck(custom, this.user?.cardInventory, leaderId, this.user?.unlockedLeaders || []);
    return validation.ok ? [...custom] : getStarterDeckForLeader(leaderId);
  }

  async saveDeck(leaderId, deck) {
    const validation = validateDeck(deck, this.user.cardInventory, leaderId, this.user.unlockedLeaders);
    if (!validation.ok) return { success: false, message: validation.message, code: validation.code };

    if (this.user.isGuest) {
      this.user.customDecks = { ...(this.user.customDecks || {}), [leaderId]: [...deck] };
      this.saveLocalCache();
      return { success: true, user: this.user, deck: [...deck] };
    }

    try {
      const { data } = await this.request('/api/deck/save', {
        method: 'POST',
        body: JSON.stringify({ leaderId, deck })
      });
      if (!data.success || !data.user) return { success: false, message: data.message || 'Falha ao salvar deck.' };
      this.user = this.normalizeUser(data.user);
      this.user.isGuest = false;
      this.saveLocalCache();
      return { success: true, user: this.user, deck: data.deck };
    } catch {
      return { success: false, message: 'Servidor indisponivel.' };
    }
  }

  async craftCard(cardId) {
    if (this.user.isGuest) {
      const result = craftCardState(this.user, cardId);
      if (!result.ok) return { success: false, code: result.code, cost: result.cost };
      Object.assign(this.user, result);
      this.saveLocalCache();
      return { success: true, user: this.user, cardId };
    }

    try {
      const { data } = await this.request('/api/economy/craft', {
        method: 'POST',
        body: JSON.stringify({ cardId })
      });
      if (!data.success || !data.user) return { success: false, message: data.message, code: data.code };
      this.user = this.normalizeUser(data.user);
      this.user.isGuest = false;
      this.saveLocalCache();
      return { success: true, user: this.user, cardId };
    } catch {
      return { success: false, message: 'Servidor indisponivel.' };
    }
  }

  async unlockLeader(leaderId) {
    if (this.user.isGuest) {
      const result = unlockLeaderState(this.user, leaderId);
      if (!result.ok) return { success: false, code: result.code, cost: result.cost };
      Object.assign(this.user, result);
      this.saveLocalCache();
      return { success: true, user: this.user, leaderId };
    }

    try {
      const { data } = await this.request('/api/economy/unlock-leader', {
        method: 'POST',
        body: JSON.stringify({ leaderId })
      });
      if (!data.success || !data.user) return { success: false, message: data.message, code: data.code };
      this.user = this.normalizeUser(data.user);
      this.user.isGuest = false;
      this.saveLocalCache();
      return { success: true, user: this.user, leaderId };
    } catch {
      return { success: false, message: 'Servidor indisponivel.' };
    }
  }

  _guestRandom() {
    if (globalThis.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      globalThis.crypto.getRandomValues(arr);
      return arr[0] / 4294967296;
    }
    return Math.random();
  }

  async openPack() {
    if (this.user.isGuest) {
      const cards = rollPack(() => this._guestRandom());
      const result = openPackState(this.user, cards);
      if (!result.ok) return { success: false, code: result.code, cost: result.cost };
      Object.assign(this.user, result);
      this.saveLocalCache();
      return { success: true, user: this.user, cards, results: result.results };
    }

    try {
      const { data } = await this.request('/api/economy/open-pack', {
        method: 'POST',
        body: '{}'
      });
      if (!data.success || !data.user) return { success: false, message: data.message, code: data.code };
      this.user = this.normalizeUser(data.user);
      this.user.isGuest = false;
      this.saveLocalCache();
      return { success: true, user: this.user, cards: data.cards, results: data.results };
    } catch {
      return { success: false, message: 'Servidor indisponivel.' };
    }
  }

  async fetchLeaderboard() {
    try {
      const { data } = await this.request('/api/leaderboard');
      return data.success ? data.leaderboard : [];
    } catch {
      return [];
    }
  }

  // Ranked progression is server-owned. Guest AI results may remain local.
  recordMatchResult(isWin, rankPointsDelta = 25) {
    if (!this.user?.isGuest) return false;
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
    this.saveLocalCache();
    return true;
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
