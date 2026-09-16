import { getCardById } from './card-database.js';
import { soundEngine } from './audio.js';
import { authManager } from './auth-manager.js';
import { PACK_COST } from './economy-rules.js';

export class PackOpener {
  constructor() {
    this.packCost = PACK_COST;
  }

  async openPack() {
    const result = await authManager.openPack();
    if (!result.success) {
      const message = result.message || (
        result.code === 'NOT_ENOUGH_ZENI'
          ? `Zeni insuficiente! Voce precisa de ${this.packCost} Zeni.`
          : 'Nao foi possivel abrir o booster.'
      );
      if (typeof alert !== 'undefined') alert(message);
      return null;
    }

    soundEngine.playKiCharge();
    const pulledCards = (result.cards || []).map(getCardById).filter(Boolean);
    soundEngine.playAwaken();
    return pulledCards;
  }
}

export const packOpener = new PackOpener();
