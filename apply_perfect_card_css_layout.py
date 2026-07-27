with open('c:/dbtcg/styles/cards.css', 'r', encoding='utf-8') as f:
    css_text = f.read()

# Replace .card dimensions and full art img rules
css_text = css_text.replace('height: 170px;', 'height: 156px;')

overlay_block = """/* Full Art Image & Overlays */
.card-full-art-img {
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
  top: 3.5%;
  left: 16%;
  right: 4%;
  height: 12%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 10;
  pointer-events: none;
  overflow: hidden;
}

.card-title-text {
  font-family: var(--font-title);
  font-size: 0.62rem;
  font-weight: 900;
  color: #ffd700;
  text-transform: uppercase;
  text-shadow: 0 1px 3px #000, 0 0 4px #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1;
}

/* Lower Description Overlay Panel (Injected inside lower dark box) */
.card-desc-overlay {
  position: absolute;
  top: 67%;
  bottom: 3%;
  left: 5%;
  right: 5%;
  padding: 2px 4px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  box-sizing: border-box;
  pointer-events: none;
  z-index: 10;
  overflow: hidden;
}

.card-desc-text {
  font-size: 0.52rem;
  color: #d1d5db;
  line-height: 1.15;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}"""

# Update cards.css with perfect overlay rules
if '.card-header-banner' in css_text:
    # Replace existing rules
    import re
    css_text = re.sub(r'/\* Full Art Image & Overlays \*/.*(?=\n/\* Ki Cost)', overlay_block + '\n\n', css_text, flags=re.DOTALL)
else:
    css_text += '\n\n' + overlay_block

with open('c:/dbtcg/styles/cards.css', 'w', encoding='utf-8') as f:
    f.write(css_text)

print('Updated cards.css with perfect 100% overlay alignment!')
