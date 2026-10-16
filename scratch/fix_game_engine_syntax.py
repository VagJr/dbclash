import os

def fix_game_engine():
    filepath = 'c:/dbtcg/js/game-engine.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    # Find executeAiTurn and replace it completely with the clean version
    ai_turn_code = """  // ── OFFICIAL DRAGON BALL ARCADE TACTICAL AI ENGINE ─────────────────────────────
  executeAiTurn() {
    if (this.state === 'FREE_ACTION') {
      const activeKey = this.initiative || 'opponent';
      if (activeKey === 'p1' || activeKey === 'player') return;

      const opp = this[activeKey] || (activeKey === 'opponent' ? this.opponent : null);
      if (!opp || !opp.hand) {
        this._passTurn(activeKey);
        return;
      }
      const ply = this[this.getTarget(activeKey)] || this.player;

      const hand = opp.hand;
      const currentKi = opp.ki;
      const currentHp = opp.hp;
      const maxHp = opp.maxHp || 400;
      const hpRatio = currentHp / maxHp;

      // 1. Check Leader Awakening (Priority when HP <= 50%)
      if (!opp.isAwakened && hpRatio <= 0.5) {
        this.checkAwaken(activeKey);
      }

      // 2. Find all affordable cards
      const affordable = hand
        .map((card, index) => ({ card, index }))
        .filter(item => item.card && item.card.cost <= currentKi);

      // If no cards can be afforded: Charge Ki or Pass
      if (affordable.length === 0) {
        if (currentKi < 10) {
          this.chargeKi(activeKey);
        } else {
          this.passTurn(activeKey);
        }
        return;
      }

      // 3. Advanced Tactical Card Evaluation System (Tactical Scoring)
      const scored = affordable.map(item => {
        const c = item.card;
        let score = 10; // base score

        // A. Healing / Recovery (High priority when HP is low)
        if (c.heal > 0 || (c.type && c.type.includes('support')) || (c.name && (c.name.includes('Senzu') || c.name.includes('Cura')))) {
          if (hpRatio <= 0.35) score += 180;
          else if (hpRatio <= 0.65) score += 90;
          else score += 15;
        }

        // B. Power-Up / Ki Gain / Stat Boosts
        if (c.kiGain > 0 || c.powerUp > 0 || c.type === 'boost') {
          score += 65;
        }

        // C. Attack Cards (Strikes, Blasts, Super Specials)
        if (c.type === 'attack' || c.damage > 0 || c.isBeam) {
          const dmg = c.damage || 40;
          score += dmg;

          // Target Player Weakness: Open Guard or Low HP
          if (ply && ply.shields === 0) {
            score += 35; // Extra incentive to strike when open guard
          }

          // Lethal Finisher Potential
          if (ply && ply.hp <= dmg + 40) {
            score += 250; // FINISHER COMBO!
          }

          // Iconic Specials / Beams
          if (c.isBeam || c.rarity === 'super-rare') {
            score += 50;
          }
        }

        // D. Efficiency Modifier (Damage output per Ki cost)
        if (c.cost > 0 && c.damage > 0) {
          score += (c.damage / c.cost) * 12;
        }

        return { ...item, score };
      });

      // Sort cards by highest tactical score
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];

      // Smart Ki Charging: If best available card has low tactical value and Ki <= 5, charge Ki to set up Kamehameha/Special next turn!
      if (best && best.score < 40 && currentKi <= 5 && Math.random() > 0.25) {
        this.chargeKi(activeKey);
        return;
      }

      if (best) {
        this.playCard(activeKey, best.index);
      } else {
        this.passTurn(activeKey);
      }

    } else if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
      const opp = this.opponent;
      if (!opp || !opp.hand) return;
      const currentKi = opp.ki;

      // Smart Counter & Defense Selection
      const defCards = opp.hand
        .map((card, index) => ({ card, index }))
        .filter(item => item.card && (item.card.type === 'evade' || item.card.type === 'defense' || item.card.isBeam) && item.card.cost <= currentKi);

      if (defCards.length > 0) {
        // Prioritize Beam counter if incoming attack is a Beam
        const incomingIsBeam = this.pendingAttack?.card?.isBeam;
        let chosenDef = defCards[0];

        if (incomingIsBeam) {
          const beamCounter = defCards.find(item => item.card.isBeam);
          if (beamCounter) chosenDef = beamCounter;
        }

        this.playCard('opponent', chosenDef.index);
      } else {
        // AI has no reaction card available: resolve attack after short delay
        setTimeout(() => {
          if (this.state === 'ATTACK_PENDING') {
            this.clearReactionTimer();
            this.resolveUnansweredAttack();
          }
        }, 800);
      }
    }
  }
}"""

    idx = js.find("// ── OFFICIAL DRAGON BALL ARCADE TACTICAL AI ENGINE ─────────────────────────────")
    if idx != -1:
        js = js[:idx] + ai_turn_code + "\n"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Fixed executeAiTurn syntax in game-engine.js!")

if __name__ == '__main__':
    fix_game_engine()
