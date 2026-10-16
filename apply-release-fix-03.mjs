import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function write(rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
}
function backup(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Arquivo obrigatorio nao encontrado: ${rel}`);
  const bak = `${full}.release-fix-03.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(full, bak);
}
function copySource(sourceName, targetRel) {
  const source = fs.readFileSync(path.join(sourceDir, sourceName), 'utf8');
  if (fs.existsSync(path.join(root, targetRel))) backup(targetRel);
  write(targetRel, source);
  console.log(`[OK] ${targetRel}`);
}
function replaceBetween(src, startMarker, endMarker, replacement) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0) throw new Error(`Bloco nao encontrado: ${startMarker}`);
  return src.slice(0, a) + replacement.trimEnd() + '\n\n' + src.slice(b);
}
function replaceExactOrFail(src, oldText, newText, label) {
  if (!src.includes(oldText)) throw new Error(`Trecho nao encontrado: ${label}`);
  return src.replace(oldText, newText);
}

for (const rel of [
  'server.js',
  'package.json',
  'js/ui-manager.js',
  'js/auth-manager.js',
  'js/auth-database.js',
  'js/deck-builder.js',
  'js/pack-opener.js',
  'js/character-unlocks.js',
  'server/user-model.js'
]) backup(rel);

copySource('economy-rules-source.js', 'js/economy-rules.js');
copySource('auth-session-source.js', 'server/auth-session.js');
copySource('user-model-source.js', 'server/user-model.js');
copySource('auth-manager-source.js', 'js/auth-manager.js');
copySource('auth-database-source.js', 'js/auth-database.js');
copySource('deck-builder-source.js', 'js/deck-builder.js');
copySource('pack-opener-source.js', 'js/pack-opener.js');
copySource('character-unlocks-source.js', 'js/character-unlocks.js');
copySource('test-release-account-source.mjs', 'scripts/test-release-account.mjs');

// ---- server.js: authenticated REST account/economy layer ----
let server = read('server.js');

if (!server.includes("from './server/auth-session.js'")) {
  server = server.replace(
    "import { User } from './server/user-model.js';",
    `import { User } from './server/user-model.js';
import crypto from 'node:crypto';
import { createSessionToken, requireSession } from './server/auth-session.js';
import {
  DEFAULT_UNLOCKED_LEADERS,
  createDefaultInventory,
  migrateLegacyInventory,
  inventoryToOwnedCards,
  validateDeck,
  craftCardState,
  unlockLeaderState,
  openPackState,
  rollPack
} from './js/economy-rules.js';`
  );
}

