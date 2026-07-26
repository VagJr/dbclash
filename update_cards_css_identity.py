with open('c:/dbtcg/styles/cards.css', 'r', encoding='utf-8') as f:
    text = f.read()

type_borders_css = """

/* ── UNIFIED DYNAMIC CARD TYPE BORDERS & IDENTITIES ──────────────────────── */
.card.type-attack {
  border-color: #ff3b30 !important;
  box-shadow: 0 0 12px rgba(255, 59, 48, 0.4), 0 4px 14px rgba(0, 0, 0, 0.7) !important;
}

.card.type-defense {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4), 0 4px 14px rgba(0, 0, 0, 0.7) !important;
}

.card.type-evade {
  border-color: #10b981 !important;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.4), 0 4px 14px rgba(0, 0, 0, 0.7) !important;
}

.card.type-counter {
  border-color: #8b5cf6 !important;
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.4), 0 4px 14px rgba(0, 0, 0, 0.7) !important;
}

.card.type-tech {
  border-color: #f59e0b !important;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.4), 0 4px 14px rgba(0, 0, 0, 0.7) !important;
}
"""

if 'UNIFIED DYNAMIC CARD TYPE BORDERS' not in text:
    text += type_borders_css
    with open('c:/dbtcg/styles/cards.css', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Updated cards.css with dynamic type border styles!')
