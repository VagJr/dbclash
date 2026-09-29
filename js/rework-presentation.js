/* NEXUS presentation layer. Account mutations remain in the account APIs. */
import { sceneManager, GAME_SCENES } from './scene-manager.js';
import { CARD_DATABASE, getCardById } from './card-database.js';
import { assetLoader } from './asset-loader.js';
import { deckBuilder } from './deck-builder.js';
import { authManager } from './auth-manager.js';
import { packOpener } from './pack-opener.js';
import { DECK_MAX, DECK_MIN, MAX_CARD_COPIES, getCraftCost, totalCardCopies } from './economy-rules.js';
import { XP_PER_LEVEL, levelForXp } from './ranked-rules.js';

const $ = id => document.getElementById(id);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPES = { attack: 'Ataque', defense: 'Defesa', evade: 'Evasão', counter: 'Contra-ataque', tech: 'Técnica' };
const PERSONAS = { goku: ['Son Goku', 'Pressão e sequências de ataques'], vegeta: ['Vegeta', 'Explosão de poder e finalização'], piccolo: ['Piccolo', 'Defesa, recuperação e planejamento'], gohan: ['Gohan', 'Controle e respostas táticas'], frieza: ['Freeza', 'Supressão de recursos e controle'], trunks: ['Trunks', 'Velocidade e contra-ataques'] };
const LORE = [
  { label: '01 / O DESPERTAR', title: 'O universo virou um baralho.', speaker: 'BULMA // LABORATÓRIO NEXUS', line: 'Eu só queria simular uma batalha. Mas o NEXUS começou a armazenar cada técnica, cada lembrança… em cartas.', note: 'Uma simulação capaz de reescrever as regras do combate.' },
  { label: '02 / A RUPTURA', title: 'Cada carta guarda um poder.', speaker: 'GOKU // PRIMEIRA CONEXÃO', line: 'Então eu posso combinar o meu Ki com as técnicas de todo mundo? Isso parece um treino incrível!', note: 'Ataque. Responda. Proteja seus aliados. Construa sua própria estratégia.' },
  { label: '03 / SEU CHAMADO', title: 'A próxima jogada é sua.', speaker: 'NEXUS // PROTOCOLO DO GUERREIRO', line: 'Anomalia detectada. Universos em conflito. Guerreiro, estabilize a simulação: seu deck será a chave.', note: 'Entre na arena e transforme possibilidades em poder.' }
];

export const nexusCollectionState = { query: '', type: '', archetype: '', owned: false, page: 0, pageSize: 36 };