const authBlock = `// 1. Register User in MongoDB
app.post('/api/auth/register', async (req, res) => {
  try {
    const { displayName, email, password } = req.body || {};
    if (!email || !password || !displayName) {
      return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatorios!' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Este e-mail ja esta cadastrado!' });
    }

    const unlockedLeaders = [...DEFAULT_UNLOCKED_LEADERS];
    const cardInventory = createDefaultInventory(unlockedLeaders);
    const uid = 'user_' + crypto.randomUUID();

    const newUser = new User({
      uid,
      displayName: String(displayName).trim().slice(0, 32),
      email: cleanEmail,
      password,
      isGuest: false,
      unlockedLeaders,
      selectedLeader: 'goku',
      customDecks: {},
      cardInventory,
      ownedCards: inventoryToOwnedCards(cardInventory),
      zeni: 500,
      gems: 10,
      dust: 300
    });

    await newUser.save();
    const token = createSessionToken(newUser);
    res.status(201).json({ success: true, token, user: newUser.toPublicJSON() });
  } catch (err) {
    console.error('[MongoDB] Register Error:', err);
    res.status(500).json({ success: false, message: 'Erro ao cadastrar usuario.' });
  }
});

// 2. Login User from MongoDB
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Digite o e-mail e a senha!' });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'E-mail ou senha invalidos.' });
    }

    const migrated = migrateLegacyInventory(user.toObject());
    user.cardInventory = migrated;
    user.ownedCards = inventoryToOwnedCards(migrated);
    if (user.dust === undefined || user.dust === null) user.dust = 300;
    await user.save();

    const token = createSessionToken(user);
    res.status(200).json({ success: true, token, user: user.toPublicJSON() });
  } catch (err) {
    console.error('[MongoDB] Login Error:', err);
    res.status(500).json({ success: false, message: 'Erro ao realizar login.' });
  }
});

async function loadAuthedUser(req, res) {
  const user = await User.findOne({ uid: req.auth.uid });
  if (!user) {
    res.status(404).json({ success: false, message: 'Usuario nao encontrado.' });
    return null;
  }

  const migrated = migrateLegacyInventory(user.toObject());
  user.cardInventory = migrated;
  user.ownedCards = inventoryToOwnedCards(migrated);
  if (user.dust === undefined || user.dust === null) user.dust = 300;
  return user;
}

app.get('/api/user/me', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;
    await user.save();
    res.json({ success: true, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao carregar perfil.' });
  }
});

// Old unrestricted sync is permanently disabled.
app.post('/api/user/sync', (req, res) => {
  res.status(410).json({ success: false, message: 'Endpoint legado removido. Use mutacoes autenticadas.' });
});

app.patch('/api/user/preferences', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    if (typeof req.body?.selectedLeader === 'string') {
      if (!user.unlockedLeaders.includes(req.body.selectedLeader)) {
        return res.status(400).json({ success: false, message: 'Lutador bloqueado.' });
      }
      user.selectedLeader = req.body.selectedLeader;
    }

    // customDecks cannot be bulk-overwritten here. Decks use /api/deck/save.
    await user.save();
    res.json({ success: true, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao salvar preferencias.' });
  }
});

app.post('/api/deck/save', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    const { leaderId, deck } = req.body || {};
    const validation = validateDeck(deck, user.cardInventory, leaderId, user.unlockedLeaders);
    if (!validation.ok) {
      return res.status(400).json({ success: false, code: validation.code, message: validation.message });
    }

    user.customDecks = { ...(user.customDecks || {}), [leaderId]: [...deck] };
    user.markModified('customDecks');
    await user.save();

    res.json({ success: true, deck: [...deck], user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao salvar deck.' });
  }
});

app.post('/api/economy/craft', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    const result = craftCardState(user.toObject(), req.body?.cardId);
    if (!result.ok) {
      return res.status(400).json({ success: false, code: result.code, cost: result.cost });
    }

    user.dust = result.dust;
    user.cardInventory = result.cardInventory;
    user.ownedCards = result.ownedCards;
    user.markModified('cardInventory');
    await user.save();

    res.json({ success: true, cardId: result.cardId, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao criar carta.' });
  }
});

app.post('/api/economy/unlock-leader', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    const result = unlockLeaderState(user.toObject(), req.body?.leaderId);
    if (!result.ok) {
      return res.status(400).json({ success: false, code: result.code, cost: result.cost });
    }

    user.zeni = result.zeni;
    user.unlockedLeaders = result.unlockedLeaders;
    user.cardInventory = result.cardInventory;
    user.ownedCards = result.ownedCards;
    user.markModified('cardInventory');
    await user.save();

    res.json({ success: true, leaderId: req.body.leaderId, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao desbloquear lutador.' });
  }
});

app.post('/api/economy/open-pack', requireSession, async (req, res) => {
  try {
    const user = await loadAuthedUser(req, res);
    if (!user) return;

    const secureRandom = () => crypto.randomInt(0, 0x100000000) / 0x100000000;
    const cards = rollPack(secureRandom);
    const result = openPackState(user.toObject(), cards);

    if (!result.ok) {
      return res.status(400).json({ success: false, code: result.code, cost: result.cost });
    }

    user.zeni = result.zeni;
    user.dust = result.dust;
    user.cardInventory = result.cardInventory;
    user.ownedCards = result.ownedCards;
    user.markModified('cardInventory');
    await user.save();

    res.json({
      success: true,
      cards,
      results: result.results,
      user: user.toPublicJSON()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao abrir booster.' });
  }
});

// 4. Global Leaderboard Endpoint (Top 20 Ranked)`;

server = replaceBetween(
  server,
  '// 1. Register User in MongoDB',
  '// 4. Global Leaderboard Endpoint (Top 20 Ranked)',
  authBlock
);

write('server.js', server);
console.log('[OK] server.js');

// ---- ui-manager.js: async auth/economy and one account source ----
let ui = read('js/ui-manager.js');

ui = ui.replace(
`    this.authBtn?.addEventListener('click', () => {
      soundEngine.playClick();
      if (authDatabase.isLoggedIn() && !authDatabase.getCurrentUser().isGuest) {
        authDatabase.logout();
        this.updateUserSessionUI();
      } else {
        this.authModal?.classList.add('active');
      }
    });`,
`    this.authBtn?.addEventListener('click', () => {
      soundEngine.playClick();
      if (authManager.isLoggedIn) {
        authManager.logout();
        this.updateUserSessionUI();
      } else {
        this.authModal?.classList.add('active');
      }
    });`
);

