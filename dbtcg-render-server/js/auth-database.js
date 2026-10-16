/* ==========================================================================
   Dragon Ball Clash Action TCG - Account Management & Auth Database Engine
   Unified Bridge to MongoDB Cloud AuthManager
   ========================================================================== */

import { authManager } from './auth-manager.js';

export class AuthDatabase {
  isLoggedIn() {
    return authManager.isLoggedIn;
  }

  getCurrentUser() {
    if (!authManager.user) {
      return {
        username: 'Guest Fighter',
        displayName: 'Guest Fighter',
        isGuest: true,
        zeni: 1500,
        unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
        victories: 0,
        losses: 0
      };
    }
    return authManager.user;
  }

  async register(username, password) {
    const email = username.includes('@') ? username : username.toLowerCase() + '@dbtcg.local';
    return await authManager.signUp(username, email, password);
  }

  async login(username, password) {
    const email = username.includes('@') ? username : username.toLowerCase() + '@dbtcg.local';
    return await authManager.login(email, password);
  }

  loginAsGuest() {
    authManager.createGuestUser();
    return authManager.user;
  }

  logout() {
    authManager.createGuestUser();
  }

  updateProfileStats(statsUpdate) {
    if (!authManager.user) return;
    authManager.user = { ...authManager.user, ...statsUpdate };
    authManager.saveUser();
  }
}

export const authDatabase = new AuthDatabase();
