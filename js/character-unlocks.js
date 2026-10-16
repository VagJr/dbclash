/* ==========================================================================
   Dragon Ball Clash Action TCG - Character Unlock Engine
   ========================================================================== */

import { soundEngine } from './audio.js';

export class CharacterUnlocks {
  constructor() {
    this.unlockedLeaders = this.loadUnlockedLeaders();
  }

  loadUnlockedLeaders() {
    if (typeof localStorage === 'undefined') return ['goku', 'vegeta', 'gohan', 'frieza'];
    const saved = localStorage.getItem('dbtcg_unlocked_leaders');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return ['goku', 'vegeta', 'gohan', 'frieza'];
      }
    }
    return ['goku', 'vegeta', 'gohan', 'frieza'];
  }

  isUnlocked(leaderId) {
    return this.unlockedLeaders.includes(leaderId);
  }

  unlockCharacter(leaderId, cost, currentZeni, onSuccess) {
    if (this.isUnlocked(leaderId)) return true;

    if (currentZeni < cost) {
      alert(`Not enough Zeni! Required: ${cost} Zeni.`);
      return false;
    }

    this.unlockedLeaders.push(leaderId);
    localStorage.setItem('dbtcg_unlocked_leaders', JSON.stringify(this.unlockedLeaders));
    
    soundEngine.playAwaken();
    if (onSuccess) onSuccess(cost);
    return true;
  }
}

export const characterUnlocks = new CharacterUnlocks();
