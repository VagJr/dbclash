import { authManager } from './auth-manager.js';
import { CARD_DATABASE, getCardById } from './card-database.js';
import { transferableCopies, MAX_LISTING_PRICE } from './exchange-rules.js';
import { escapeHtml } from './safe-dom.js';

class ExchangeManager {
  constructor() { this.mode = 'sale'; this.own = false; this.busy = false; this.revision = 0; }
  init() {
    const shop = document.getElementById('scene-shop');
    if (!shop || document.getElementById('nexus-exchange-button')) return;
    const button = document.createElement('button');
    button.id = 'nexus-exchange-button'; button.className = 'btn-ghost'; button.textContent = 'MERCADO & TROCAS';
    button.addEventListener('click', () => this.open());
    (shop.querySelector('.shop-header') || shop.querySelector('.shop-inner') || shop).appendChild(button);
    this.modal = document.createElement('dialog');
    this.modal.className = 'nexus-exchange-dialog';
    this.modal.innerHTML = `<div class="nexus-exchange-head"><div><small>NEXUS / REDE DE CARTAS</small><h2>Mercado & trocas</h2></div><button type="button" data-close aria-label="Fechar mercado">×</button></div>
      <p>Negocie cópias disponíveis com outros jogadores. Cartas dos decks e cópias iniciais ficam protegidas.</p>
      <div class="nexus-exchange-tabs"><button data-kind="sale">Mercado</button><button data-kind="trade">Trocas</button><label><input type="checkbox" data-own> Minhas ofertas</label><button data-refresh>Atualizar</button></div>
      <p class="nexus-exchange-status" role="status" aria-live="polite"></p>
      <form class="nexus-exchange-form"><label>Sua carta<select name="cardId" required></select></label><label data-price>Preço em Zeni<input type="number" name="price" min="1" max="${MAX_LISTING_PRICE}" value="300" required></label><label data-requested hidden>Carta solicitada<select name="requestedCardId"></select></label><button type="submit" class="btn-ki">Criar oferta</button></form>
      <div class="nexus-exchange-list"></div>`;
    document.body.appendChild(this.modal);
    this.modal.querySelector('[data-close]').onclick = () => this.modal.close();
    this.modal.addEventListener('close', () => { this.revision += 1; });
    this.modal.querySelector('[data-refresh]').onclick = () => this.load();
    this.modal.querySelector('[data-own]').onchange = event => { this.own = event.target.checked; this.load(); };
    for (const tab of this.modal.querySelectorAll('[data-kind]')) {
      tab.onclick = () => { this.mode = tab.dataset.kind; this.syncForm(); this.load(); };
    }
    this.modal.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const body = { kind: this.mode, cardId: form.elements.cardId.value,
        price: Number(form.elements.price.value), requestedCardId: form.elements.requestedCardId.value };
      const fingerprint = JSON.stringify(body);
      if (fingerprint !== this.lastFingerprint) {
        this.requestId = crypto.randomUUID(); this.lastFingerprint = fingerprint;
      }
      const success = await this.mutate('/api/exchange', { ...body, requestId: this.requestId });
      if (success) this.lastFingerprint = null;
    };
  }
  status(text) { this.modal.querySelector('[role="status"]').textContent = text; }
  syncForm() {
    const form = this.modal.querySelector('form');
    const previousCard = form.elements.cardId.value;
    const previousRequested = form.elements.requestedCardId.value;
    const available = CARD_DATABASE.filter(card => transferableCopies(authManager.user || {}, card.id) > 0);
    form.elements.cardId.innerHTML = available.map(card => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name)} · ${transferableCopies(authManager.user, card.id)} livre(s)</option>`).join('');
    form.elements.requestedCardId.innerHTML = CARD_DATABASE.map(card => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name)}</option>`).join('');
    if (available.some(card => card.id === previousCard)) form.elements.cardId.value = previousCard;
    if (getCardById(previousRequested)) form.elements.requestedCardId.value = previousRequested;
    form.querySelector('[data-price]').hidden = this.mode !== 'sale';
    form.elements.price.required = this.mode === 'sale';
    form.elements.price.disabled = this.mode !== 'sale';
    form.querySelector('[data-requested]').hidden = this.mode !== 'trade';
    form.querySelector('[type="submit"]').disabled = this.busy || !available.length || !authManager.isLoggedIn;
    for (const tab of this.modal.querySelectorAll('[data-kind]')) tab.setAttribute('aria-pressed', String(this.mode === tab.dataset.kind));
  }
  async open() {
    this.modal.showModal(); this.syncForm();
    if (!authManager.isLoggedIn) {
      this.status('Entre em uma conta online para acessar o mercado e as trocas entre jogadores.');
      this.modal.querySelector('.nexus-exchange-list').replaceChildren(); return;
    }
    await this.load();
  }
  async load() {
    if (!authManager.isLoggedIn) return;
    const revision = ++this.revision;
    this.status('Carregando ofertas...');
    try {
      const { data } = await authManager.request(`/api/exchange?kind=${this.mode}&own=${this.own ? '1' : '0'}`);
      if (revision !== this.revision || !this.modal.open) return;
      if (!data.success) throw new Error(data.message || 'Mercado indisponível.');
      const listings = Array.isArray(data.listings) ? data.listings : [];
      this.status(listings.length ? `${listings.length} oferta(s) · as ofertas vencem em 7 dias.` : 'Nenhuma oferta disponível.');
      const list = this.modal.querySelector('.nexus-exchange-list');
      list.replaceChildren();
      for (const listing of listings) {
        const card = getCardById(listing.cardId); if (!card) continue;
        const own = listing.sellerUid === authManager.user.uid;
        const expired = Number(new Date(listing.expiresAt)) <= Date.now();
        const row = document.createElement('article');
        row.innerHTML = `<div><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(listing.sellerName)} · ${listing.kind === 'sale' ? `${Number(listing.price)} Zeni` : `por ${escapeHtml(getCardById(listing.requestedCardId)?.name || '')}`}${expired ? ' · expirada' : ''}</small></div><button class="btn-ghost" type="button">${own ? 'Recuperar carta' : listing.kind === 'sale' ? 'Comprar' : 'Trocar'}</button>`;
        const action = row.querySelector('button');
        action.disabled = this.busy || (expired && !own);
        action.onclick = () => this.mutate(`/api/exchange/${encodeURIComponent(listing.id)}/${own ? 'cancel' : 'accept'}`, {});
        list.appendChild(row);
      }
    } catch (error) { if (revision === this.revision) this.status(error.message || 'Conexão indisponível.'); }
  }
  async mutate(url, body) {
    if (this.busy || !authManager.isLoggedIn) return false;
    const uid = authManager.user.uid;
    this.busy = true; this.status('Concluindo negociação...'); this.syncForm();
    this.modal.querySelectorAll('.nexus-exchange-list button').forEach(button => { button.disabled = true; });
    try {
      const { data } = await authManager.request(url, { method: 'POST', body: JSON.stringify(body) });
      if (!data.success || !data.user) throw new Error(data.message || 'Negociação indisponível.');
      if (authManager.user?.uid === uid) {
        authManager.user = authManager.normalizeUser(data.user); authManager.saveLocalCache();
        window.uiManager?.updateCurrencies(); window.uiManager?.renderDeckBuilder();
      }
      this.busy = false; this.syncForm();
      await this.load(); this.status('Negociação concluída. Coleção e saldo atualizados.'); return true;
    } catch (error) {
      this.busy = false; this.syncForm(); await this.load(); this.status(error.message || 'Não foi possível concluir a negociação.'); return false;
    }
  }
}
export const exchangeManager = new ExchangeManager();
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => exchangeManager.init());
  else exchangeManager.init();
}
