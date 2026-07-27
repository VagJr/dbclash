/**
 * social-manager.js — Social MMO, Profile, Ranked Matchmaking, Titles, Quests, Economy & PWA Manager
 */

class SocialManager {
  constructor() {
    this.storageKey = 'dbtcg_social_profile_v1';
    this.deferredInstallPrompt = null;
    
    // Ranks System
    this.RANKS = [
      { id: 'bronze', name: 'Bronze 🥉', minRR: 0, maxRR: 499, icon: '🥉', color: '#cd7f32' },
      { id: 'silver', name: 'Prata 🥈', minRR: 500, maxRR: 999, icon: '🥈', color: '#c0c0c0' },
      { id: 'gold', name: 'Ouro 🥇', minRR: 1000, maxRR: 1499, icon: '🥇', color: '#ffd700' },
      { id: 'diamond', name: 'Diamante 💎', minRR: 1500, maxRR: 1999, icon: '💎', color: '#00ffff' },
      { id: 'master', name: 'Mestre 🏆', minRR: 2000, maxRR: 2499, icon: '🏆', color: '#ff00ff' },
      { id: 'god', name: 'Deus da Destruição ⚡', minRR: 2500, maxRR: 99999, icon: '⚡', color: '#ff3300' }
    ];

    // Unlockable Titles
    this.TITLES = [
      { id: 'novice', name: 'Guerreiro Iniciante', desc: 'Iniciou a jornada no DBTCG', unlocked: true, icon: '🔰' },
      { id: 'ki_master', name: 'Mestre do Ki', desc: 'Acumulou mais de 50 de Ki em partidas', unlocked: true, icon: '⚡' },
      { id: 'saiyan_legend', name: 'Lenda Saiyajin', desc: 'Alcançou o Rank Ouro nas Partidas Ranqueadas', unlocked: false, icon: '🔥' },
      { id: 'kaioken_master', name: 'Mestre do Kaioken', desc: 'Venceu 5 partidas usando Goku', unlocked: false, icon: '🔴' },
      { id: 'prince_pride', name: 'Orgulho Real', desc: 'Venceu 5 partidas usando Vegeta', unlocked: false, icon: '👑' },
      { id: 'god_destruction', name: 'Destruidor Supremo', desc: 'Alcançou o Rank Deus da Destruição', unlocked: false, icon: '🔮' },
      { id: 'beam_clash_king', name: 'Rei da Disputa de Beam', desc: 'Venceu 10 disputas de feixes de Ki', unlocked: false, icon: '💥' }
    ];

    // Daily & Weekly Quests
    this.DEFAULT_QUESTS = [
      { id: 'q1', type: 'daily', title: 'Vitória Heroica', desc: 'Vence 1 partida em qualquer modo', progress: 0, total: 1, rewardZeni: 250, rewardGems: 10, claimed: false },
      { id: 'q2', type: 'daily', title: 'Explosão de Ki', desc: 'Jogue 5 cartas de Feixe de Ki (Ataque)', progress: 0, total: 5, rewardZeni: 200, rewardGems: 5, claimed: false },
      { id: 'q3', type: 'daily', title: 'Guarda Inquebrável', desc: 'Jogue 3 cartas de Defesa ou Esquiva', progress: 0, total: 3, rewardZeni: 150, rewardGems: 5, claimed: false },
      { id: 'q4', type: 'weekly', title: 'Dominador Ranqueado', desc: 'Vença 3 partidas no Modo Ranqueado', progress: 0, total: 3, rewardZeni: 1000, rewardGems: 50, claimed: false },
      { id: 'q5', type: 'weekly', title: 'Super Despertar', desc: 'Desperte seu Líder 3 vezes', progress: 0, total: 3, rewardZeni: 800, rewardGems: 30, claimed: false }
    ];

    this.profile = this.loadProfile();
    this.initPWA();
  }

