with open('c:/dbtcg/js/ui-manager.js', 'r', encoding='utf-8') as f:
    text = f.read()

dev_controller_code = """
  /* ── DEV ADMIN PANEL CONTROLLER ────────────────────────────────────── */
  initDevPanel() {
    const modal = document.getElementById('dev-panel-modal');
    const openBtn = document.getElementById('open-dev-panel-btn');
    const closeBtn = document.getElementById('close-dev-modal-btn');
    const exportBtn = document.getElementById('dev-export-btn');
    const importBtn = document.getElementById('dev-import-btn');
    const resetAllBtn = document.getElementById('dev-reset-all-btn');
    const fileInput = document.getElementById('dev-import-file-input');

    if (openBtn) openBtn.onclick = () => { soundEngine.playClick(); this.openDevPanel(); };
    if (closeBtn) closeBtn.onclick = () => modal?.classList.remove('active');

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        soundEngine.playClick();
        this.openDevPanel();
      }
    });

    if (exportBtn) {
      exportBtn.onclick = () => {
        const exports = {};
        CARD_DATABASE.forEach(c => {
          const custom = localStorage.getItem(`dbtcg_custom_card_${c.id}`);
          if (custom) exports[c.id] = custom;
        });
        const blob = new Blob([JSON.stringify(exports, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dbtcg_custom_cards_backup.json';
        a.click();
      };
    }

    if (importBtn && fileInput) {
      importBtn.onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            Object.keys(data).forEach(id => {
              localStorage.setItem(`dbtcg_custom_card_${id}`, data[id]);
            });
            alert('Custom cards backup imported successfully!');
            this.renderDevPanel();
            this.renderDeckBuilder();
          } catch (err) {
            alert('Invalid backup JSON file.');
          }
        };
        reader.readAsText(file);
      };
    }

    if (resetAllBtn) {
      resetAllBtn.onclick = () => {
        if (confirm('Restaurar todas as artes de cartas para o padrão?')) {
          CARD_DATABASE.forEach(c => localStorage.removeItem(`dbtcg_custom_card_${c.id}`));
          this.renderDevPanel();
          this.renderDeckBuilder();
        }
      };
    }
  }

  openDevPanel() {
    const modal = document.getElementById('dev-panel-modal');
    if (!modal) return;
    modal.classList.add('active');
    this.renderDevPanel();
  }

  renderDevPanel() {
    const grid = document.getElementById('dev-card-list-grid');
    if (!grid) return;
    grid.innerHTML = '';

    CARD_DATABASE.forEach(card => {
      const cardBox = document.createElement('div');
      cardBox.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 10px; display: flex; gap: 10px; align-items: center;';

      const imgSrc = assetLoader.getCardImagePath(card.id);
      const isCustom = !!localStorage.getItem(`dbtcg_custom_card_${card.id}`);

      cardBox.innerHTML = `
        <div style="width: 50px; height: 70px; border-radius: 4px; overflow: hidden; background: #000; flex-shrink: 0; position: relative;">
          <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';">
          ${isCustom ? '<span style="position:absolute; top:2px; right:2px; font-size:0.5rem; background:#10b981; color:#000; padding:1px 3px; font-weight:900; border-radius:2px;">CUSTOM</span>' : ''}
        </div>
        <div style="flex-grow: 1; overflow: hidden;">
          <div style="font-weight: 800; font-size: 0.8rem; color: #ffd700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${card.name}</div>
          <div style="font-size: 0.65rem; color: #9ca3af; margin-bottom: 6px;">ID: ${card.id} | ${card.cost} Ki | ${card.type.toUpperCase()}</div>
          <div style="display: flex; gap: 6px;">
            <label class="btn-ghost" style="font-size: 0.65rem; padding: 3px 8px; cursor: pointer; border-color: #ffd700; color: #ffd700;">
              📁 Upload PNG
              <input type="file" accept="image/*" class="dev-card-file-input" data-card="${card.id}" style="display: none;">
            </label>
            ${isCustom ? `<button class="btn-ghost dev-reset-card-btn" data-card="${card.id}" style="font-size: 0.65rem; padding: 3px 8px; border-color: #ef4444; color: #ef4444;">Restaurar</button>` : ''}
          </div>
        </div>
      `;

      const input = cardBox.querySelector('.dev-card-file-input');
      if (input) {
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            localStorage.setItem(`dbtcg_custom_card_${card.id}`, evt.target.result);
            soundEngine.playClick();
            this.renderDevPanel();
            this.renderDeckBuilder();
          };
          reader.readAsDataURL(file);
        };
      }

      const resetBtn = cardBox.querySelector('.dev-reset-card-btn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          localStorage.removeItem(`dbtcg_custom_card_${card.id}`);
          soundEngine.playClick();
          this.renderDevPanel();
          this.renderDeckBuilder();
        };
      }

      grid.appendChild(cardBox);
    });
  }
"""

if 'initDevPanel()' not in text:
    text = text.replace('this.renderLeaderSelectionRoster();', 'this.renderLeaderSelectionRoster();\n    this.initDevPanel();')
    text += dev_controller_code

    with open('c:/dbtcg/js/ui-manager.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Added initDevPanel and renderDevPanel to ui-manager.js!')
