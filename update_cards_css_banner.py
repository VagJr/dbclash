with open('c:/dbtcg/styles/cards.css', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace .card-full-art-img and .card-desc-overlay styling
old_styles = """.card-full-art-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.card-desc-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 6px 8px;
  background: linear-gradient(to top, rgba(10,12,20,0.98) 60%, rgba(10,12,20,0.7) 85%, transparent 100%);
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  pointer-events: none;
}

.card-title-text {
  font-family: var(--font-title);
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--ki-yellow);
  text-transform: uppercase;
  text-shadow: 0 1px 3px #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}"""

new_styles = """.card-full-art-img {
  width: 100%;
  height: 100%;
  object-fit: fill !important;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  border-radius: inherit;
}

/* Upper Title Banner (Injected in upper dark field next to Ki sphere) */
.card-header-banner {
  position: absolute;
  top: 5px;
  left: 32px;
  right: 6px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 10;
  pointer-events: none;
}

.card-title-text {
  font-family: var(--font-title);
  font-size: 0.74rem;
  font-weight: 900;
  color: #ffd700;
  text-transform: uppercase;
  text-shadow: 0 1px 3px #000, 0 0 4px #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.3px;
}

/* Lower Description Overlay Panel */
.card-desc-overlay {
  position: absolute;
  bottom: 12px;
  left: 6px;
  right: 6px;
  height: 35%;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 2px;
  box-sizing: border-box;
  pointer-events: none;
  z-index: 10;
}"""

if old_styles in text:
    text = text.replace(old_styles, new_styles)
    with open('c:/dbtcg/styles/cards.css', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Updated cards.css with upper title banner and object-fit fill!')
else:
    print('Pattern not matched, writing custom replacement...')
    text = text.replace('object-fit: cover;', 'object-fit: fill !important;')
    if '.card-header-banner' not in text:
        text += '\n' + new_styles
    with open('c:/dbtcg/styles/cards.css', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Custom replacement applied to cards.css!')