  loadProfile() {
    const defaultData = {
      name: 'Guerreiro Z',
      avatarLeader: 'goku',
      activeTitle: 'Guerreiro Iniciante',
      level: 1,
      xp: 0,
      xpToNext: 500,
      zeni: 1250,
      gems: 50,
      rr: 750, // Starts at Silver
      stats: {
        matches: 12,
        wins: 8,
        losses: 4,
        highestRR: 750,
        beamClashesWon: 4,
        cardsPlayed: 85
      },
      titles: this.TITLES,
      quests: this.DEFAULT_QUESTS
    };

    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultData, ...parsed };
      }
    } catch (e) {
      console.warn('Could not load social profile:', e);
    }
    return defaultData;
  }

  saveProfile() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
    } catch (e) {
      console.warn('Could not save profile:', e);
    }
    this.updateHeaderCurrencies();
  }

  getRankInfo(rr = this.profile.rr) {
    for (let i = this.RANKS.length - 1; i >= 0; i--) {
      if (rr >= this.RANKS[i].minRR) {
        return this.RANKS[i];
      }
    }
    return this.RANKS[0];
  }

  addXP(amount) {
    this.profile.xp += amount;
    let leveledUp = false;
    while (this.profile.xp >= this.profile.xpToNext) {
      this.profile.xp -= this.profile.xpToNext;
      this.profile.level += 1;
      this.profile.xpToNext = Math.floor(this.profile.xpToNext * 1.3);
      this.profile.zeni += 500;
      this.profile.gems += 25;
      leveledUp = true;
    }
    this.saveProfile();
    return leveledUp;
  }

  updateHeaderCurrencies() {
    const zeniEl = document.getElementById('user-zeni');
    const gemsEl = document.getElementById('user-gems');
    const rankEl = document.getElementById('user-rank-tag');
    
    if (zeniEl) zeniEl.textContent = this.profile.zeni.toLocaleString();
    if (gemsEl) gemsEl.textContent = this.profile.gems.toLocaleString();
    if (rankEl) {
      const rank = this.getRankInfo();
      rankEl.innerHTML = `<span style="color:${rank.color}">${rank.icon} ${rank.name} (${this.profile.rr} RR)</span>`;
    }
  }

  // Record Ranked Match Result
  recordMatchResult(isWin, isRanked = false, details = {}) {
    this.profile.stats.matches += 1;
    let rrChange = 0;
    
    if (isWin) {
      this.profile.stats.wins += 1;
      rrChange = isRanked ? 25 : 10;
      this.addXP(150);
      this.profile.zeni += 200;
      this.trackQuestProgress('q1', 1);
      if (isRanked) this.trackQuestProgress('q4', 1);
    } else {
      this.profile.stats.losses += 1;
      rrChange = isRanked ? -15 : -5;
      this.addXP(50);
      this.profile.zeni += 50;
    }

    this.profile.rr = Math.max(0, this.profile.rr + rrChange);
    if (this.profile.rr > this.profile.stats.highestRR) {
      this.profile.stats.highestRR = this.profile.rr;
    }

    // Check rank unlocked titles
    const curRank = this.getRankInfo();
    if (curRank.id === 'gold') this.unlockTitle('saiyan_legend');
    if (curRank.id === 'god') this.unlockTitle('god_destruction');

    this.saveProfile();
    return { isWin, rrChange, newRR: this.profile.rr, rank: curRank };
  }

  unlockTitle(titleId) {
    const t = this.profile.titles.find(x => x.id === titleId);
    if (t && !t.unlocked) {
      t.unlocked = true;
      this.saveProfile();
      if (window.uiManager) {
        window.uiManager.triggerActionBanner(`🏆 TÍTULO DESBLOQUEADO: ${t.name}!`, 'gold');
      }
    }
  }

  equipTitle(titleName) {
    this.profile.activeTitle = titleName;
    this.saveProfile();
    this.renderProfileView();
  }

  trackQuestProgress(questId, amount = 1) {
    const q = this.profile.quests.find(x => x.id === questId);
    if (q && !q.claimed) {
      q.progress = Math.min(q.total, q.progress + amount);
      this.saveProfile();
    }
  }

  claimQuestReward(questId) {
    const q = this.profile.quests.find(x => x.id === questId);
    if (q && q.progress >= q.total && !q.claimed) {
      q.claimed = true;
      this.profile.zeni += q.rewardZeni;
      this.profile.gems += q.rewardGems;
      this.saveProfile();
      if (window.uiManager) {
        window.uiManager.triggerActionBanner(`🎁 RECOMPENSA RESGATADA! +${q.rewardZeni} Zeni | +${q.rewardGems} Gemas`, 'green');
      }
      this.renderQuestsView();
    }
  }

  // Render Player Profile Screen
  renderProfileView() {
    const container = document.getElementById('profile-view-content');
    if (!container) return;

    const rank = this.getRankInfo();
    const winRate = this.profile.stats.matches > 0 
      ? Math.round((this.profile.stats.wins / this.profile.stats.matches) * 100) 
      : 0;

    const leaderImg = `assets/leaders/${this.profile.avatarLeader}.png`;

    container.innerHTML = `
      <div class="profile-card-header grid-2col">
        <div class="profile-avatar-box">
          <div class="leader-avatar-wrapper">
            <img src="${leaderImg}" alt="Avatar" class="profile-leader-img" onerror="this.src='assets/cards/goku.png'">
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-change-avatar" style="margin-top:10px;">📸 Mudar Avatar</button>
        </div>

        <div class="profile-details-box">
          <div class="profile-name-row">
            <h2 class="player-title-name">${this.profile.name}</h2>
            <span class="active-title-badge">${this.profile.activeTitle}</span>
          </div>

          <div class="level-progress-bar">
            <div class="level-info">
              <span>Nível ${this.profile.level}</span>
              <span>${this.profile.xp} / ${this.profile.xpToNext} XP</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width: ${(this.profile.xp / this.profile.xpToNext)*100}%"></div></div>
          </div>

          <div class="rank-badge-card" style="border-color:${rank.color}; background: linear-gradient(135deg, rgba(12,15,29,0.9), ${rank.color}22);">
            <div class="rank-icon-big">${rank.icon}</div>
            <div class="rank-info-text">
              <h4 style="color:${rank.color}">${rank.name}</h4>
              <p>${this.profile.rr} Pontos de Rank (RR)</p>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-stats-grid">
        <div class="stat-box">
          <span class="stat-num">${this.profile.stats.matches}</span>
          <span class="stat-lbl">Partidas Totais</span>
        </div>
        <div class="stat-box">
          <span class="stat-num" style="color:var(--accent-green)">${this.profile.stats.wins}</span>
          <span class="stat-lbl">Vitórias</span>
        </div>
        <div class="stat-box">
          <span class="stat-num" style="color:var(--accent-red)">${this.profile.stats.losses}</span>
          <span class="stat-lbl">Derrotas</span>
        </div>
        <div class="stat-box">
          <span class="stat-num" style="color:var(--accent-gold)">${winRate}%</span>
          <span class="stat-lbl">Taxa de Vitória</span>
        </div>
        <div class="stat-box">
          <span class="stat-num">${this.profile.stats.highestRR}</span>
          <span class="stat-lbl">Maior Rank (RR)</span>
        </div>
      </div>

      <!-- Titles Section -->
      <div class="titles-section-box">
        <h3>🏆 Títulos & Insígnias</h3>
        <div class="titles-grid">
          ${this.profile.titles.map(t => `
            <div class="title-item ${t.unlocked ? 'unlocked' : 'locked'} ${t.name === this.profile.activeTitle ? 'active-equipped' : ''}" 
                 onclick="window.socialManager.equipTitle('${t.name}')">
              <span class="title-icon">${t.icon}</span>
              <div class="title-info">
                <span class="title-text-name">${t.name}</span>
                <span class="title-desc">${t.desc}</span>
              </div>
              ${t.unlocked ? (t.name === this.profile.activeTitle ? '<span class="badge-equip">Equipado</span>' : '<button class="btn-xs">Equipar</button>') : '<span class="badge-lock">🔒 Bloqueado</span>'}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-change-avatar')?.addEventListener('click', () => {
      this.openAvatarSelectModal();
    });
  }

  openAvatarSelectModal() {
    const leaders = ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks'];
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <h3>📸 Escolha seu Avatar de Líder</h3>
        <div class="avatar-selection-grid">
          ${leaders.map(l => `
            <div class="avatar-option ${l === this.profile.avatarLeader ? 'selected' : ''}" onclick="window.socialManager.selectAvatar('${l}')">
              <img src="assets/leaders/${l}.png" alt="${l}">
              <span>${l.toUpperCase()}</span>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary modal-close-btn" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  selectAvatar(leaderId) {
    this.profile.avatarLeader = leaderId;
    this.saveProfile();
    document.querySelector('.modal-overlay')?.remove();
    this.renderProfileView();
  }

  // Render Ranked Queue Screen
  renderRankedView() {
    const container = document.getElementById('ranked-view-content');
    if (!container) return;

    const curRank = this.getRankInfo();

    container.innerHTML = `
      <div class="ranked-banner-hero">
        <div class="ranked-rank-main">
          <div class="rank-emblem" style="border-color:${curRank.color}">${curRank.icon}</div>
          <h2 style="color:${curRank.color}">${curRank.name}</h2>
          <p class="rr-counter">${this.profile.rr} RR</p>
        </div>
        <div class="ranked-actions-cta">
          <h3>Partidas Ranqueadas da Temporada 1</h3>
          <p>Dispute ELO, suba de divisão e ganhe prêmios exclusivos de Zeni e Gemas!</p>
          <button class="btn btn-gold btn-lg pulse-glow" id="btn-start-ranked-match">⚔️ BUSCAR PARTIDA RANQUEADA</button>
        </div>
      </div>

      <div class="ranked-divisions-ladder">
        <h3>🏆 Escala da Temporada (Divisões)</h3>
        <div class="ladder-grid">
          ${this.RANKS.map(r => `
            <div class="ladder-item ${r.id === curRank.id ? 'current-user-rank' : ''}">
              <span class="ladder-icon">${r.icon}</span>
              <div class="ladder-info">
                <strong style="color:${r.color}">${r.name}</strong>
                <span>${r.minRR} - ${r.maxRR === 99999 ? '∞' : r.maxRR} RR</span>
              </div>
              ${r.id === curRank.id ? '<span class="your-rank-tag">SUA DIVISÃO</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-start-ranked-match')?.addEventListener('click', () => {
      this.simulateRankedMatchmaking();
    });
  }

  simulateRankedMatchmaking() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card matchmaking-modal">
        <div class="spinner-beam"></div>
        <h3>⚔️ Procurando Oponente Ranqueado...</h3>
        <p>Buscando jogador de nível equivalente nas proximidades (${this.profile.rr} RR)...</p>
      </div>
    `;
    document.body.appendChild(modal);

    setTimeout(() => {
      modal.remove();
      if (window.uiManager) {
        window.uiManager.switchTab('arena');
        if (window.gameEngine) {
          window.gameEngine.startMatch('ranked');
        }
      }
    }, 2200);
  }

  // Render Quests View
  renderQuestsView() {
    const container = document.getElementById('quests-view-content');
    if (!container) return;

    container.innerHTML = `
      <div class="quests-container">
        <h2>📜 Missões Diárias & Semanais</h2>
        <div class="quests-list">
          ${this.profile.quests.map(q => `
            <div class="quest-card ${q.claimed ? 'claimed' : (q.progress >= q.total ? 'ready' : '')}">
              <div class="quest-info">
                <span class="quest-type-tag ${q.type}">${q.type === 'daily' ? 'Diária' : 'Semanal'}</span>
                <h4>${q.title}</h4>
                <p>${q.desc}</p>
                <div class="quest-progress-bar">
                  <div class="progress-fill" style="width:${(q.progress / q.total)*100}%"></div>
                  <span class="progress-num">${q.progress} / ${q.total}</span>
                </div>
              </div>
              <div class="quest-reward-box">
                <span class="reward-val">💰 +${q.rewardZeni} Zeni | 💎 +${q.rewardGems}</span>
                ${q.claimed 
                  ? '<button class="btn btn-secondary btn-sm" disabled>Concluído</button>'
                  : (q.progress >= q.total 
                    ? `<button class="btn btn-gold btn-sm pulse-glow" onclick="window.socialManager.claimQuestReward('${q.id}')">Resgatar</button>`
                    : '<button class="btn btn-secondary btn-sm" disabled>Em Progresso</button>')
                }
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // PWA Registration & Banner Setup
  initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('[PWA] Service Worker registrado com sucesso:', reg.scope);
        }).catch((err) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err);
        });
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      this.showPWAInstallPrompt();
    });
  }

  showPWAInstallPrompt() {
    const existing = document.getElementById('pwa-install-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-banner-card';
    banner.innerHTML = `
      <div class="pwa-banner-content">
        <span class="pwa-icon">📱</span>
        <div class="pwa-text">
          <strong>Baixar App DBTCG para Celular Android!</strong>
          <span>Instale o aplicativo em tela cheia e jogue como um App nativo.</span>
        </div>
        <button class="btn btn-gold btn-sm" id="btn-install-pwa">Instalar App</button>
        <button class="pwa-close-btn" onclick="this.closest('#pwa-install-banner').remove()">✕</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('btn-install-pwa')?.addEventListener('click', () => {
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        this.deferredInstallPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] Usuário aceitou instalar o App!');
          }
          this.deferredInstallPrompt = null;
          banner.remove();
        });
      }
    });
  }
}

// Global Export
window.socialManager = new SocialManager();
