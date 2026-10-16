import { authManager } from './auth-manager.js';
import { socketManager } from './socket-config.js';

class SocialManager {
  constructor() {
    this.multiplayer = null;
    this.bound = false;
    this.privateModal = null;
    this.initSocketListeners();
  }

  bind({ multiplayer } = {}) {
    this.multiplayer = multiplayer || this.multiplayer;
    if (this.bound) return;
    this.bound = true;
    this.injectPrivateRoomButton();
  }

  initSocketListeners() {
    socketManager.on('private_room_created', payload => this.showPrivateRoomStatus(payload));
    socketManager.on('private_room_status', payload => this.showPrivateRoomStatus(payload));
    socketManager.on('private_room_error', payload => {
      if (typeof alert !== 'undefined') alert(payload?.message || 'Falha na sala privada.');
    });
  }

  injectPrivateRoomButton() {
    if (typeof document === 'undefined') return;
    const host = document.querySelector('.menu-arc-left');
    if (!host || document.getElementById('menu-btn-private-room')) return;

    const button = document.createElement('button');
    button.id = 'menu-btn-private-room';
    button.className = 'aaa-mode-card';
    button.innerHTML = `
      <div class="amc-badge">CONVITE</div>
      <div class="amc-title">🔐 SALA PRIVADA</div>
      <div class="amc-sub">Crie ou entre por codigo em 1v1 / 2v2</div>`;
    button.addEventListener('click', () => this.openPrivateRoomModal());
    host.appendChild(button);
  }

