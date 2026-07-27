with open('c:/dbtcg/js/ui-manager.js', 'r', encoding='utf-8') as f:
    text = f.read()

new_render_deck = """  renderDeckBuilder() {
    const container = document.getElementById('deck-builder-container');
    if (container) {
      deckBuilder.render('deck-builder-container');
      return;
    }

    if (this.deckListContainer) {
      this.deckListContainer.innerHTML = '';
      const deck = deckBuilder.getDeckForLeader(this.selectedLeader);
      deck.forEach((cardId, index) => {
        const card = getCardById(cardId);
        if (!card) return;
        const row = document.createElement('div');
        row.className = 'deck-entry';
        row.style.cssText = 'cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.04); border-radius:6px; margin-bottom:6px; border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:0.8rem; font-weight:700;';
        row.innerHTML = `
          <span class="de-title" style="display:flex; align-items:center; gap:6px;">
            <span style="color:var(--ki-yellow);">${card.cost} Ki</span>
            <span>${card.name}</span>
          </span>
          <button class="de-remove" style="background:none; border:none; color:#ef4444; font-weight:900; font-size:0.9rem; cursor:pointer;">✕</button>
        `;
        row.querySelector('.de-title').onclick = () => this.openCardInspectModal(card);
        row.querySelector('.de-remove').onclick = (e) => {
          e.stopPropagation();
          deckBuilder.removeCardFromDeck(index, this.selectedLeader);
          this.renderDeckBuilder();
        };
        this.deckListContainer.appendChild(row);
      });
    }

    if (this.collectionGrid) {
      this.collectionGrid.innerHTML = '';
      CARD_DATABASE.forEach(card => {
        const el = document.createElement('div');
        el.className = `card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''}`;
        el.style.cursor = 'pointer';
        el.innerHTML = `
          ${assetLoader.renderCardArtHTML(card)}
          <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
          <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
          ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
        `;
        el.onclick = () => {
          deckBuilder.addCardToDeck(card.id, this.selectedLeader);
          this.renderDeckBuilder();
        };
        this.collectionGrid.appendChild(el);
      });
    }
  }"""

pos = text.find('renderDeckBuilder() {')
if pos != -1:
    end_pos = text.find('\n  renderDojos() {', pos)
    if end_pos != -1:
        text = text[:pos] + new_render_deck + '\n\n  ' + text[end_pos+3:]

# Add clash mash button display toggle in renderArena
clash_toggle = """    // Beam Clash Button & Overlay
    const mashBtn = document.getElementById('clash-mash-btn');
    if (mashBtn) {
      mashBtn.style.display = engine.state === 'BEAM_CLASH' ? 'inline-block' : 'none';
    }"""

if 'clash-mash-btn' not in text or 'mashBtn' not in text:
    text = text.replace('// Hand\n    this.renderPlayerHand', clash_toggle + '\n\n    // Hand\n    this.renderPlayerHand')

with open('c:/dbtcg/js/ui-manager.js', 'w', encoding='utf-8') as out:
    out.write(text)

print('Updated ui-manager.js with dual deck rendering & beam clash button controls!')
