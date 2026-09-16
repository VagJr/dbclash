import { soundEngine } from './audio.js';
import { authManager } from './auth-manager.js';

export class CharacterUnlocks {
  get unlockedLeaders() {
    return authManager.user?.unlockedLeaders || [];
  }

  isUnlocked(leaderId) {
    return this.unlockedLeaders.includes(leaderId);
  }

  async unlockCharacter(leaderId) {
    if (this.isUnlocked(leaderId)) return { success: true, alreadyUnlocked: true };

    const result = await authManager.unlockLeader(leaderId);
    if (result.success) soundEngine.playAwaken();
    return result;
  }
}

export const characterUnlocks = new CharacterUnlocks();
