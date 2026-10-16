/* ==========================================================================
   Dragon Ball Clash Action TCG - Standalone Professional Card Studio & Maker Engine
   Full interactive suite for importing templates, fine-tuning character artwork position,
   surgical pixel alignment for Ki sphere, title, ATK/DEF, type tag, & description box,
   with direct live integration into CARD_DATABASE & active game engine.
   Standalone PNG Badges system for Ki Cost spheres & ATK/DEF power badges.
   ========================================================================== */

import { CARD_DATABASE, getCardById } from './card-database.js';
import { assetLoader } from './asset-loader.js';
import { soundEngine } from './audio.js';

export const DEFAULT_MASTER_LAYOUT = {
  artX: 0,
  artY: 0,
  artScale: 100,
  kiX: 14,
  kiY: 14,
  kiSize: 48,
  titleX: 68,
  titleY: 14,
  titleWidth: 260,
  titleFontSize: 13,
  powerX: 230,
  powerY: 436,
  powerWidth: 100,
  powerHeight: 34,
  powerFontSize: 16,
  typeX: 24,
  typeY: 350,
  typeFontSize: 11,
  descX: 20,
  descY: 366,
  descWidth: 310,
  descHeight: 62,
  descFontSize: 11
};

export class CardStudioEngine {
  constructor() {
    this.activeCardId = 'atk_01';
    this.layoutConfig = { ...DEFAULT_MASTER_LAYOUT, template: 'template_red.png', artSrc: 'assets/cards/atk_01.png' };
    this.showGrid = true;
  }

  getMasterLayout() {
    try {
      const masterSaved = localStorage.getItem('dbtcg_master_layout') || localStorage.getItem('dbtcg_card_layout_atk_01');
      if (masterSaved) {
        const parsed = JSON.parse(masterSaved);
        const { artSrc, template, kiBadgeSrc, powerBadgeSrc, ...positional } = parsed;
        return { ...DEFAULT_MASTER_LAYOUT, ...positional };
      }
    } catch (e) {}
    return { ...DEFAULT_MASTER_LAYOUT };
  }

  getAutoConfigForCard(card, master) {
    // 1. Auto Template by card category and type
    let template = 'template_red.png';
    if (card.isBeam || card.actionCategory === 'ki_blast') {
      template = 'template_beam.png';
    } else if (card.type === 'defense' || card.type === 'block' || card.actionCategory === 'defesa') {
      template = 'template_blue.png';
    } else if (card.type === 'evade' || card.type === 'counter') {
      template = 'template_roxo.png';
    } else if (card.type === 'support' || card.type === 'tech' || card.actionCategory === 'efeito') {
      template = 'template_green.png';
    } else if (card.type === 'leader') {
      template = 'template_leader.png';
    } else if (card.type === 'attack' || card.actionCategory === 'soco') {
      template = 'template_red.png';
    }

    // 2. Standalone PNG Badges for exact Ki cost & exact ATK/DEF power
    const kiBadgeSrc = `assets/badges/ki_cost_${card.cost || 0}.png`;
    const powerVal = card.power || card.block || 0;
    const powerSuffix = card.power ? 'atk' : (card.block ? 'def' : 'atk');
    const powerBadgeSrc = `assets/badges/power_${powerVal}_${powerSuffix}.png`;

    return {
      ...master,
      artSrc: `assets/cards/${card.id}.png`,
      template,
      kiBadgeSrc,
      powerBadgeSrc
    };
  }

  initStudioUI() {
    let modal = document.getElementById('card-studio-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'card-studio-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:99999; background:rgba(4,6,12,0.94); backdrop-filter:blur(10px); padding:20px; overflow-y:auto;';
      document.body.appendChild(modal);
    }
  }

