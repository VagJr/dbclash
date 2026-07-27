/* ==========================================================================
   Dragon Ball Clash Action TCG — Global Leaderboard Manager
   Handles Top 100 Player Rankings, Win Rates & Divisions
   ========================================================================== */

import { authManager } from './auth-manager.js';

export const MOCK_GLOBAL_LEADERBOARD = [
  { rank: 1, name: 'GOKU_BLACK_99', division: 'Grandmaster Kami', rp: 3850, wins: 240, leader: 'goku' },
  { rank: 2, name: 'PRINCE_VEGETA', division: 'Mestre Z', rp: 3420, wins: 198, leader: 'vegeta' },
  { rank: 3, name: 'BEAST_GOHAN', division: 'Mestre Z', rp: 3210, wins: 185, leader: 'gohan' },
  { rank: 4, name: 'EMPEROR_FRIEZA', division: 'Diamante Supreme', rp: 2950, wins: 162, leader: 'frieza' },
  { rank: 5, name: 'SWORD_TRUNKS', division: 'Diamante Supreme', rp: 2880, wins: 154, leader: 'trunks' },
  { rank: 6, name: 'ORANGE_PICCOLO', division: 'Platina I', rp: 2540, wins: 130, leader: 'piccolo' },
  { rank: 7, name: 'KAIOKEN_GOD', division: 'Platina I', rp: 2410, wins: 122, leader: 'goku' },
  { rank: 8, name: 'FINAL_FLASH_88', division: 'Ouro II', rp: 2150, wins: 95, leader: 'vegeta' }
];

export class LeaderboardManager {
  getTopRankings(mode = '1v1') {
    const list = [...MOCK_GLOBAL_LEADERBOARD];
    const currentUser = authManager.user;
    if (currentUser) {
      list.push({
        rank: 9,
        name: currentUser.displayName,
        division: currentUser.division,
        rp: currentUser.rankPoints,
        wins: currentUser.victories,
        leader: currentUser.selectedLeader || 'goku',
        isCurrent: true
      });
    }
    list.sort((a, b) => b.rp - a.rp);
    return list.map((item, index) => ({ ...item, rank: index + 1 }));
  }
}

export const leaderboardManager = new LeaderboardManager();
