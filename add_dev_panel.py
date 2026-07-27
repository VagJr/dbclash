import os
import re

# 1. Update index.html
with open('c:/dbtcg/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

dev_modal_html = """
  <!-- ═══ DEV ADMIN PANEL MODAL ═══ -->
  <div id="dev-panel-modal" class="modal-overlay">
    <div class="glass modal-box" style="max-width: 980px; width: 92%; max-height: 88vh; overflow-y: auto; text-align: left; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.3); padding-bottom: 12px; margin-bottom: 16px;">
        <h2 style="color: #ffd700; font-size: 1.3rem; font-weight: 900; margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>🛠️</span> <span>Painel Dev — Upload & Injeção de Cartas TCG</span>
        </h2>
        <button id="close-dev-modal-btn" class="btn-ghost" style="padding: 4px 14px; font-size: 0.9rem; color: #ef4444; border-color: #ef4444;">✕ Fechar</button>
      </div>
      
      <p style="color: #d1d5db; font-size: 0.82rem; margin-bottom: 16px; line-height: 1.4;">
        Envie imagens PNG para qualquer carta da lista oficial. A nova imagem é injetada instantaneamente na carta in-game com nome, Ki e poder aplicados automaticamente por Canva/CSS!
      </p>

      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
        <button id="dev-export-btn" class="btn-ki" style="font-size: 0.78rem; padding: 8px 14px;">📥 Exportar Backup (JSON)</button>
        <button id="dev-import-btn" class="btn-ghost" style="font-size: 0.78rem; padding: 8px 14px; border-color: #3b82f6; color: #3b82f6;">📤 Importar Backup (JSON)</button>
        <button id="dev-reset-all-btn" class="btn-ghost" style="font-size: 0.78rem; padding: 8px 14px; border-color: #ef4444; color: #ef4444;">🔄 Restaurar Imagens Padrão</button>
        <input type="file" id="dev-import-file-input" accept="application/json" style="display: none;">
      </div>

      <div id="dev-card-list-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;"></div>
    </div>
  </div>
"""

if 'dev-panel-modal' not in html:
    html = html.replace('<!-- ═══ K.O. Modal ═══ -->', dev_modal_html + '\n  <!-- ═══ K.O. Modal ═══ -->')
    
    # Add Dev button in header
    header_btn = '<button id="open-dev-panel-btn" class="btn-ghost" style="font-size:0.75rem; padding:4px 10px; border-color:#ffd700; color:#ffd700; margin-left:8px;">🛠️ Dev Panel</button>'
    html = html.replace('<div class="header-right">', '<div class="header-right">\n        ' + header_btn)

    with open('c:/dbtcg/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('Added Dev Panel modal and button to index.html!')

# 2. Update asset-loader.js to check localStorage for custom card images
with open('c:/dbtcg/js/asset-loader.js', 'r', encoding='utf-8') as f:
    al_text = f.read()

old_get = 'getCardImagePath(cardId) {\n    return `assets/cards/${cardId}.png`;\n  }'
new_get = '''getCardImagePath(cardId) {
    const custom = localStorage.getItem(`dbtcg_custom_card_${cardId}`);
    if (custom) return custom;
    return `assets/cards/${cardId}.png`;
  }'''

if old_get in al_text:
    al_text = al_text.replace(old_get, new_get)
    with open('c:/dbtcg/js/asset-loader.js', 'w', encoding='utf-8') as f:
        f.write(al_text)
    print('Updated asset-loader.js to support custom card image uploads!')

print('Completed script execution!')
