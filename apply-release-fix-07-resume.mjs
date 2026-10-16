import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
}

function findBraceRange(src, startIndex) {
  const brace = src.indexOf('{', startIndex);
  if (brace < 0) throw new Error('Bloco sem chave de abertura.');

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { start: startIndex, brace, end: i + 1 };
    }
  }

  throw new Error('Bloco sem chave de fechamento.');
}

function findClassMethod(src, methodName) {
  const patterns = [
    new RegExp(`\\n  ${methodName}\\([^\\n]*\\) \\{`),
    new RegExp(`\\n  async ${methodName}\\([^\\n]*\\) \\{`)
  ];

  for (const re of patterns) {
    const match = re.exec(src);
    if (match) {
      const start = match.index + 1;
      return findBraceRange(src, start);
    }
  }

  throw new Error(`Metodo nao encontrado: ${methodName}`);
}

function replaceClassMethod(src, methodName, replacement) {
  const range = findClassMethod(src, methodName);
  return src.slice(0, range.start) + replacement.trimEnd() + src.slice(range.end);
}

function injectMethodPrelude(src, methodName, prelude, idempotencyMarker = null) {
  if (idempotencyMarker && src.includes(idempotencyMarker)) return src;

  const range = findClassMethod(src, methodName);
  const brace = src.indexOf('{', range.start);

  return src.slice(0, brace + 1) + '\n' + prelude + src.slice(brace + 1);
}

