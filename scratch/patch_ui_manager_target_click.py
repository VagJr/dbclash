import os

def patch_ui_target_click():
    filepath = 'c:/dbtcg/js/ui-manager.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    # Add HUD click event listener in bindEvents
    old_bind = """    this.chargeKiBtn?.addEventListener('click', () => this.gameEngine.chargeKi('player'));"""

    new_bind = """    // Enemy Target Selection Click Handlers (2v2 / Raid)
    ['p2', 'p4'].forEach(prefix => {
      const box = document.getElementById(`${prefix}-leader-box`);
      box?.addEventListener('click', () => {
        if (this.gameEngine) {
          soundEngine.playClick();
          this.gameEngine.selectedTargetKey = prefix;
          ['p2', 'p4'].forEach(p => {
            const b = document.getElementById(`${p}-leader-box`);
            if (b) b.classList.remove('selected-target-lockon');
          });
          box.classList.add('selected-target-lockon');
          this.showToast(`Alvo Selecionado: ${prefix.toUpperCase()}`, '🎯');
        }
      });
    });

    this.chargeKiBtn?.addEventListener('click', () => this.gameEngine.chargeKi('player'));"""

    js = js.replace(old_bind, new_bind)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Patched target click selection in ui-manager.js!")

if __name__ == '__main__':
    patch_ui_target_click()
