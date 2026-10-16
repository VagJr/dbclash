import os

def update_game_engine_ai():
    filepath = 'c:/dbtcg/js/game-engine.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    # Old executeAiTurn check
    old_ai_start = """  executeAiTurn() {
    if (this.state === 'FREE_ACTION' && this.initiative === 'opponent') {
      const opp = this.opponent;
      const ply = this.player;"""

    new_ai_start = """  executeAiTurn() {
    if (this.state !== 'FREE_ACTION') return;
    const activeKey = this.initiative || 'opponent';
    if (activeKey === 'p1' || activeKey === 'player') return;

    const opp = this[activeKey] || (activeKey === 'opponent' ? this.opponent : null);
    if (!opp) {
      this._passTurn(activeKey);
      return;
    }
    const ply = this[this.getTarget(activeKey)] || this.player;"""

    js = js.replace(old_ai_start, new_ai_start)

    # Replace hardcoded 'opponent' inside executeAiTurn with activeKey
    # E.g. checkAwaken('opponent') -> checkAwaken(activeKey)
    # chargeKi('opponent') -> chargeKi(activeKey)
    # passTurn('opponent') -> passTurn(activeKey)
    # playCard('opponent', bestIndex) -> playCard(activeKey, bestIndex)
    
    old_ai_body = """      // 1. Check Leader Awakening (Priority when HP <= 50%)
      if (!opp.isAwakened && hpRatio <= 0.5) {
        this.checkAwaken('opponent');
      }

      // 2. Find all affordable cards
      const affordable = hand
        .map((card, index) => ({ card, index }))
        .filter(item => item.card && item.card.cost <= currentKi);

      // If no cards can be afforded: Charge Ki or Pass
      if (affordable.length === 0) {
        if (currentKi < 10) {
          this.chargeKi('opponent');
        } else {
          this.passTurn('opponent');
        }
        return;
      }"""

    new_ai_body = """      // 1. Check Leader Awakening (Priority when HP <= 50%)
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
      }"""

    js = js.replace(old_ai_body, new_ai_body)

    old_ai_play = """      // 4. Execute Best Tactical Action
      const best = scored[0];
      if (best) {
        this.playCard('opponent', best.index);
      } else {
        this.passTurn('opponent');
      }
    }
  }"""

    new_ai_play = """      // 4. Execute Best Tactical Action
      const best = scored[0];
      if (best) {
        this.playCard(activeKey, best.index);
      } else {
        this.passTurn(activeKey);
      }"""

    js = js.replace(old_ai_play, new_ai_play)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Updated game-engine.js AI turn loop successfully!")

if __name__ == '__main__':
    update_game_engine_ai()