export function filterNexusCards(cards, state = nexusCollectionState, ownedCount = () => 0) {
  const query = String(state.query || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return cards.filter(card => {
    const archetypes = Array.isArray(card.archetypes) ? card.archetypes : [card.archetype].filter(Boolean);
    const searchable = [card.name, card.namePt, card.nameEn, card.character, card.id, card.description, card.descPt, card.descEn, ...archetypes, ...(card.tags || [])].join(' ').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return (!query || searchable.includes(query)) && (!state.type || card.type === state.type) && (!state.archetype || archetypes.includes(state.archetype)) && (!state.owned || ownedCount(card.id) > 0);
  });
}

class NexusPresentation {
  constructor() {
    this.introIndex = 0;
    this.introTimer = null;
    this.revealTimers = [];
    this.introSeen = false;
    this.ui = null;
    try { this.introSeen = sessionStorage.getItem('dbclash_nexus_intro_seen') === '1'; } catch {}
  }

  mount() {
    if (document.body.classList.contains('nexus-ui')) return;
    document.body.classList.add('nexus-ui');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#071321');
    this.setupTitle();
    this.setupMenu();
    this.setupIntro();
    this.setupInspector();
    this.setupCollection();
    this.setupShop();
    this.setupAccessibility();
    this.loadArtwork();
    window.addEventListener('dbtcg:sceneChange', event => this.onScene(event.detail.sceneId));
    this.connectUI();
    let attempts = 0;
    const connect = setInterval(() => {
      if (this.connectUI() || ++attempts > 100) clearInterval(connect);
    }, 100);
    this.onScene(sceneManager.currentScene);
  }

  setupTitle() {
    const inner = $('scene-title')?.querySelector('.title-inner');
    if (!inner) return;
    const tag = document.createElement('div');
    tag.className = 'nexus-title-kicker';
    tag.textContent = 'PROJETO NEXUS / ACTION TCG';
    inner.prepend(tag);
    const subtitle = inner.querySelector('.hero-sub-subtitle');
    if (subtitle) subtitle.textContent = 'DOMINE O KI. REESCREVA O COMBATE.';
    const press = $('title-press-start-btn')?.querySelector('.ps-glow');
    if (press) press.textContent = 'PRESS START';
    const sub = inner.querySelector('.press-start-sub');
    if (sub) sub.textContent = 'ENTER · CLIQUE · TOQUE PARA INICIAR';
    const footer = document.createElement('p');
    footer.className = 'nexus-title-footer';
    footer.textContent = 'UMA NOVA DIMENSÃO DE BATALHAS';
    inner.append(footer);
  }

  setupMenu() {
    const hub = $('scene-main-menu')?.querySelector('.menu-hub-arc-layout');
    if (!hub) return;
    const left = hub.querySelector('.menu-arc-left');
    const right = hub.querySelector('.menu-arc-right');
    const leader = $('menu-leader-card-slot');
    const feature = document.createElement('div');
    feature.className = 'nexus-feature';
    feature.innerHTML = `<div class="nexus-feature-art" aria-hidden="true"></div>
      <div class="nexus-feature-content"><div class="nexus-eyebrow"><span class="nexus-signal"></span> SIMULAÇÃO NEXUS / 01</div>
      <h1>SEU KI.<br><span>SUAS REGRAS.</span></h1><p>O universo Dragon Ball vive em uma simulação de cartas. Combine técnicas, desafie seus limites e escreva a próxima batalha.</p>
      <div class="nexus-training-controls"><label>OPONENTE<select id="nexus-npc-persona">${Object.entries(PERSONAS).map(([id, [name]]) => `<option value="${id}"${id === 'vegeta' ? ' selected' : ''}>${name}</option>`).join('')}</select></label>
      <label>DIFICULDADE<select id="nexus-npc-difficulty"><option value="easy">Fácil</option><option value="normal" selected>Normal</option><option value="hard">Difícil</option><option value="expert">Expert</option></select></label></div>
      <p class="nexus-npc-description" id="nexus-npc-description">Explosão de poder e finalização</p>
      <div class="nexus-hero-actions"><button id="nexus-training-btn" class="nexus-primary">INICIAR TREINO <span aria-hidden="true">↗</span></button><button id="nexus-lore-btn" class="nexus-lore-btn">A HISTÓRIA DO NEXUS <span aria-hidden="true">▷</span></button></div>
      <span class="nexus-training-note">Duelo solo · O treino não altera o ranking online</span></div>`;
    if (leader) feature.append(leader);
    const modes = document.createElement('div');
    modes.className = 'nexus-mode-panel';
    modes.innerHTML = '<div class="nexus-panel-heading"><span>ESCOLHA SUA ARENA</span><span class="nexus-eyebrow">MODOS DE COMBATE</span></div>';
    if (left) modes.append(left);
    if (right) modes.append(right);
    hub.replaceChildren(feature, modes);
    const labels = [
      ['menu-btn-ranked-1v1', '01 / DUELO', 'RANQUEADO 1 × 1', 'Sua estratégia contra outro guerreiro'],
      ['menu-btn-ranked-2v2', '02 / ESQUADRÃO', 'RANQUEADO 2 × 2', 'Dois decks. Uma estratégia em equipe.'],
      ['menu-btn-coop-raid', '03 / COOPERATIVO', 'RAID DE CHEFE', 'Una forças contra uma ameaça colossal'],
      ['menu-btn-global-ranking', '04 / COMPETITIVO', 'RANKING GLOBAL', 'Os guerreiros que dominam a simulação']
    ];
    for (const [id, badge, title, description] of labels) {
      const button = $(id);
      if (!button) continue;
      button.classList.remove('active');
      button.querySelector('.amc-badge').textContent = badge;
      button.querySelector('.amc-title').textContent = title;
      button.querySelector('.amc-sub').textContent = description;
      const arrow = document.createElement('span');
      arrow.className = 'nexus-mode-arrow';
      arrow.textContent = '↗';
      arrow.setAttribute('aria-hidden', 'true');
      button.append(arrow);
    }
    const profile = document.querySelector('.ghud-profile');
    if (profile) {
      const progress = document.createElement('div');
      progress.className = 'nexus-profile-progress';
      progress.innerHTML = '<span id="nexus-account-level">NÍVEL 1</span><div class="nexus-xp-track"><div id="nexus-xp-fill"></div></div>';
      profile.append(progress);
    }
    const status = document.createElement('div');
    status.className = 'nexus-hub-status';
    status.innerHTML = '<span><i class="nexus-signal"></i> SEU DECK É A SUA ESTRATÉGIA</span><span id="nexus-collection-progress"></span>';
    hub.after(status);
    $('nexus-npc-persona').addEventListener('change', event => {
      $('nexus-npc-description').textContent = PERSONAS[event.target.value]?.[1] || '';
    });
    $('nexus-training-btn').addEventListener('click', () => {
      const ui = this.ui || window.uiManager;
      if (!ui?.multiplayer) return;
      const identity = $('nexus-npc-persona').value;
      ui.gameEngine.configureNpc?.({ difficulty: $('nexus-npc-difficulty').value, identity });
      ui.multiplayer.startAiMatch(ui.selectedLeader, identity, deckBuilder.getDeckForLeader(ui.selectedLeader));
    });
    $('nexus-lore-btn').addEventListener('click', () => sceneManager.switchScene(GAME_SCENES.INTRO));
  }

  setupIntro() {
    const scene = $('scene-intro');
    const box = scene?.querySelector('.cinematic-box');
    if (!box) return;
    const kicker = document.createElement('div');
    kicker.className = 'nexus-eyebrow';
    kicker.id = 'nexus-intro-label';
    box.prepend(kicker);
    const speaker = document.createElement('p');
    speaker.id = 'nexus-intro-speaker';
    speaker.className = 'nexus-intro-speaker';
    box.querySelector('.intro-narrative').before(speaker);
    const note = document.createElement('p');
    note.id = 'nexus-intro-note';
    note.className = 'nexus-intro-note';
    const timeline = document.createElement('div');
    timeline.className = 'nexus-intro-timeline';
    timeline.innerHTML = LORE.map((part, i) => `<button type="button" data-chapter="${i}" aria-label="Cena ${i + 1}: ${escapeHtml(part.title)}"><span></span></button>`).join('');
    const actions = box.querySelector('.intro-actions');
    actions.before(note, timeline);
    const next = document.createElement('button');
    next.id = 'nexus-intro-next';
    next.className = 'nexus-primary';
    actions.prepend(next);
    $('intro-skip-btn').textContent = 'PULAR INTRO';
    $('intro-skip-btn').className = 'btn-ghost';
    $('intro-skip-btn').addEventListener('click', () => this.markIntroSeen(), true);
    next.addEventListener('click', () => {
      if (this.introIndex < LORE.length - 1) this.showIntroChapter(this.introIndex + 1);
      else { this.markIntroSeen(); sceneManager.switchScene(GAME_SCENES.MAIN_MENU); }
    });
    timeline.addEventListener('click', event => {
      const button = event.target.closest('[data-chapter]');
      if (button) this.showIntroChapter(Number(button.dataset.chapter));
    });
  }

  markIntroSeen() {
    this.introSeen = true;
    try { sessionStorage.setItem('dbclash_nexus_intro_seen', '1'); } catch {}
  }

  setupInspector() {
    if ($('card-inspect-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'card-inspect-modal';
    modal.className = 'modal-overlay nexus-inspect-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'inspect-card-name');
    modal.innerHTML = `<div class="nexus-inspect-panel glass"><button id="card-inspect-close" class="btn-ghost" aria-label="Fechar carta">×</button><div class="nexus-inspect-layout"><div><div id="card-inspect-preview"></div><div class="nexus-inspect-full-art" id="nexus-inspect-full-art" hidden><img id="nexus-inspect-image" alt="Arte completa da carta"></div><button id="nexus-inspect-art-toggle" class="btn-ghost">VER ARTE COMPLETA</button></div><div class="nexus-inspect-details"><div class="nexus-eyebrow">ARQUIVO NEXUS / TÉCNICA</div><h2 id="inspect-card-name"></h2><span id="inspect-card-type"></span><div class="nexus-inspect-stats"><span id="inspect-card-cost"></span><span id="inspect-card-power"></span></div><p id="inspect-card-desc"></p><p class="nexus-inspect-tip">O custo e o efeito da carta seguem as regras da fase atual do combate.</p></div></div></div>`;
    document.body.append(modal);
    const close = () => { modal.classList.remove('active'); this.inspectPreviousFocus?.focus?.({ preventScroll: true }); };
    $('card-inspect-close').addEventListener('click', close);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const buttons = [...modal.querySelectorAll('button:not([disabled])')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    $('nexus-inspect-art-toggle').addEventListener('click', () => {
      const art = $('nexus-inspect-full-art');
      art.hidden = !art.hidden;
      $('card-inspect-preview').hidden = !art.hidden;
      $('nexus-inspect-art-toggle').textContent = art.hidden ? 'VER ARTE COMPLETA' : 'VER CARTA';
    });
  }

  showIntroChapter(index) {
    clearTimeout(this.introTimer);
    this.introIndex = index;
    const part = LORE[index];
    const scene = $('scene-intro');
    if (!part || !scene) return;
    scene.dataset.chapter = String(index);
    $('nexus-intro-label').textContent = part.label;
    scene.querySelector('.intro-heading').textContent = part.title;
    $('nexus-intro-speaker').textContent = part.speaker;
    scene.querySelector('.intro-narrative').textContent = `“${part.line}”`;
    $('nexus-intro-note').textContent = part.note;
    $('nexus-intro-next').textContent = index === LORE.length - 1 ? 'ENTRAR NA SIMULAÇÃO ↗' : 'CONTINUAR →';
    scene.querySelectorAll('[data-chapter]').forEach((button, i) => {
      button.classList.toggle('current', i === index);
      button.classList.toggle('complete', i < index);
      button.setAttribute('aria-current', i === index ? 'step' : 'false');
    });
    scene.classList.remove('nexus-chapter-enter');
    requestAnimationFrame(() => scene.classList.add('nexus-chapter-enter'));
    if (!reducedMotion() && index < LORE.length - 1) this.introTimer = setTimeout(() => this.showIntroChapter(index + 1), 9000);
  }

  setupCollection() {
    const panel = $('collection-grid')?.closest('.collection-panel');
    if (!panel) return;
    const tools = document.createElement('div');
    tools.className = 'nexus-collection-tools';
    const archetypes = [...new Set(CARD_DATABASE.flatMap(card => card.archetypes || [card.archetype]).filter(Boolean))].sort();
    tools.innerHTML = `<label class="nexus-search-label"><span class="sr-only">Buscar cartas</span><input id="nexus-card-search" type="search" placeholder="Buscar nome, técnica ou sinergia…" autocomplete="off"></label>
      <label><span class="sr-only">Tipo de carta</span><select id="nexus-card-type"><option value="">Todos os tipos</option>${Object.entries(TYPES).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
      <label><span class="sr-only">Estratégia</span><select id="nexus-card-archetype"><option value="">Todas as estratégias</option>${archetypes.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}</select></label>
      <label class="nexus-owned-label"><input id="nexus-owned-only" type="checkbox"> Minha coleção</label>`;
    panel.querySelector('.collection-title')?.after(tools);
    const pager = document.createElement('div');
    pager.className = 'nexus-collection-pager';
    pager.innerHTML = '<button id="nexus-page-prev" class="btn-ghost" aria-label="Página anterior">←</button><span id="nexus-page-status" role="status" aria-live="polite"></span><button id="nexus-page-next" class="btn-ghost" aria-label="Próxima página">→</button>';
    panel.append(pager);
    const refresh = () => { nexusCollectionState.page = 0; this.renderCollection(); };
    $('nexus-card-search').addEventListener('input', event => { nexusCollectionState.query = event.target.value; refresh(); });
    $('nexus-card-type').addEventListener('change', event => { nexusCollectionState.type = event.target.value; refresh(); });
    $('nexus-card-archetype').addEventListener('change', event => { nexusCollectionState.archetype = event.target.value; refresh(); });
    $('nexus-owned-only').addEventListener('change', event => { nexusCollectionState.owned = event.target.checked; refresh(); });
    for (const [id, amount] of [['nexus-page-prev', -1], ['nexus-page-next', 1]]) {
      $(id).addEventListener('click', () => {
        nexusCollectionState.page += amount;
        this.renderCollection();
        panel.querySelector('.collection-scroll-area')?.scrollTo({ top: 0, behavior: reducedMotion() ? 'instant' : 'smooth' });
      });
    }
  }

  renderCard(card) {
    const element = document.createElement('div');
    element.className = `card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''}`;
    element.dataset.cardId = card.id;
    element.innerHTML = `${assetLoader.renderCardArtHTML(card)}<div class="card-header"><div class="card-ki-cost" aria-label="Custo ${Number(card.cost)} Ki">${Number(card.cost)}</div></div><div class="card-type-tag tag-${card.type}">${TYPES[card.type] || escapeHtml(card.type)}</div>${card.power > 0 ? `<div class="card-power-badge">${Number(card.power)} ATK</div>` : ''}`;
    return element;
  }

  renderCollection() {
    const grid = $('collection-grid');
    if (!grid || !this.ui) return;
    const state = nexusCollectionState;
    const cards = filterNexusCards(CARD_DATABASE, state, id => deckBuilder.getOwnedCount(id));
    const pageCount = Math.max(1, Math.ceil(cards.length / state.pageSize));
    state.page = Math.max(0, Math.min(state.page, pageCount - 1));
    const fragment = document.createDocumentFragment();
    for (const card of cards.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize)) {
      const cell = document.createElement('article');
      cell.className = 'nexus-collection-cell';
      const owned = deckBuilder.getOwnedCount(card.id);
      const totalOwned = totalCardCopies(authManager.user, card.id);
      const reserved = Math.max(0, totalOwned - owned);
      const used = deckBuilder.getDeckCount(card.id, this.ui.selectedLeader);
      const available = owned > used && used < MAX_CARD_COPIES && deckBuilder.getDeckForLeader(this.ui.selectedLeader).length < DECK_MAX;
      const view = this.renderCard(card);
      view.classList.toggle('unowned', !owned);
      view.tabIndex = 0;
      view.setAttribute('role', 'button');
      view.setAttribute('aria-label', `Inspecionar ${card.name}. ${TYPES[card.type] || card.type}. ${card.cost} Ki. ${card.power || 0} ataque. Possui ${owned} cópias.`);
      view.addEventListener('click', () => this.ui.openCardInspectModal(card));
      const meta = document.createElement('div');
      meta.className = 'nexus-collection-count';
      meta.textContent = `COLEÇÃO ${owned}/${MAX_CARD_COPIES} · DECK ${used}${reserved ? ` · RESERVA ${reserved}` : ''}`;
      const button = document.createElement('button');
      button.className = available ? 'nexus-collection-add' : 'nexus-collection-craft';
      button.textContent = available ? '+ ADICIONAR' : totalOwned < MAX_CARD_COPIES ? `CRIAR · ${getCraftCost(card.id)} DUST` : reserved ? 'CÓPIAS RESERVADAS' : 'NO LIMITE';
      button.disabled = !available && totalOwned >= MAX_CARD_COPIES;
      button.setAttribute('aria-label', `${button.textContent}: ${card.name}`);
      button.addEventListener('click', async () => {
        button.disabled = true;
        deckBuilder.activeLeader = this.ui.selectedLeader;
        try {
          if (available) await deckBuilder.addCardToDeck(card.id, this.ui.selectedLeader);
          else await deckBuilder.craftCard(card.id);
        } finally { this.ui.renderDeckBuilder(); this.ui.updateCurrencies(); }
      });
      cell.append(view, meta, button);
      fragment.append(cell);
    }
    if (!cards.length) {
      const empty = document.createElement('p');
      empty.className = 'nexus-empty';
      empty.textContent = 'Nenhuma carta encontrada. Experimente outro nome ou filtro.';
      fragment.append(empty);
    }
    grid.replaceChildren(fragment);
    $('nexus-page-status').textContent = `${cards.length} cartas · ${state.page + 1} / ${pageCount}`;
    $('nexus-page-prev').disabled = state.page === 0;
    $('nexus-page-next').disabled = state.page >= pageCount - 1;
    if ($('collection-title')) $('collection-title').textContent = `ARQUIVO NEXUS · ${CARD_DATABASE.length} CARTAS`;
  }

  renderDeck() {
    if (!this.ui) return;
    const deck = deckBuilder.getDeckForLeader(this.ui.selectedLeader);
    const container = $('deck-list-container');
    if (container) {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < deck.length; index++) {
        const card = getCardById(deck[index]);
        if (!card) continue;
        const row = document.createElement('div');
        row.className = 'deck-entry-capsule';
        const inspect = document.createElement('button');
        inspect.className = 'de-capsule-info';
        inspect.innerHTML = `<span class="de-ki-badge">${Number(card.cost)} KI</span><span class="de-card-name">${escapeHtml(card.name)}</span>`;
        inspect.addEventListener('click', () => this.ui.openCardInspectModal(card));
        const remove = document.createElement('button');
        remove.className = 'de-remove-btn';
        remove.textContent = '×';
        remove.disabled = deck.length <= DECK_MIN;
        remove.setAttribute('aria-label', `Remover ${card.name} do deck`);
        remove.addEventListener('click', async () => {
          remove.disabled = true;
          try { await deckBuilder.removeCardFromDeck(index, this.ui.selectedLeader); }
          finally { this.ui.renderDeckBuilder(); }
        });
        row.append(inspect, remove);
        fragment.append(row);
      }
      container.replaceChildren(fragment);
    }
    if ($('deck-builder-title')) $('deck-builder-title').textContent = `DECK ATIVO · ${deck.length}/${DECK_MAX}`;
    this.renderCollection();
  }

  setupShop() {
    const store = $('scene-shop')?.querySelector('.store-inner');
    if (!store) return;
    const pack = document.createElement('div');
    pack.className = 'nexus-pack-display';
    pack.setAttribute('aria-hidden', 'true');
    pack.innerHTML = '<div class="nexus-pack"><span>NEXUS</span><div class="nexus-pack-orb">✦</div><strong>KI<br>UNLEASHED</strong><small>ACTION TCG · BOOSTER</small></div><div class="nexus-pack-shadow"></div>';
    store.prepend(pack);
    const info = document.createElement('div');
    info.className = 'nexus-eyebrow';
    info.textContent = 'ARQUIVO DE TÉCNICAS / BOOSTERS';
    pack.after(info);
    const status = document.createElement('p');
    status.className = 'nexus-shop-status';
    status.id = 'nexus-shop-status';
    status.setAttribute('role', 'status');
    store.append(status);
  }

  animateReveal(cards) {
    this.revealTimers.forEach(clearTimeout);
    this.revealTimers = [];
    const container = $('pack-reveal-container');
    if (!container) return;
    container.classList.add('nexus-reveal');
    const nodes = [...container.querySelectorAll('.card')];
    const heading = document.createElement('div');
    heading.className = 'nexus-reveal-heading';
    heading.textContent = `${cards.length} TÉCNICAS REVELADAS`;
    container.prepend(heading);
    $('nexus-shop-status').textContent = 'Booster confirmado. As cartas já estão na sua coleção.';
    nodes.forEach((node, index) => {
      node.classList.add('nexus-card-reveal');
      node.style.setProperty('--reveal-order', index);
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', `Inspecionar carta revelada: ${cards[index]?.name || ''}`);
      const tag = node.querySelector('.card-type-tag');
      if (tag) tag.textContent = TYPES[cards[index]?.type] || tag.textContent;
      const show = () => node.classList.add('revealed');
      if (reducedMotion()) show();
      else this.revealTimers.push(setTimeout(show, 300 + index * 280));
    });
    const display = document.querySelector('.nexus-pack-display');
    if (display) {
      display.classList.remove('opening');
      requestAnimationFrame(() => display.classList.add('opening'));
    }
  }

  connectUI() {
    const ui = window.uiManager;
    if (!ui) return false;
    if (this.ui === ui) return true;
    this.ui = ui;
    ui.cardInspectModal = $('card-inspect-modal');
    ui.cardInspectClose = $('card-inspect-close');
    const inspect = ui.openCardInspectModal.bind(ui);
    ui.openCardInspectModal = card => {
      if (!card) return;
      this.inspectPreviousFocus = document.activeElement;
      inspect(card);
      const tag = $('card-inspect-preview')?.querySelector('.card-type-tag');
      if (tag) tag.textContent = TYPES[card.type] || card.type;
      $('inspect-card-cost').textContent = `${card.cost} KI`;
      $('inspect-card-power').textContent = card.type === 'defense' ? `${card.block || 0} DEF` : `${card.power || 0} ATK`;
      const meta = card.art || card.artwork || {};
      $('nexus-inspect-image').src = meta.cropPath || assetLoader.getCardImagePath(card.id);
      $('nexus-inspect-image').alt = `Arte completa de ${card.name}`;
      $('nexus-inspect-full-art').hidden = true;
      $('card-inspect-preview').hidden = false;
      $('nexus-inspect-art-toggle').textContent = 'VER ARTE COMPLETA';
      $('card-inspect-close').focus({ preventScroll: true });
    };
    // The existing IDs and controls stay in place. Collection rendering is bounded.
    ui.renderDeckBuilder = () => this.renderDeck();
    const reveal = ui.renderPackReveal.bind(ui);
    ui.renderPackReveal = cards => { reveal(cards); this.animateReveal(cards); };
    const currencies = ui.updateCurrencies.bind(ui);
    ui.updateCurrencies = (...args) => { const result = currencies(...args); this.updateProgress(); return result; };
    const session = ui.updateUserSessionUI.bind(ui);
    ui.updateUserSessionUI = (...args) => { const result = session(...args); this.updateProgress(); return result; };
    const open = packOpener.openPack.bind(packOpener);
    let purchasing = false;
    packOpener.openPack = async (...args) => {
      if (purchasing) return null;
      purchasing = true;
      const button = $('buy-pack-btn');
      if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
      if ($('nexus-shop-status')) $('nexus-shop-status').textContent = 'Abrindo booster…';
      try {
        const result = await open(...args);
        if (!result && $('nexus-shop-status')) $('nexus-shop-status').textContent = 'Booster não aberto. Confira seu saldo e tente novamente.';
        return result;
      } finally {
        purchasing = false;
        if (button) { button.disabled = false; button.setAttribute('aria-busy', 'false'); }
      }
    };
    this.updateProgress();
    this.renderDeck();
    return true;
  }

  updateProgress() {
    const xp = Math.max(0, Number(authManager.user?.xp) || 0);
    const progress = xp % XP_PER_LEVEL;
    if ($('nexus-account-level')) $('nexus-account-level').textContent = `NÍVEL ${levelForXp(xp)} · ${progress}/${XP_PER_LEVEL} XP`;
    if ($('nexus-xp-fill')) $('nexus-xp-fill').style.width = `${progress / XP_PER_LEVEL * 100}%`;
    const owned = CARD_DATABASE.filter(card => deckBuilder.getOwnedCount(card.id) > 0).length;
    if ($('nexus-collection-progress')) $('nexus-collection-progress').textContent = `${owned} / ${CARD_DATABASE.length} TÉCNICAS NA COLEÇÃO`;
  }

  setupAccessibility() {
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest?.('.card[role="button"]');
      if (card && event.target === card) { event.preventDefault(); card.click(); return; }
      if (sceneManager.currentScene === GAME_SCENES.TITLE && (event.target === document.body || event.target === $('scene-title')) && !document.querySelector('.modal-overlay.active')) {
        event.preventDefault(); $('title-press-start-btn')?.click();
      }
    });
    const hand = $('p1-hand');
    if (hand) new MutationObserver(() => {
      hand.querySelectorAll('.card').forEach((card, index) => {
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        const data = this.ui?.gameEngine?.player?.hand?.[index];
        const name = data?.name || card.querySelector('.card-title-text')?.textContent || 'Carta';
        const tag = card.querySelector('.card-type-tag');
        if (tag && data) tag.textContent = TYPES[data.type] || data.type;
        card.setAttribute('aria-label', `${name}. ${card.classList.contains('playable') ? 'Jogar carta' : card.title || 'Indisponível nesta fase'}`);
      });
    }).observe(hand, { childList: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(this.introTimer);
      else if (sceneManager.currentScene === GAME_SCENES.INTRO) this.showIntroChapter(this.introIndex);
    });
  }

  loadArtwork() {
    for (const [path, cssVariable, className] of [['assets/rework/nexus-hero.png', '--nexus-hero-art', 'nexus-has-hero'], ['assets/rework/nexus-ui.png', '--nexus-ui-art', 'nexus-has-texture']]) {
      const artwork = new Image();
      artwork.onload = () => { document.documentElement.style.setProperty(cssVariable, `url("${new URL(path, document.baseURI).href}")`); document.body.classList.add(className); };
      artwork.src = path;
    }
  }

  onScene(id) {
    this.connectUI();
    clearTimeout(this.introTimer);
    document.querySelectorAll('.game-scene').forEach(scene => {
      const inactive = scene.id !== id;
      scene.setAttribute('aria-hidden', String(inactive));
      scene.inert = inactive;
    });
    if (id === GAME_SCENES.MAIN_MENU && !this.introSeen) {
      sceneManager.switchScene(GAME_SCENES.INTRO, { skipTransition: true, silent: true });
      return;
    }
    if (id === GAME_SCENES.INTRO) this.showIntroChapter(0);
    if (id === GAME_SCENES.MAIN_MENU) this.updateProgress();
    if (id === GAME_SCENES.DECK_LAB) this.renderDeck();
    const focusTarget = id === GAME_SCENES.TITLE ? $('title-press-start-btn') : id === GAME_SCENES.INTRO ? $('nexus-intro-next') : null;
    if (focusTarget && !document.querySelector('.modal-overlay.active')) requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }
}

export const nexusPresentation = typeof document !== 'undefined' ? new NexusPresentation() : null;
if (nexusPresentation) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => nexusPresentation.mount(), { once: true });
  else nexusPresentation.mount();
}
