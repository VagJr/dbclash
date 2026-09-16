import { authManager } from './auth-manager.js';

export class LeaderboardManager {
  constructor() {
    this.cache = [];
    this.lastFetchAt = 0;
    this.refreshPromise = null;
    this.refresh().catch(() => {});
  }

  async refresh(force = false) {
    const now = Date.now();
    if (!force && this.refreshPromise) return this.refreshPromise;
    if (!force && now - this.lastFetchAt < 30000 && this.cache.length) return this.cache;

    this.refreshPromise = authManager.fetchLeaderboard()
      .then(rows => {
        this.cache = (Array.isArray(rows) ? rows : []).map((row, index) => ({
          rank: index + 1,
          name: row.displayName,
          division: row.division,
          rp: row.rankPoints,
          wins: row.victories,
          losses: row.losses,
          level: row.level,
          leader: row.selectedLeader || 'goku',
          isCurrent: row.uid && row.uid === authManager.user?.uid
        }));
        this.lastFetchAt = Date.now();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dbclash-leaderboard-updated'));
        }

        return this.cache;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  getTopRankings() {
    if (Date.now() - this.lastFetchAt > 30000) this.refresh().catch(() => {});
    return [...this.cache];
  }
}

export const leaderboardManager = new LeaderboardManager();