  ensurePrivateModal() {
    if (typeof document === 'undefined') return null;
    if (this.privateModal?.isConnected) return this.privateModal;

    const modal = document.createElement('div');
    modal.id = 'private-room-modal';
    modal.className = 'modal-overlay active';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="glass modal-box" style="max-width:520px;width:92%;padding:24px;text-align:center;">
        <div style="font-size:1.4rem;font-weight:900;color:#ffd166;">🔐 SALA PRIVADA</div>
        <p style="opacity:.75;">Convide amigos por codigo. A sala pode ser 1v1 ou Tag Team 2v2.</p>
        <select id="private-room-mode" class="modal-input" style="width:100%;padding:10px;margin:8px 0;">
          <option value="1v1">1v1</option>
          <option value="2v2">2v2 Tag Team</option>
        </select>
        <button id="private-create-btn" class="btn-ki" style="width:100%;margin:8px 0;">CRIAR SALA</button>
        <div style="margin:18px 0 8px;font-size:.8rem;opacity:.6;">OU ENTRE COM O CODIGO</div>
        <input id="private-room-code" class="modal-input" maxlength="6" placeholder="ABC123" style="text-transform:uppercase;width:100%;padding:10px;">
        <button id="private-join-btn" class="btn-ghost" style="width:100%;margin:8px 0;">ENTRAR NA SALA</button>
        <div id="private-room-status" style="min-height:54px;margin:12px 0;padding:10px;border-radius:8px;background:rgba(0,0,0,.25);"></div>
        <button id="private-leave-btn" class="btn-ghost" style="width:48%;">SAIR DA SALA</button>
        <button id="private-close-btn" class="btn-ghost" style="width:48%;">FECHAR</button>
      </div>`;

    document.body.appendChild(modal);
    this.privateModal = modal;

    modal.querySelector('#private-create-btn')?.addEventListener('click', () => {
      const mode = modal.querySelector('#private-room-mode')?.value || '1v1';
      this.multiplayer?.createPrivateRoom(mode);
    });

    modal.querySelector('#private-join-btn')?.addEventListener('click', () => {
      const code = String(modal.querySelector('#private-room-code')?.value || '').trim().toUpperCase();
      this.multiplayer?.joinPrivateRoom(code);
    });

    modal.querySelector('#private-leave-btn')?.addEventListener('click', () => {
      this.multiplayer?.leavePrivateLobby();
      this.showPrivateRoomStatus({ code: null, count: 0, required: 0 });
    });

    modal.querySelector('#private-close-btn')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    return modal;
  }

  openPrivateRoomModal() {
    if (!authManager.isLoggedIn) {
      if (typeof alert !== 'undefined') alert('Salas privadas online exigem uma conta autenticada.');
      return;
    }
    const modal = this.ensurePrivateModal();
    if (modal) modal.style.display = 'flex';
  }

  showPrivateRoomStatus(payload = {}) {
    const modal = this.ensurePrivateModal();
    if (!modal) return;
    modal.style.display = 'flex';
    const status = modal.querySelector('#private-room-status');
    if (!status) return;

    if (!payload.code) {
      status.textContent = 'Nenhuma sala ativa.';
      return;
    }

    status.textContent = `Codigo ${payload.code} — ${payload.count || 1}/${payload.required || 2} jogadores (${payload.mode || '1v1'}).`;
    const codeInput = modal.querySelector('#private-room-code');
    if (codeInput) codeInput.value = payload.code;
  }

  async renderDojos() {
    const container = document.getElementById('dojo-list-container');
    if (!container) return;
    container.textContent = 'Carregando Dojos...';

    if (!authManager.isLoggedIn) {
      container.textContent = 'Entre em uma conta online para participar de Dojos.';
      return;
    }

    try {
      const [{ data: listData }, { data: mineData }] = await Promise.all([
        authManager.request('/api/dojos'),
        authManager.request('/api/dojos/mine')
      ]);

      container.innerHTML = '';

      const controls = document.createElement('div');
      controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;';

      if (mineData?.dojo) {
        const mine = document.createElement('div');
        mine.style.cssText = 'width:100%;padding:14px;border:1px solid #ffd166;border-radius:10px;text-align:left;';
        const title = document.createElement('div');
        title.style.fontWeight = '900';
        title.textContent = `SEU DOJO: [${mineData.dojo.tag}] ${mineData.dojo.name}`;
        const meta = document.createElement('div');
        meta.textContent = `${mineData.dojo.membersCount} membros | ${mineData.dojo.power} PWR`;
        const leave = document.createElement('button');
        leave.className = 'btn-ghost';
        leave.textContent = 'SAIR DO DOJO';
        leave.style.marginTop = '8px';
        leave.addEventListener('click', async () => {
          await authManager.request('/api/dojos/leave', { method: 'POST', body: '{}' });
          await authManager.refreshProfile();
          this.renderDojos();
        });
        mine.append(title, meta, leave);
        container.appendChild(mine);
      } else {
        const create = document.createElement('button');
        create.className = 'btn-ki';
        create.textContent = 'CRIAR DOJO';
        create.addEventListener('click', async () => {
          const name = prompt('Nome do Dojo (3-24 caracteres):');
          if (!name) return;
          const tag = prompt('TAG do Dojo (2-6 letras/numeros):');
          if (!tag) return;
          const { data } = await authManager.request('/api/dojos/create', {
            method: 'POST',
            body: JSON.stringify({ name, tag })
          });
          if (!data.success) alert(data.message || 'Nao foi possivel criar o Dojo.');
          await authManager.refreshProfile();
          this.renderDojos();
        });
        controls.appendChild(create);
        container.appendChild(controls);
      }

      const dojos = Array.isArray(listData?.dojos) ? listData.dojos : [];
      for (const dojo of dojos) {
        const row = document.createElement('div');
        row.className = 'dojo-row';

        const info = document.createElement('div');
        info.style.cssText = 'display:flex;align-items:center;gap:10px;text-align:left;';
        const rank = document.createElement('span');
        rank.className = 'dojo-rank';
        rank.textContent = `#${dojo.rank}`;
        const text = document.createElement('span');
        text.textContent = `[${dojo.tag}] ${dojo.name} — ${dojo.membersCount}/30 membros`;
        info.append(rank, text);

        const right = document.createElement('div');
        right.style.cssText = 'display:flex;align-items:center;gap:8px;';
        const power = document.createElement('span');
        power.className = 'dojo-power';
        power.textContent = `${dojo.power} PWR`;
        right.appendChild(power);

        if (!mineData?.dojo) {
          const join = document.createElement('button');
          join.className = 'btn-ghost';
          join.textContent = 'ENTRAR';
          join.addEventListener('click', async () => {
            const { data } = await authManager.request('/api/dojos/join', {
              method: 'POST',
              body: JSON.stringify({ dojoId: dojo.id })
            });
            if (!data.success) alert(data.message || 'Nao foi possivel entrar no Dojo.');
            await authManager.refreshProfile();
            this.renderDojos();
          });
          right.appendChild(join);
        }

        row.append(info, right);
        container.appendChild(row);
      }
    } catch {
      container.textContent = 'Nao foi possivel carregar Dojos agora.';
    }
  }

  async renderQuests() {
    const container = document.getElementById('quests-view-content');
    if (!container) return;
    container.textContent = 'Carregando missoes...';

    if (!authManager.isLoggedIn) {
      container.textContent = 'Entre em uma conta online para progredir nas missoes diarias.';
      return;
    }

    try {
      const { data } = await authManager.request('/api/quests/daily');
      container.innerHTML = '';
      const quests = Array.isArray(data?.quests) ? data.quests : [];

      for (const quest of quests) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:14px;background:rgba(255,255,255,.04);border-radius:8px;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:12px;';

        const left = document.createElement('div');
        const title = document.createElement('div');
        title.style.cssText = 'color:#fff;font-weight:800;';
        title.textContent = quest.title;
        const progress = document.createElement('div');
        progress.style.cssText = 'color:#aaa;font-size:.8rem;';
        progress.textContent = `Progresso ${quest.progress}/${quest.target} | Recompensa: ${quest.reward.zeni || 0} Zeni, ${quest.reward.dust || 0} Dust, ${quest.reward.gems || 0} Gem`;
        left.append(title, progress);

        const button = document.createElement('button');
        button.className = quest.claimed ? 'btn-ghost' : 'btn-ki';
        button.disabled = quest.claimed || !quest.completed;
        button.textContent = quest.claimed ? 'RESGATADA' : quest.completed ? 'RESGATAR' : 'EM PROGRESSO';
        button.addEventListener('click', async () => {
          const { data: claimData } = await authManager.request('/api/quests/claim', {
            method: 'POST',
            body: JSON.stringify({ questId: quest.id })
          });
          if (!claimData.success) {
            alert(claimData.message || 'Nao foi possivel resgatar a missao.');
            return;
          }
          if (claimData.user) {
            authManager.user = authManager.normalizeUser(claimData.user);
            authManager.user.isGuest = false;
            authManager.saveLocalCache();
          }
          this.renderQuests();
        });

        row.append(left, button);
        container.appendChild(row);
      }
    } catch {
      container.textContent = 'Nao foi possivel carregar missoes agora.';
    }
  }
}

export const socialManager = new SocialManager();