function replaceListenerBlock(src, marker, replacement) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Listener nao encontrado: ${marker}`);

  const range = findBraceRange(src, start);
  const suffix = src.indexOf(');', range.end);
  if (suffix < 0 || suffix - range.end > 12) {
    throw new Error(`Fim do listener nao encontrado: ${marker}`);
  }

  return src.slice(0, start) + replacement.trimEnd() + src.slice(suffix + 2);
}

function insertBeforeMethod(src, methodName, block) {
  if (src.includes(block.trim().split('\n')[0])) return src;
  const range = findClassMethod(src, methodName);
  return src.slice(0, range.start) + block.trimEnd() + '\n\n' + src.slice(range.start);
}

function requireFile(rel) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`Arquivo esperado ausente: ${rel}`);
  }
}

// ---------------------------------------------------------------------
// Validate partial Fix 07 state from first attempt.
// ---------------------------------------------------------------------
for (const rel of [
  'server/security-middleware.js',
  'js/safe-dom.js',
  'js/runtime-guard.js',
  'sw.js',
  'js/team-ui.js',
  'js/raid-engine.js',
  'scripts/test-release-polish.mjs',
  'scripts/release-static-audit.mjs'
]) requireFile(rel);

const hardenedServer = read('server.js');
if (!hardenedServer.includes("installHttpSecurity(app)")) {
  throw new Error('Primeira metade do Fix 07 nao foi detectada em server.js. Nao use este hotfix.');
}
if (!hardenedServer.includes("installSocketPacketGuard(io)")) {
  throw new Error('Socket hardening do Fix 07 nao foi detectado. Nao use este hotfix.');
}

const hardenedServerEngine = read('server/server-engine.js');
if (!hardenedServerEngine.includes('reactionDeadline')) {
  throw new Error('Reaction deadline do Fix 07 nao foi detectado em server-engine.js.');
}

console.log('[OK] primeira metade do Fix 07 confirmada');

// ---------------------------------------------------------------------
// Client reaction timer: robust method-based patch, independent of reset body.
// ---------------------------------------------------------------------
let clientEngine = read('js/game-engine.js');

clientEngine = injectMethodPrelude(
  clientEngine,
  'reset',
  `    if (this.remoteReactionTimer) {
      clearInterval(this.remoteReactionTimer);
      this.remoteReactionTimer = null;
    }`,
  'if (this.remoteReactionTimer)'
);

clientEngine = replaceClassMethod(clientEngine, 'applyFullSyncState', `  applyFullSyncState(data) {
    if (!data || this.isAiMatch) return;

    const oldState = this.state;
    this.state = data.state;
    this.initiative = data.initiative;
    this.winner = data.winner || null;
    this.pendingAttack = data.pendingAttack || null;
    this.beamClashData = data.beamClashData || null;
    this.reactionSecondsLeft = Number(data.reactionSecondsLeft ?? 0);
    this.reactionMaxSeconds = Number(data.reactionMaxSeconds ?? 3.0);
    this.reactionDeadline = Number(data.reactionDeadline || 0);

    const applyFighter = (target, source) => {
      if (!source) return;
      target.name = source.name || target.name;
      target.hp = source.hp;
      target.maxHp = source.maxHp;
      target.ki = source.ki;
      target.shields = source.shields;
      target.isAwakened = !!source.isAwakened;
      target.isOpenGuard = !!source.isOpenGuard;
      target.nextAttackBonus = Number(source.nextAttackBonus || 0);
      target.hand = Array.isArray(source.hand) ? source.hand : [];
      target.discard = Array.isArray(source.discard) ? source.discard : [];
      target.deck = Array.from({ length: Number(source.deckCount || 0) }, () => '__hidden__');
      if (source.leader) target.leader = source.leader;
    };

    applyFighter(this.player, data.player);
    applyFighter(this.opponent, data.opponent);

    if (oldState !== 'BEAM_CLASH' && this.state === 'BEAM_CLASH') {
      this.log('DISPUTA DE BEAM!', 'info');
    }

    if (this.remoteReactionTimer) {
      clearInterval(this.remoteReactionTimer);
      this.remoteReactionTimer = null;
    }

    if (this.state === 'ATTACK_PENDING' && this.onTimerTick) {
      const fallbackDeadline = Date.now() + Math.max(0, this.reactionSecondsLeft) * 1000;
      const deadline = this.reactionDeadline || fallbackDeadline;

      const tick = () => {
        const remaining = Math.max(0, (deadline - Date.now()) / 1000);
        this.reactionSecondsLeft = remaining;
        this.onTimerTick(remaining, this.reactionMaxSeconds);

        if (remaining <= 0 && this.remoteReactionTimer) {
          clearInterval(this.remoteReactionTimer);
          this.remoteReactionTimer = null;
        }
      };

      tick();
      this.remoteReactionTimer = setInterval(tick, 50);
    }

    if (this.state === 'GAME_OVER') this.checkGameOver();
    this.notifyState();
  }`);

write('js/game-engine.js', clientEngine);
console.log('[OK] js/game-engine.js');

// ---------------------------------------------------------------------
// UI safety, duplicate handler cleanup, dev-gating and animation QoL.
// ---------------------------------------------------------------------
let ui = read('js/ui-manager.js');

ui = ui.replace("import { authDatabase } from './auth-database.js';\n", '');
ui = ui.replace('import { authDatabase } from "./auth-database.js";\n', '');

ui = ui.replace(/\n\s*document\.getElementById\('close-ko-btn'\)\?\.addEventListener\('click', \(\) => \{\s*this\.koModal\?\.classList\.remove\('active'\);\s*this\.switchTab\('lobby'\);\s*\}\);\s*/m, '\n');

ui = replaceClassMethod(ui, 'startFighterSpriteLoop', `  startFighterSpriteLoop() {
    if (this._fighterLoopStarted) return;
    this._fighterLoopStarted = true;
    let lastFrameAt = 0;

    const frame = timestamp => {
      const arena = document.getElementById('scene-arena');
      const shouldRender =
        document.visibilityState === 'visible' &&
        arena?.classList.contains('active') &&
        timestamp - lastFrameAt >= 120;

      if (shouldRender && this.gameEngine) {
        lastFrameAt = timestamp;
        this.renderFighterCanvas('p1', this.gameEngine.player);
        this.renderFighterCanvas('p2', this.gameEngine.opponent);
      }

      this._fighterAnimationFrame = requestAnimationFrame(frame);
    };

    this._fighterAnimationFrame = requestAnimationFrame(frame);
  }`);

const helpers = `  isDevMode() {
    if (typeof window === 'undefined') return false;
    const host = window.location?.hostname || '';
    return window.DBCLASH_DEV_MODE === true || host === 'localhost' || host === '127.0.0.1';
  }

  appendSafeChatMessage(msg) {
    if (!this.chatFeed || !msg) return;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    const user = document.createElement('span');
    user.className = 'cb-user';
    user.textContent = String(msg.user || 'Guerreiro Z').slice(0, 40);

    const time = document.createElement('span');
    time.className = 'cb-time';
    time.textContent = String(msg.time || '').slice(0, 16);

    const br = document.createElement('br');
    const text = document.createTextNode(String(msg.text || '').slice(0, 300));

    bubble.append(user, time, br, text);
    this.chatFeed.appendChild(bubble);
  }

  renderRankedSummary() {
    const container = document.getElementById('ranked-view-content');
    if (!container) return;

    container.replaceChildren();

    const card = document.createElement('div');
    card.style.cssText =
      'padding:16px;background:rgba(255,215,0,.08);border-radius:8px;' +
      'border:1px solid rgba(255,215,0,.3);';

    const user = authManager.user;
    card.textContent = user?.isGuest
      ? 'Entre em uma conta online para disputar o Ranked.'
      : \`Rank atual: \${user?.division || 'Bronze I'} | \${user?.rankPoints || 0} RP | \${user?.victories || 0}V / \${user?.losses || 0}D\`;

    container.appendChild(card);
  }`;

if (!ui.includes('  isDevMode() {')) {
  ui = insertBeforeMethod(ui, 'renderChat', helpers);
}

ui = replaceClassMethod(ui, 'renderChat', `  renderChat() {
    if (!this.chatFeed) return;
    this.chatFeed.replaceChildren();
    chatManager.messages.forEach(msg => this.appendSafeChatMessage(msg));
    this.chatFeed.scrollTop = this.chatFeed.scrollHeight;
  }`);

ui = replaceClassMethod(ui, 'openLeaderboardModal', `  async openLeaderboardModal() {
    const lbModal = document.getElementById('leaderboard-modal');
    const lbContainer = document.getElementById('lb-list-container');
    if (!lbModal || !lbContainer) return;

    lbModal.classList.add('active');
    lbContainer.textContent = 'Carregando ranking...';

    try {
      await leaderboardManager.refresh(true);
    } catch {}

    const topList = leaderboardManager.getTopRankings();
    lbContainer.replaceChildren();

    if (!topList.length) {
      lbContainer.textContent = 'Ranking indisponivel no momento.';
      return;
    }

    for (const item of topList) {
      const row = document.createElement('div');
      row.className = \`lb-item\${item.isCurrent ? ' is-current' : ''}\`;

      const rank = document.createElement('div');
      rank.className = 'lb-rank';
      rank.textContent = \`#\${item.rank}\`;

      const info = document.createElement('div');
      info.className = 'lb-user-info';

      const name = document.createElement('div');
      name.className = 'lb-name';
      name.textContent = String(item.name || 'Guerreiro Z').slice(0, 40);

      const division = document.createElement('div');
      division.className = 'lb-division';
      division.textContent = String(item.division || 'Bronze I').slice(0, 40);

      info.append(name, division);

      const rp = document.createElement('div');
      rp.className = 'lb-rp';
      rp.textContent = \`\${item.rp || 0} RP (\${item.wins || 0}V)\`;

      row.append(rank, info, rp);
      lbContainer.appendChild(row);
    }
  }`);

ui = replaceClassMethod(ui, 'setupAuthAndLeaderboardHandlers', `  setupAuthAndLeaderboardHandlers() {
    if (typeof chatManager !== 'undefined') {
      chatManager.onMessageCallback = msg => {
        this.appendSafeChatMessage(msg);
        if (this.chatFeed) this.chatFeed.scrollTop = this.chatFeed.scrollHeight;
      };
    }

    const lbModal = document.getElementById('leaderboard-modal');
    const lbCloseBtn = document.getElementById('lb-close-btn');

    lbCloseBtn?.addEventListener('click', () => {
      lbModal?.classList.remove('active');
    });

    window.addEventListener('dbclash-leaderboard-updated', () => {
      if (lbModal?.classList.contains('active')) this.openLeaderboardModal();
    });
  }`);

ui = injectMethodPrelude(
  ui,
  'initDevPanel',
  `    if (!this.isDevMode()) {
      document.getElementById('open-dev-panel-btn')?.remove();
      return;
    }`,
  "document.getElementById('open-dev-panel-btn')?.remove();"
);
ui = injectMethodPrelude(ui, 'openDevPanel', `    if (!this.isDevMode()) return;`, "if (!this.isDevMode()) return;");
ui = injectMethodPrelude(ui, 'renderDevPanel', `    if (!this.isDevMode()) return;`, "if (!this.isDevMode()) return;");

if (!ui.includes("authCloseBtn.textContent = 'JOGAR COMO CONVIDADO'")) {
  ui = replaceListenerBlock(
    ui,
    "document.getElementById('title-press-start-btn')?.addEventListener('click', () => {",
    `document.getElementById('title-press-start-btn')?.addEventListener('click', () => {
      soundEngine.playClick();

      if (authManager.isLoggedIn) {
        soundEngine.playAwaken();
        sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
        return;
      }

      const authModal = document.getElementById('auth-modal');
      const authCloseBtn = document.getElementById('auth-close-btn');
      const userInput = document.getElementById('auth-user-input');

      if (userInput && authManager.user?.displayName) {
        userInput.value = authManager.user.displayName;
      }

      if (!authModal) {
        sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
        return;
      }

      authModal.classList.add('active');

      if (authCloseBtn) {
        authCloseBtn.style.display = '';
        authCloseBtn.textContent = 'JOGAR COMO CONVIDADO';
        authCloseBtn.onclick = () => {
          authModal.classList.remove('active');
          sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
        };
      }
    });`
  );
}

ui = replaceListenerBlock(
  ui,
  "document.getElementById('bnav-ranked')?.addEventListener('click', () => {",
  `document.getElementById('bnav-ranked')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.renderRankedSummary();
      sceneManager.switchScene(GAME_SCENES.RANKED);
    });`
);

write('js/ui-manager.js', ui);
console.log('[OK] js/ui-manager.js');

// ---------------------------------------------------------------------
// PWA/index cleanup.
// ---------------------------------------------------------------------
let index = read('index.html');

const cachePurgePattern = /\s*<script>\s*\/\/ Automatic Cache Purge Engine[\s\S]*?<\/script>/;
if (cachePurgePattern.test(index)) {
  index = index.replace(
    cachePurgePattern,
    `
  <script>
    window.addEventListener('load', function () {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(function (err) {
          console.warn('[PWA] Service worker registration failed:', err.message);
        });
      }
    });
  </script>`
  );
} else if (!index.includes("navigator.serviceWorker.register('./sw.js')")) {
  throw new Error('Nem cache purge nem registro de Service Worker foram encontrados.');
}

const fullscreenPattern = /\s*<!-- Auto fullscreen on first tap\/click \(mobile\) -->[\s\S]*?<script>[\s\S]*?<\/script>\s*(?=<\/body>)/;
if (fullscreenPattern.test(index)) {
  index = index.replace(
    fullscreenPattern,
    `
  <script>
    window.dbclashRequestFullscreen = function () {
      var el = document.documentElement;
      var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (fn && !document.fullscreenElement && !document.webkitFullscreenElement) {
        try { return fn.call(el); } catch (e) {}
      }
      return null;
    };
  </script>
`
  );
}

if (!index.includes('src="./js/runtime-guard.js"')) {
  const bootPattern = /<script type="module">\s*import \{ UIManager \}/;
  const bootMatch = bootPattern.exec(index);
  if (!bootMatch) throw new Error('Boot module marker nao encontrado.');
  index = index.slice(0, bootMatch.index) +
    '<script type="module" src="./js/runtime-guard.js"></script>\n\n' +
    index.slice(bootMatch.index);
}

index = index.replace(
  '🥇 <strong>Seu Rank Atual:</strong> Guerreiro Prata (1250 RP)',
  '<span id="ranked-current-summary">Carregando perfil ranqueado...</span>'
);

index = index.replace(
  'Conectando ao Realtime Database do Torneio do Poder...',
  'Conectando ao servidor competitivo do Torneio do Poder...'
);

index = index.replace(
  'style="font-size: 1.1rem; padding: 12px; background: rgba(0,0,0,0.6); border: 2px solid #ffd700; color: #fff; text-align: center;" style="margin: 0; flex: 1;"',
  'style="font-size:1.1rem;padding:12px;background:rgba(0,0,0,.6);border:2px solid #ffd700;color:#fff;text-align:center;margin:0;flex:1;"'
);

write('index.html', index);
console.log('[OK] index.html');

// ---------------------------------------------------------------------
// Manifest.
// ---------------------------------------------------------------------
const manifest = JSON.parse(read('manifest.json'));
manifest.id = manifest.id || './';
manifest.scope = './';
manifest.orientation = 'any';
write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('[OK] manifest.json');

// ---------------------------------------------------------------------
// Package gates.
// ---------------------------------------------------------------------
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:polish'] = 'node scripts/test-release-polish.mjs';
pkg.scripts['audit:release'] = 'node scripts/release-static-audit.mjs';
pkg.scripts.test =
  'npm run test:core && npm run test:content && npm run test:account && npm run test:multiplayer && npm run test:raid && npm run test:social && npm run test:polish';
pkg.scripts['release:check'] = 'npm test && npm run audit:release';
pkg.scripts.check = 'npm run release:check';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json');

console.log('PATCH RELEASE FIX 07 - RESUME APLICADO.');
