/* ==========================================================================
   Dragon Ball Clash Action TCG - Account Management & Auth Database Engine
   ========================================================================== */

export class AuthDatabase {
  constructor() {
    const hasStorage = typeof localStorage !== 'undefined';
    this.currentUser = hasStorage ? (JSON.parse(localStorage.getItem('dbtcg_user') || 'null')) : null;
    this.users = hasStorage ? (JSON.parse(localStorage.getItem('dbtcg_users_db') || '{}')) : {};
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }

  getCurrentUser() {
    if (!this.currentUser) {
      // Default Guest Account
      return {
        username: 'Guest Fighter',
        isGuest: true,
        zeni: 1500,
        dust: 300,
        unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
        wins: 0,
        losses: 0
      };
    }
    return this.currentUser;
  }

  register(username, password) {
    if (!username || !password) return { success: false, msg: 'Username & Password required' };
    const cleanUser = username.trim();
    
    if (this.users[cleanUser]) {
      return { success: false, msg: 'Username already exists!' };
    }

    const newUser = {
      username: cleanUser,
      password: btoa(password), // Simple encoding for local lightweight DB
      isGuest: false,
      zeni: 2000,
      dust: 500,
      unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
      wins: 0,
      losses: 0,
      createdAt: new Date().toISOString()
    };

    this.users[cleanUser] = newUser;
    this.saveDB();

    this.currentUser = newUser;
    this.saveSession();

    return { success: true, user: newUser, msg: 'Account created successfully!' };
  }

  login(username, password) {
    if (!username || !password) return { success: false, msg: 'Username & Password required' };
    const cleanUser = username.trim();

    const user = this.users[cleanUser];
    if (!user || user.password !== btoa(password)) {
      return { success: false, msg: 'Invalid Username or Password!' };
    }

    this.currentUser = user;
    this.saveSession();

    return { success: true, user: this.currentUser, msg: 'Welcome back!' };
  }

  loginAsGuest() {
    this.currentUser = {
      username: `Guest_${Math.floor(1000 + Math.random() * 9000)}`,
      isGuest: true,
      zeni: 1500,
      dust: 300,
      unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
      wins: 0,
      losses: 0
    };
    this.saveSession();
    return this.currentUser;
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('dbtcg_user');
  }

  updateProfileStats(statsUpdate) {
    if (!this.currentUser) return;
    this.currentUser = { ...this.currentUser, ...statsUpdate };
    
    if (!this.currentUser.isGuest) {
      this.users[this.currentUser.username] = this.currentUser;
      this.saveDB();
    }
    
    this.saveSession();
  }

  saveSession() {
    localStorage.setItem('dbtcg_user', JSON.stringify(this.currentUser));
  }

  saveDB() {
    localStorage.setItem('dbtcg_users_db', JSON.stringify(this.users));
  }
}

export const authDatabase = new AuthDatabase();
