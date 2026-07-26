import re

# 1. Update ui-manager.js to remove card-reason-badge
with open('c:/dbtcg/js/ui-manager.js', 'r', encoding='utf-8') as f:
    ui_text = f.read()

# Remove reason badge line
ui_text = re.sub(r'\$\{!isPlayable && reasonText \? `<div class="card-reason-badge">\${reasonText}</div>` : \'\'\}', '', ui_text)
ui_text = re.sub(r'<div class="card-reason-badge">.*?</div>', '', ui_text)

with open('c:/dbtcg/js/ui-manager.js', 'w', encoding='utf-8') as f:
    f.write(ui_text)

# 2. Update cards.css for clean unplayable dimming and mobile hand fit
cards_css_add = """

/* ── UNPLAYABLE CARD CLEAN DIMMING ───────────────────────────────────────── */
.card.unplayable {
  opacity: 0.35 !important;
  filter: grayscale(75%) brightness(0.5) !important;
  pointer-events: auto !important; /* Enable touch gesture inspect on mobile */
  cursor: not-allowed !important;
}

.card-reason-badge {
  display: none !important;
}

/* ── MOBILE HAND RESPONSIVE FIT ──────────────────────────────────────────── */
@media (max-width: 768px) {
  .card {
    width: 82px !important;
    aspect-ratio: 5 / 7 !important;
  }
  .hand-zone .card, .hand-container .card {
    margin: 0 -14px !important;
  }
  .hand-zone, .hand-container {
    padding: 6px 0 !important;
    max-width: 100vw !important;
    overflow-x: hidden !important;
    flex-wrap: nowrap !important;
    justify-content: center !important;
  }
  .card-ki-cost {
    width: 20px !important;
    height: 20px !important;
    font-size: 0.72rem !important;
  }
  .card-title-text {
    font-size: 0.58rem !important;
  }
}

@media (max-width: 430px) {
  .card {
    width: 70px !important;
  }
  .hand-zone .card, .hand-container .card {
    margin: 0 -18px !important;
  }
}
"""

with open('c:/dbtcg/styles/cards.css', 'a', encoding='utf-8') as f:
    f.write(cards_css_add)

print('FIXED MOBILE CARDS & REMOVED CENTER TEXT BADGES SUCCESSFULLY!')
