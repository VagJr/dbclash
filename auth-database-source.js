/* ==========================================================================
   Legacy compatibility adapter.
   The old local password database is intentionally retired.
   ========================================================================== */

import { authManager } from './auth-manager.js';

export class AuthDatabase {
  isLoggedIn() {
    return authManager.isLoggedIn;
  }

  getCurrentUser() {
    const user = authManager.user;
    return {
      ...user,
      username: user?.displayName || 'Guest Fighter',
      wins: user?.victories || 0,
      zeni: user?.zeni || 0,
      dust: user?.dust || 0
    };
  }

  loginAsGuest() {
    return authManager.createGuestUser();
  }

  logout() {
    authManager.logout();
  }

  updateProfileStats() {
    console.warn('[AuthDatabase] updateProfileStats retired; server owns progression/economy.');
    return false;
  }

  register() {
    throw new Error('AuthDatabase.register retired. Use AuthManager.signUp().');
  }

  login() {
    throw new Error('AuthDatabase.login retired. Use AuthManager.login().');
  }
}

export const authDatabase = new AuthDatabase();