  openStudio(cardId = 'atk_01') {
    this.initStudioUI();
    this.activeCardId = cardId;
    const card = getCardById(cardId) || CARD_DATABASE[0];
    
    // Load saved layout config or auto-generate for this card
    const master = this.getMasterLayout();
    const autoCfg = this.getAutoConfigForCard(card, master);

    try {
      const saved = localStorage.getItem(`dbtcg_card_layout_${cardId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.layoutConfig = {
          ...autoCfg,
          ...parsed,
          // Always enforce exact dynamic badge PNGs for the selected card!
          kiBadgeSrc: autoCfg.kiBadgeSrc,
          powerBadgeSrc: autoCfg.powerBadgeSrc,
          template: parsed.template || autoCfg.template
        };
      } else {
        this.layoutConfig = autoCfg;
      }
    } catch (e) {
      this.layoutConfig = autoCfg;
    }

    const modal = document.getElementById('card-studio-modal');
    if (!modal) return;

    const categoryText = (card.actionCategory || (card.isBeam ? 'ki_blast' : card.type)).toUpperCase();
    const powerText = card.power ? `${card.power} ATK` : (card.block ? `${card.block} DEF` : 'SUPPORTO');

    modal.innerHTML = `
      <div class="card-studio-wrapper glass" style="max-width:1280px; margin:0 auto; padding:24px; border-radius:16px; border:1px solid rgba(255,215,0,0.3); background:rgba(12,17,29,0.96); box-shadow:0 12px 40px rgba(0,0,0,0.9);">
        
        <!-- Studio Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:16px; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-family:var(--font-title); color:#ffd700; font-size:1.4rem; font-weight:900; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
              🎨 Estúdio Maker 4K (Badges PNG & Auto-Template)
              <span style="font-size:0.75rem; background:rgba(255,215,0,0.15); color:#ffd700; border:1px solid #ffd700; padding:2px 8px; border-radius:12px;">
                Custo: ${card.cost} Ki | Poder: ${powerText} | [ ${categoryText} ]
              </span>
            </h2>
            <p style="font-size:0.84rem; color:#94a3b8;">
              Carregamento automático de imagens PNG soltas para Custo de Ki, ATK/DEF e Molde Template conforme o ID da carta.
            </p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="studio-grid-toggle" class="btn-ghost" style="font-size:0.8rem; padding:8px 12px;">📏 Régua/Grid</button>
            <button id="studio-save-master-btn" class="btn-ghost" style="font-size:0.8rem; padding:8px 12px; background:rgba(245,158,11,0.2); border:1px solid #f59e0b; color:#ffd700; font-weight:900;">
              👑 Salvar Layout MESTRE
            </button>
            <button id="studio-apply-all-master-btn" class="btn-ghost" style="font-size:0.8rem; padding:8px 12px; background:rgba(59,130,246,0.2); border:1px solid #60a5fa; color:#93c5fd; font-weight:900;">
              ⚡ Aplicar MESTRE em TODAS
            </button>
            <button id="studio-batch-inject-all-btn" class="btn-primary" style="font-size:0.82rem; padding:8px 16px; background:linear-gradient(135deg,#10b981,#059669); border:1px solid #34d399; font-weight:900; box-shadow:0 0 16px rgba(16,185,129,0.4);">
              🚀 INJETAR TODAS AS CARTAS NO JOGO
            </button>
            <button id="studio-save-inject-btn" class="btn-primary" style="font-size:0.8rem; padding:8px 14px; background:linear-gradient(135deg,#f59e0b,#d97706); border:1px solid #ffd700; font-weight:900;">
              🔥 Salvar Esta Carta
            </button>
            <button id="studio-close-btn" class="btn-ghost" style="font-size:0.8rem; padding:8px 12px; color:#ff4444;">✕ Fechar</button>
          </div>
        </div>

        <!-- Studio Main Body (2 Columns Layout) -->
        <div style="display:grid; grid-template-columns:360px 1fr; gap:24px; align-items:start;">
          
          <!-- LEFT COLUMN: Live 4K Preview Canvas -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:16px; background:rgba(6,9,19,0.8); padding:20px; border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
            <h3 style="font-size:0.88rem; font-weight:900; color:#fff; text-transform:uppercase;">Preview 4K em Tempo Real</h3>
            
            <div id="studio-canvas-container" style="position:relative; width:280px; height:392px; border-radius:12px; border:2px solid rgba(255,215,0,0.5); overflow:hidden; background:#000; box-shadow:0 8px 24px rgba(0,0,0,0.9);">
              <canvas id="studio-live-canvas" width="350" height="490" style="width:100%; height:100%; object-fit:contain;"></canvas>
            </div>

            <div style="display:flex; gap:8px; width:100%;">
              <button id="studio-export-png-btn" class="btn-ghost" style="flex:1; font-size:0.76rem; padding:8px;">💾 Baixar PNG 4K</button>
              <button id="studio-reset-layout-btn" class="btn-ghost" style="flex:1; font-size:0.76rem; padding:8px; color:#f59e0b;">↺ Resetar Alinhamento</button>
            </div>
          </div>

          <!-- RIGHT COLUMN: Surgical Tool Palette & Field Adjuster -->
          <div style="display:flex; flex-direction:column; gap:16px; max-height:600px; overflow-y:auto; padding-right:8px;">
            
            <!-- Card Selector & Basic Data -->
            <div style="background:rgba(18,24,38,0.7); padding:14px; border-radius:10px; border:1px solid rgba(255,215,0,0.3);">
              <h4 style="font-size:0.84rem; font-weight:900; color:#ffd700; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <span>1. Seleção da Carta & Moldes Automáticos</span>
                <button id="studio-batch-inject-sec1-btn" class="btn-primary" style="font-size:0.75rem; padding:4px 12px; background:linear-gradient(135deg,#10b981,#059669); border:1px solid #34d399; font-weight:900;">
                  🚀 INJETAR TODAS NO JOGO
                </button>
              </h4>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="font-size:0.74rem; color:#cbd5e1; display:block; margin-bottom:4px;">Carta Ativa do Jogo:</label>
                  <select id="studio-card-select" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:6px; border-radius:6px; font-size:0.78rem;">
                    ${CARD_DATABASE.map(c => `<option value="${c.id}" ${c.id === card.id ? 'selected' : ''}>${c.id.toUpperCase()} - ${c.name} (${(c.actionCategory || c.type).toUpperCase()})</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="font-size:0.74rem; color:#cbd5e1; display:block; margin-bottom:4px;">Molde Template PNG (Auto):</label>
                  <select id="studio-template-select" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:6px; border-radius:6px; font-size:0.78rem;">
                    <option value="template_red.png" ${this.layoutConfig.template.includes('red') ? 'selected' : ''}>🔴 template_red.png (Ataque Físico / Soco)</option>
                    <option value="template_beam.png" ${this.layoutConfig.template.includes('beam') ? 'selected' : ''}>🟡 template_beam.png (Feixe de Ki / Beam)</option>
                    <option value="template_blue.png" ${this.layoutConfig.template.includes('blue') ? 'selected' : ''}>🔵 template_blue.png (Defesa / Barreira)</option>
                    <option value="template_green.png" ${this.layoutConfig.template.includes('green') ? 'selected' : ''}>🟢 template_green.png (Suporte / Efeito)</option>
                    <option value="template_roxo.png" ${this.layoutConfig.template.includes('roxo') ? 'selected' : ''}>🟣 template_roxo.png (Esquiva / Counter)</option>
                    <option value="template_leader.png" ${this.layoutConfig.template.includes('leader') ? 'selected' : ''}>👑 template_leader.png (Carta Líder Imperial)</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Artwork Fine Tuning (Offset X/Y, Zoom) -->
            <div style="background:rgba(18,24,38,0.7); padding:14px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
              <h4 style="font-size:0.84rem; font-weight:900; color:#ffd700; margin-bottom:10px;">2. Ajuste Fino da Ilustração do Personagem (Zoom & Posição)</h4>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                <div>
                  <label style="font-size:0.74rem; color:#cbd5e1; display:block;">Posição X: <span id="val-artX">${this.layoutConfig.artX}</span>px</label>
                  <input type="range" id="input-artX" min="-100" max="100" value="${this.layoutConfig.artX}" style="width:100%;">
                </div>
                <div>
                  <label style="font-size:0.74rem; color:#cbd5e1; display:block;">Posição Y: <span id="val-artY">${this.layoutConfig.artY}</span>px</label>
                  <input type="range" id="input-artY" min="-100" max="100" value="${this.layoutConfig.artY}" style="width:100%;">
                </div>
                <div>
                  <label style="font-size:0.74rem; color:#cbd5e1; display:block;">Zoom / Escala: <span id="val-artScale">${this.layoutConfig.artScale}</span>%</label>
                  <input type="range" id="input-artScale" min="50" max="250" value="${this.layoutConfig.artScale}" style="width:100%;">
                </div>
              </div>
            </div>

            <!-- Standalone PNG Badges Adjuster (Ki Sphere PNG & Power Badge PNG) -->
            <div style="background:rgba(18,24,38,0.7); padding:14px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
              <h4 style="font-size:0.84rem; font-weight:900; color:#ffd700; margin-bottom:10px;">3. Alinhamento das Imagens PNG Soltas de Custo & Poder</h4>
              
              <!-- Ki Sphere PNG -->
              <div style="margin-bottom:12px;">
                <span style="font-size:0.78rem; font-weight:800; color:#38bdf8;">🔮 Imagem PNG da Esfera de Custo (${this.layoutConfig.kiBadgeSrc}):</span>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:4px;">
                  <div><label style="font-size:0.7rem; color:#94a3b8;">X (px):</label><input type="number" id="num-kiX" value="${this.layoutConfig.kiX}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.75rem;"></div>
                  <div><label style="font-size:0.7rem; color:#94a3b8;">Y (px):</label><input type="number" id="num-kiY" value="${this.layoutConfig.kiY}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.75rem;"></div>
                  <div><label style="font-size:0.7rem; color:#94a3b8;">Diâmetro:</label><input type="number" id="num-kiSize" value="${this.layoutConfig.kiSize}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.75rem;"></div>
                </div>
              </div>

              <!-- Power Badge PNG -->
              <div style="margin-bottom:12px;">
                <span style="font-size:0.78rem; font-weight:800; color:#38bdf8;">⚡ Imagem PNG do Badge de Poder (${this.layoutConfig.powerBadgeSrc}):</span>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:6px; margin-top:4px;">
                  <div><label style="font-size:0.68rem; color:#94a3b8;">X:</label><input type="number" id="num-powerX" value="${this.layoutConfig.powerX}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.72rem;"></div>
                  <div><label style="font-size:0.68rem; color:#94a3b8;">Y:</label><input type="number" id="num-powerY" value="${this.layoutConfig.powerY}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.72rem;"></div>
                  <div><label style="font-size:0.68rem; color:#94a3b8;">Largura:</label><input type="number" id="num-powerWidth" value="${this.layoutConfig.powerWidth || 100}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.72rem;"></div>
                  <div><label style="font-size:0.68rem; color:#94a3b8;">Altura:</label><input type="number" id="num-powerHeight" value="${this.layoutConfig.powerHeight || 34}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.72rem;"></div>
                </div>
              </div>

              <!-- Title Capsule -->
              <div style="margin-bottom:12px;">
                <span style="font-size:0.78rem; font-weight:800; color:#38bdf8;">🏷️ Cápsula de Título:</span>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:4px;">
                  <div><label style="font-size:0.7rem; color:#94a3b8;">X (px):</label><input type="number" id="num-titleX" value="${this.layoutConfig.titleX}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.75rem;"></div>
                  <div><label style="font-size:0.7rem; color:#94a3b8;">Y (px):</label><input type="number" id="num-titleY" value="${this.layoutConfig.titleY}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.75rem;"></div>
                  <div><label style="font-size:0.7rem; color:#94a3b8;">Fonte (pt):</label><input type="number" id="num-titleFontSize" value="${this.layoutConfig.titleFontSize}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.75rem;"></div>
                </div>
              </div>

              <!-- Description Box -->
              <div>
                <span style="font-size:0.78rem; font-weight:800; color:#38bdf8;">📜 Painel de Descrição do Efeito:</span>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr 1fr; gap:6px; margin-top:4px;">
                  <div><label style="font-size:0.68rem; color:#94a3b8;">X:</label><input type="number" id="num-descX" value="${this.layoutConfig.descX}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.72rem;"></div>
                  <div><label style="font-size:0.68rem; color:#94a3b8;">Y:</label><input type="number" id="num-descY" value="${this.layoutConfig.descY}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.72rem;"></div>
                  <div><label style="font-size:0.68rem; color:#94a3b8;">Largura:</label><input type="number" id="num-descWidth" value="${this.layoutConfig.descWidth}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.72rem;"></div>
                  <div><label style="font-size:0.68rem; color:#94a3b8;">Altura:</label><input type="number" id="num-descHeight" value="${this.layoutConfig.descHeight}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.72rem;"></div>
                  <div><label style="font-size:0.68rem; color:#94a3b8;">Fonte:</label><input type="number" id="num-descFontSize" value="${this.layoutConfig.descFontSize}" style="width:100%; background:#090d16; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px; border-radius:4px; font-size:0.72rem;"></div>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    `;

    modal.style.display = 'block';

    this.bindStudioEvents();
    this.renderLiveCanvas();
  }

  bindStudioEvents() {
    const modal = document.getElementById('card-studio-modal');
    if (!modal) return;

    modal.querySelector('#studio-close-btn')?.addEventListener('click', () => {
      modal.style.display = 'none';
      soundEngine.playClick();
    });

    modal.querySelector('#studio-grid-toggle')?.addEventListener('click', () => {
      this.showGrid = !this.showGrid;
      this.renderLiveCanvas();
    });

    // AUTO CARREGAMENTO AO SELECIONAR CARTA
    modal.querySelector('#studio-card-select')?.addEventListener('change', (e) => {
      this.activeCardId = e.target.value;
      const card = getCardById(this.activeCardId);
      const master = this.getMasterLayout();
      if (card) {
        const autoCfg = this.getAutoConfigForCard(card, master);
        try {
          const saved = localStorage.getItem(`dbtcg_card_layout_${this.activeCardId}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            this.layoutConfig = {
              ...autoCfg,
              ...parsed,
              kiBadgeSrc: autoCfg.kiBadgeSrc,
              powerBadgeSrc: autoCfg.powerBadgeSrc,
              template: parsed.template || autoCfg.template
            };
          } else {
            this.layoutConfig = autoCfg;
          }
        } catch (err) {
          this.layoutConfig = autoCfg;
        }
      }
      this.openStudio(this.activeCardId);
    });

    modal.querySelector('#studio-template-select')?.addEventListener('change', (e) => {
      this.layoutConfig.template = e.target.value;
      this.renderLiveCanvas();
    });

    // Art controls
    const bindRange = (id, key, labelId) => {
      const input = modal.querySelector(`#${id}`);
      if (input) {
        input.addEventListener('input', (e) => {
          this.layoutConfig[key] = parseFloat(e.target.value);
          const lbl = modal.querySelector(`#${labelId}`);
          if (lbl) lbl.textContent = e.target.value;
          this.renderLiveCanvas();
        });
      }
    };
    bindRange('input-artX', 'artX', 'val-artX');
    bindRange('input-artY', 'artY', 'val-artY');
    bindRange('input-artScale', 'artScale', 'val-artScale');

    // Number inputs for layout alignment
    const bindNum = (id, key) => {
      const input = modal.querySelector(`#${id}`);
      if (input) {
        input.addEventListener('input', (e) => {
          this.layoutConfig[key] = parseFloat(e.target.value) || 0;
          this.renderLiveCanvas();
        });
      }
    };
    bindNum('num-kiX', 'kiX');
    bindNum('num-kiY', 'kiY');
    bindNum('num-kiSize', 'kiSize');
    bindNum('num-titleX', 'titleX');
    bindNum('num-titleY', 'titleY');
    bindNum('num-titleFontSize', 'titleFontSize');
    bindNum('num-powerX', 'powerX');
    bindNum('num-powerY', 'powerY');
    bindNum('num-powerWidth', 'powerWidth');
    bindNum('num-powerHeight', 'powerHeight');
    bindNum('num-powerFontSize', 'powerFontSize');
    bindNum('num-typeX', 'typeX');
    bindNum('num-typeY', 'typeY');
    bindNum('num-typeFontSize', 'typeFontSize');
    bindNum('num-descX', 'descX');
    bindNum('num-descY', 'descY');
    bindNum('num-descWidth', 'descWidth');
    bindNum('num-descHeight', 'descHeight');
    bindNum('num-descFontSize', 'descFontSize');

    // Save active card layout and inject to game
    modal.querySelector('#studio-save-inject-btn')?.addEventListener('click', () => {
      this.saveAndInjectToGame();
    });

    // Save active layout as MASTER layout template
    modal.querySelector('#studio-save-master-btn')?.addEventListener('click', () => {
      this.saveCurrentAsMasterLayout();
    });

    // Apply MASTER layout template to ALL 70 cards
    modal.querySelector('#studio-apply-all-master-btn')?.addEventListener('click', () => {
      this.applyMasterLayoutToAllCards();
    });

    // BATCH INJECT ALL CARDS IN GAME AT ONCE (Header & Section 1 Buttons)
    modal.querySelector('#studio-batch-inject-all-btn')?.addEventListener('click', () => {
      this.batchInjectAllCards();
    });
    modal.querySelector('#studio-batch-inject-sec1-btn')?.addEventListener('click', () => {
      this.batchInjectAllCards();
    });

    // Export PNG
    modal.querySelector('#studio-export-png-btn')?.addEventListener('click', () => {
      const canvas = document.getElementById('studio-live-canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `DBZ_TCG_Card_${this.activeCardId}_4K.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    });

    // Reset Layout
    modal.querySelector('#studio-reset-layout-btn')?.addEventListener('click', () => {
      localStorage.removeItem(`dbtcg_card_layout_${this.activeCardId}`);
      localStorage.removeItem(`dbtcg_custom_card_${this.activeCardId}`);
      this.openStudio(this.activeCardId);
    });
  }

  // Draw wrapped text inside bounding box
  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
    if (!text) return;
    const cleanText = text.replace(/^\[[^\]]+\]\s*/gi, '').trim();
    const words = cleanText.split(' ');
    let line = '';
    let currentY = y;
    let linesCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
        linesCount++;
        if (linesCount >= maxLines - 1) {
          const remaining = words.slice(n).join(' ');
          let truncLine = remaining;
          while (ctx.measureText(truncLine + '...').width > maxWidth && truncLine.length > 0) {
            truncLine = truncLine.slice(0, -1);
          }
          ctx.fillText(truncLine.trim() + '...', x, currentY);
          return;
        }
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  }

  // Core 4K Canvas Renderer for preview AND batch export
  async renderCardToCanvas(card, layoutConfig, canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 350, H = 490;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const templatePath = layoutConfig.template || assetLoader.getTemplatePath(card.type, card.isBeam);
    const artPath = layoutConfig.artSrc || `assets/cards/${card.id}.png`;
    
    // Standalone PNG Badges
    const kiBadgePath = layoutConfig.kiBadgeSrc || `assets/badges/ki_cost_${card.cost || 0}.png`;
    const powerVal = card.power || card.block || 0;
    const powerSuffix = card.power ? 'atk' : (card.block ? 'def' : 'atk');
    const powerBadgePath = layoutConfig.powerBadgeSrc || `assets/badges/power_${powerVal}_${powerSuffix}.png`;

    const [templateImg, artImg, kiBadgeImg, powerBadgeImg] = await Promise.all([
      assetLoader.loadImage(templatePath),
      assetLoader.loadImage(artPath),
      assetLoader.loadImage(kiBadgePath),
      assetLoader.loadImage(powerBadgePath)
    ]);

    // Layer 1: Character Artwork with fine-tuned offsets and scale
    if (artImg) {
      const baseW = 320, baseH = 244;
      const scale = (layoutConfig.artScale || 100) / 100;
      const drawW = baseW * scale;
      const drawH = baseH * scale;
      const drawX = 15 + (layoutConfig.artX || 0) + (baseW - drawW) / 2;
      const drawY = 52 + (layoutConfig.artY || 0) + (baseH - drawH) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(15, 52, baseW, baseH, 6);
      ctx.clip();
      ctx.drawImage(artImg, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // Layer 2: Template PNG Overlay Frame
    if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, W, H);
    }

    // Layer 3: Standalone PNG Ki Cost Sphere Badge (Loose PNG asset!)
    const kiX = layoutConfig.kiX ?? 14;
    const kiY = layoutConfig.kiY ?? 14;
    const kiSize = layoutConfig.kiSize || 48;

    if (kiBadgeImg) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 10;
      ctx.drawImage(kiBadgeImg, kiX, kiY, kiSize, kiSize);
      ctx.restore();
    } else {
      // Fallback 3D sphere if PNG badge loading
      ctx.save();
      const kiR = kiSize / 2;
      const centerX = kiX + kiR;
      const centerY = kiY + kiR;
      ctx.beginPath();
      ctx.arc(centerX, centerY, kiR, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.font = `900 ${Math.max(16, kiR * 1.1)}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${card.cost || 0}`, centerX, centerY + 1);
      ctx.restore();
    }

    // Layer 4: Standalone PNG Power Badge Capsule (Loose PNG asset!)
    const pX = layoutConfig.powerX ?? 230;
    const pY = layoutConfig.powerY ?? 436;
    const pW = layoutConfig.powerWidth || 100;
    const pH = layoutConfig.powerHeight || 34;

    if (powerBadgeImg) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 10;
      ctx.drawImage(powerBadgeImg, pX, pY, pW, pH);
      ctx.restore();
    }

    // Layer 5: Title Capsule Text
    ctx.save();
    const tX = layoutConfig.titleX ?? 68;
    const tY = layoutConfig.titleY ?? 14;
    const tFont = layoutConfig.titleFontSize || 13;
    ctx.font = `900 ${tFont}px "Outfit", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText((card.name || '').toUpperCase(), tX, tY + 14);
    ctx.restore();

    // Layer 6: Description Box
    const descText = card.descPt || card.description || '';
    if (descText) {
      ctx.save();
      const dX = layoutConfig.descX ?? 20;
      const dY = layoutConfig.descY ?? 366;
      const dW = layoutConfig.descWidth || 310;
      const dH = layoutConfig.descHeight || 62;
      const dFont = layoutConfig.descFontSize || 11;
      
      ctx.fillStyle = 'rgba(8, 12, 24, 0.92)';
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(dX, dY, dW, dH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = `700 ${dFont}px "Inter", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      this.drawWrappedText(ctx, descText, dX + 8, dY + 8, dW - 16, dFont + 4, 4);
      ctx.restore();
    }

    // Grid Overlay if enabled
    if (this.showGrid && canvas.id === 'studio-live-canvas') {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += 35) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  async renderLiveCanvas() {
    const canvas = document.getElementById('studio-live-canvas');
    if (!canvas) return;
    const card = getCardById(this.activeCardId) || CARD_DATABASE[0];
    await this.renderCardToCanvas(card, this.layoutConfig, canvas);
  }

  saveCurrentAsMasterLayout() {
    const { artSrc, template, kiBadgeSrc, powerBadgeSrc, ...masterPositional } = this.layoutConfig;
    localStorage.setItem('dbtcg_master_layout', JSON.stringify(masterPositional));
    soundEngine.playAwaken();
    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.showToast(`👑 Layout Mestre da carta ${this.activeCardId} salvo como padrão global!`, "🔥");
    } else {
      alert(`Layout Mestre salvo com sucesso!`);
    }
  }

  applyMasterLayoutToAllCards() {
    const { artSrc, template, kiBadgeSrc, powerBadgeSrc, ...masterPositional } = this.layoutConfig;
    localStorage.setItem('dbtcg_master_layout', JSON.stringify(masterPositional));

    let count = 0;
    CARD_DATABASE.forEach(card => {
      const autoCfg = this.getAutoConfigForCard(card, masterPositional);
      localStorage.setItem(`dbtcg_card_layout_${card.id}`, JSON.stringify(autoCfg));
      count++;
    });

    soundEngine.playAwaken();
    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.showToast(`⚡ Layout MESTRE aplicado com sucesso em TODAS as ${count} cartas do jogo!`, "🔥");
      uiManager.renderDeckBuilder();
    } else {
      alert(`Layout MESTRE aplicado a todas as ${count} cartas!`);
    }
  }

  // 🚀 BATCH INJECT ALL CARDS AT ONCE INTO THE GAME ENGINE & CACHE
  async batchInjectAllCards() {
    const master = this.getMasterLayout();
    const total = CARD_DATABASE.length;
    let count = 0;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 350;
    offscreenCanvas.height = 490;

    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.showToast(`🚀 Compilando e injetando ${total} cartas 4K no jogo...`, "⚡");
    }

    for (const card of CARD_DATABASE) {
      // Clear stale layout cache first to ensure exact PNG badges & templates
      localStorage.removeItem(`dbtcg_card_layout_${card.id}`);
      localStorage.removeItem(`dbtcg_custom_card_${card.id}`);

      const cardLayout = this.getAutoConfigForCard(card, master);

      await this.renderCardToCanvas(card, cardLayout, offscreenCanvas);
      const dataUrl = offscreenCanvas.toDataURL('image/png');

      localStorage.setItem(`dbtcg_custom_card_${card.id}`, dataUrl);
      localStorage.setItem(`dbtcg_card_layout_${card.id}`, JSON.stringify(cardLayout));

      if (typeof window !== 'undefined' && window.GLOBAL_CUSTOM_CARDS) {
        window.GLOBAL_CUSTOM_CARDS[card.id] = dataUrl;
      }
      count++;
    }

    soundEngine.playAwaken();
    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.showToast(`🔥 SUCESSO! Todas as ${count} cartas do jogo foram compiladas e injetadas!`, "✨");
      uiManager.renderDeckBuilder();
    } else {
      alert(`Todas as ${count} cartas foram compiladas e injetadas com sucesso!`);
    }
  }

  saveAndInjectToGame() {
    const canvas = document.getElementById('studio-live-canvas');
    if (!canvas) return;

    try {
      // Export compiled high-res PNG
      const dataUrl = canvas.toDataURL('image/png');
      
      // Save custom card image and layout config to localStorage
      localStorage.setItem(`dbtcg_custom_card_${this.activeCardId}`, dataUrl);
      localStorage.setItem(`dbtcg_card_layout_${this.activeCardId}`, JSON.stringify(this.layoutConfig));

      if (typeof window !== 'undefined' && window.GLOBAL_CUSTOM_CARDS) {
        window.GLOBAL_CUSTOM_CARDS[this.activeCardId] = dataUrl;
      }

      soundEngine.playAwaken();
      
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.showToast(`Carta ${this.activeCardId} compilada e injetada no jogo com sucesso!`, "🔥");
        uiManager.renderDeckBuilder();
      } else {
        alert(`Carta ${this.activeCardId} injetada com sucesso! Recarregando...`);
        window.location.reload();
      }
    } catch (e) {
      alert("Erro ao injetar carta no jogo: " + e.message);
    }
  }
}

export const cardStudioEngine = new CardStudioEngine();