ui = ui.replace(
`    this.authLoginSubmit?.addEventListener('click', () => {
      soundEngine.playClick();
      const username = this.authUserInput?.value.trim() || 'GuerreiroZ';
      const email = username + '@dbtcg.local';
      const res = authManager.login(email, this.authPassInput?.value || '');
      if (res.success) { 
        this.authModal?.classList.remove('active'); 
        soundEngine.playAwaken();
        sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
        const nameEl = document.getElementById('display-user-name');
        if (nameEl) nameEl.textContent = authManager.user.displayName;
      } else {
        alert(res.message);
      }
    });`,
`    this.authLoginSubmit?.addEventListener('click', async () => {
      soundEngine.playClick();
      const username = this.authUserInput?.value.trim() || 'GuerreiroZ';
      const email = username + '@dbtcg.local';
      const res = await authManager.login(email, this.authPassInput?.value || '');
      if (res.success) {
        this.authModal?.classList.remove('active');
        soundEngine.playAwaken();
        this.updateUserSessionUI();
        sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
      } else {
        alert(res.message);
      }
    });`
);

ui = ui.replace(
`    this.authRegisterSubmit?.addEventListener('click', () => {
      soundEngine.playClick();
      const username = this.authUserInput?.value.trim() || 'GuerreiroZ';
      const email = username + '@dbtcg.local';
      const res = authManager.signUp(username, email, this.authPassInput?.value || '');
      if (res.success) { 
        this.authModal?.classList.remove('active');
        soundEngine.playAwaken();
        sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
        const nameEl = document.getElementById('display-user-name');
        if (nameEl) nameEl.textContent = authManager.user.displayName;
      } else {
        alert(res.message);
      }
    });`,
`    this.authRegisterSubmit?.addEventListener('click', async () => {
      soundEngine.playClick();
      const username = this.authUserInput?.value.trim() || 'GuerreiroZ';
      const email = username + '@dbtcg.local';
      const res = await authManager.signUp(username, email, this.authPassInput?.value || '');
      if (res.success) {
        this.authModal?.classList.remove('active');
        soundEngine.playAwaken();
        this.updateUserSessionUI();
        sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
      } else {
        alert(res.message);
      }
    });`
);

ui = ui.replace(
`    document.getElementById('buy-pack-btn')?.addEventListener('click', () => {
      const cards = packOpener.openPack();
      if (cards) { this.renderPackReveal(cards); this.updateCurrencies(); this.renderDeckBuilder(); }
    });`,
`    document.getElementById('buy-pack-btn')?.addEventListener('click', async () => {
      const cards = await packOpener.openPack();
      if (cards) {
        this.renderPackReveal(cards);
        this.updateCurrencies();
        this.renderDeckBuilder();
      }
    });`
);

const oldUpdate = `  updateUserSessionUI() {
    const user = authDatabase.getCurrentUser();
    deckBuilder.zeni = user.zeni;
    deckBuilder.dust = user.dust;
    this.updateCurrencies();
    if (this.authBtn) {
      this.authBtn.textContent = user.isGuest ? '🔑 Entrar' : \`👤 \${user.username}\`;
    }
  }`;

const newUpdate = `  updateUserSessionUI() {
    const user = authManager.user;
    this.updateCurrencies();
    if (this.authBtn) {
      this.authBtn.textContent = user?.isGuest ? '🔑 Entrar' : \`👤 \${user?.displayName || 'Guerreiro Z'}\`;
    }
    const nameEl = document.getElementById('display-user-name');
    if (nameEl) nameEl.textContent = user?.displayName || 'Guerreiro Z';
  }`;

ui = replaceExactOrFail(ui, oldUpdate, newUpdate, 'updateUserSessionUI');

ui = ui.replace(
`          if (confirm(\`Unlock \${leader.name} for \${leader.unlockCost} Zeni?\`)) {
            characterUnlocks.unlockCharacter(leaderId, leader.unlockCost, deckBuilder.zeni, cost => {
              deckBuilder.zeni -= cost;
              authDatabase.updateProfileStats({ zeni: deckBuilder.zeni });
              this.updateCurrencies();
              this.renderLeaderSelectionRoster();
    this.initDevPanel();
            });
          }`,
`          if (confirm(\`Unlock \${leader.name} for \${leader.unlockCost} Zeni?\`)) {
            characterUnlocks.unlockCharacter(leaderId).then(result => {
              if (!result.success) {
                alert(result.message || 'Zeni insuficiente ou falha ao desbloquear.');
                return;
              }
              this.updateCurrencies();
              this.renderLeaderSelectionRoster();
              this.initDevPanel();
            });
          }`
);

write('js/ui-manager.js', ui);
console.log('[OK] js/ui-manager.js');

// ---- package scripts ----
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:account'] = 'node scripts/test-release-account.mjs';
pkg.scripts.test = 'npm run test:core && npm run test:content && npm run test:account';
pkg.scripts.check = 'npm test';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json');

console.log('PATCH RELEASE FIX 03 APLICADO.');
