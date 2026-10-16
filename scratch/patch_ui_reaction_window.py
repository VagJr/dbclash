import os

def patch_ui_reaction():
    filepath = 'c:/dbtcg/js/ui-manager.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    old_reaction = """      if (engine.state === 'ATTACK_PENDING') {
        const defending = engine.pendingAttack?.attackerKey === 'opponent';
        const hasDef = engine.hasDefensiveResponse('player');
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseText) {
          this.turnPhaseText.textContent = defending
            ? (hasDef ? i18n.t('reactionBannerDefending') : i18n.t('reactionBannerNoDef'))
            : i18n.t('reactionBannerInFlight');
        }
      }"""

    new_reaction = """      if (engine.state === 'ATTACK_PENDING') {
        const atkKey = engine.pendingAttack?.attackerKey;
        const isEnemyAttacking = atkKey === 'p2' || atkKey === 'p4' || atkKey === 'opponent';
        const hasDef = engine.hasDefensiveResponse('p1') || engine.hasDefensiveResponse('player');
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseText) {
          if (isEnemyAttacking) {
            this.turnPhaseText.textContent = hasDef 
              ? i18n.t('reactionBannerDefending') 
              : i18n.t('reactionBannerNoDef');
          } else {
            this.turnPhaseText.textContent = i18n.t('reactionBannerInFlight');
          }
        }
      }"""

    js = js.replace(old_reaction, new_reaction)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Patched UI Reaction Window logic in ui-manager.js!")

if __name__ == '__main__':
    patch_ui_reaction()
