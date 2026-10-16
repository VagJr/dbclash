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
  const bak = `${full}.release-fix-06.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(full, bak);
}
function copySource(sourceName, targetRel) {
  const src = fs.readFileSync(path.join(sourceDir, sourceName), 'utf8');
  if (fs.existsSync(path.join(root, targetRel))) backup(targetRel);
  write(targetRel, src);
  console.log(`[OK] ${targetRel}`);
}
function replaceExact(src, oldText, newText, label) {
  if (!src.includes(oldText)) throw new Error(`Trecho nao encontrado: ${label}`);
  return src.replace(oldText, newText);
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
      if (ch === '*' && next === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { start: startIndex, end: i + 1 };
    }
  }
  throw new Error('Bloco sem chave de fechamento.');
}
function replaceFunction(src, signature, replacement) {
  const index = src.indexOf(signature);
  if (index < 0) throw new Error(`Funcao nao encontrada: ${signature}`);
  const range = findBraceRange(src, index);
  return src.slice(0, range.start) + replacement.trimEnd() + src.slice(range.end);
}
function replaceClassMethod(src, methodName, replacement) {
  const re = new RegExp(`\\n  ${methodName}\\([^\\n]*\\) \\{`);
  const match = re.exec(src);
  if (!match) throw new Error(`Metodo nao encontrado: ${methodName}`);
  const start = match.index + 1;
  const range = findBraceRange(src, start);
  return src.slice(0, range.start) + replacement.trimEnd() + src.slice(range.end);
}

for (const rel of [
  'server.js',
  'server/user-model.js',
  'package.json',
  'js/auth-manager.js',
  'js/chat-manager.js',
  'js/multiplayer-manager.js',
  'js/ui-manager.js'
]) backup(rel);

copySource('daily-quest-rules-source.js', 'js/daily-quest-rules.js');
copySource('dojo-model-source.js', 'server/dojo-model.js');
copySource('user-model-fix06-source.js', 'server/user-model.js');
copySource('tag-team-engine-source.js', 'server/tag-team-engine.js');
copySource('team-ui-source.js', 'js/team-ui.js');
copySource('product-modes-source.js', 'server/product-modes.js');
copySource('social-manager-source.js', 'js/social-manager.js');
copySource('chat-manager-fix06-source.js', 'js/chat-manager.js');
copySource('multiplayer-manager-fix06-source.js', 'js/multiplayer-manager.js');
copySource('test-release-social-source.mjs', 'scripts/test-release-social.mjs');

// ---------------------------------------------------------------------
// Auth cache keeps new public profile fields.
// ---------------------------------------------------------------------
let auth = read('js/auth-manager.js');
auth = replaceExact(
  auth,
  `      dust: Math.max(0, Number(raw.dust) || 0),\n      createdAt: raw.createdAt || new Date().toISOString()`,
  `      dust: Math.max(0, Number(raw.dust) || 0),\n      dojoId: raw.dojoId || null,\n      dailyQuests: raw.dailyQuests && typeof raw.dailyQuests === 'object' ? raw.dailyQuests : {},\n      createdAt: raw.createdAt || new Date().toISOString()`,
  'AuthManager normalizeUser social fields'
);
auth = replaceExact(
  auth,
  `      dust: 300,\n      createdAt: new Date().toISOString()`,
  `      dust: 300,\n      dojoId: null,\n      dailyQuests: {},\n      createdAt: new Date().toISOString()`,
  'AuthManager guest social fields'
);
write('js/auth-manager.js', auth);
console.log('[OK] js/auth-manager.js');

// ---------------------------------------------------------------------
// UI delegates social features and enables real 2v2.
// ---------------------------------------------------------------------
let ui = read('js/ui-manager.js');
ui = ui.replace(
  "import { chatManager, DOJO_RANKINGS } from './chat-manager.js';",
  "import { chatManager } from './chat-manager.js';\nimport { socialManager } from './social-manager.js';"
);
if (!ui.includes("import { socialManager } from './social-manager.js';")) {
  throw new Error('Import socialManager nao foi aplicado.');
}
ui = replaceExact(
  ui,
  `    this.multiplayer = new MultiplayerManager(this.gameEngine);\n    this.tutorial = new TutorialManager(this);`,
  `    this.multiplayer = new MultiplayerManager(this.gameEngine);\n    socialManager.bind({ multiplayer: this.multiplayer });\n    this.tutorial = new TutorialManager(this);`,
  'UI socialManager bind'
);
ui = replaceExact(
  ui,
  `    document.getElementById('menu-btn-ranked-2v2')?.addEventListener('click', () => {\n      soundEngine.playClick();\n      alert('⚔️ MODO RANQUEADO 2v2 EM BREVE! Duplas online no Torneio do Poder.');\n    });`,
  `    document.getElementById('menu-btn-ranked-2v2')?.addEventListener('click', () => {\n      soundEngine.playClick();\n      this.multiplayer.startRanked2v2Matchmaking(this.selectedLeader);\n    });`,
  'UI ranked 2v2 button'
);
ui = replaceExact(
  ui,
  `    document.getElementById('bnav-quests')?.addEventListener('click', () => {\n      soundEngine.playClick();\n      sceneManager.switchScene(GAME_SCENES.QUESTS);\n    });`,
  `    document.getElementById('bnav-quests')?.addEventListener('click', () => {\n      soundEngine.playClick();\n      socialManager.renderQuests();\n      sceneManager.switchScene(GAME_SCENES.QUESTS);\n    });`,
  'UI quests navigation'
);
ui = replaceClassMethod(ui, 'renderDojos', `  renderDojos() {\n    socialManager.renderDojos();\n  }`);
write('js/ui-manager.js', ui);
console.log('[OK] js/ui-manager.js');

// ---------------------------------------------------------------------
// Existing server flows feed daily quest progress, then register Fix 06.
// ---------------------------------------------------------------------
let server = read('server.js');
if (!server.includes("from './server/product-modes.js'")) {
  const anchor = "import { RaidRoomEngine } from './server/raid-room-engine.js';";
  if (!server.includes(anchor)) throw new Error('Import RaidRoomEngine nao encontrado; Fix 05 ausente.');
  server = server.replace(
    anchor,
    `${anchor}\nimport { registerProductModes } from './server/product-modes.js';\nimport { applyQuestEventToUser } from './js/daily-quest-rules.js';`
  );
}

server = replaceFunction(server, 'async function updateRankedUser(uid, isWin)', `async function updateRankedUser(uid, isWin) {
  const user = await User.findOne({ uid });
  if (!user) return null;

  const result = applyRankedResult(user.toObject(), isWin);
  user.rankPoints = result.rankPoints;
  user.xp = result.xp;
  user.level = result.level;
  user.division = result.division;
  user.victories = result.victories;
  user.losses = result.losses;
  applyQuestEventToUser(user, 'online_match');
  if (isWin) applyQuestEventToUser(user, 'online_win');
  await user.save();
  return user;
}`);

server = replaceFunction(server, 'async function finalizeRaidRoom(roomCode, result)', `async function finalizeRaidRoom(roomCode, result) {
  const room = activeRaidRooms[roomCode];
  if (!room || room.finalized) return;
  room.finalized = true;

  emitRaidState(roomCode);

  for (const slot of Object.values(room.slots)) {
    let reward = { zeni: 0, xp: 0, trophies: 0, gems: 0 };
    let user = await User.findOne({ uid: slot.uid });

    if (result === 'VICTORY' && !slot.abandoned) {
      const applied = await applyRaidReward(slot.uid, room.bossId);
      if (applied) {
        reward = applied.reward;
        user = applied.user;
      }
    }

    if (user && !slot.abandoned) {
      applyQuestEventToUser(user, 'raid_complete');
      await user.save();
    }

    if (slot.socketId && user) {
      const state = room.engine.getStateFor(slot.uid);
      state.roomCode = roomCode;
      state.matchId = room.matchId;

      io.to(slot.socketId).emit('raid_result', {
        result,
        reward,
        state,
        user: user.toPublicJSON()
      });
    }
  }

  setTimeout(() => {
    delete activeRaidRooms[roomCode];
  }, 20000);
}`);

const packRoute = "app.post('/api/economy/open-pack', requireSession, async (req, res) =>";
const packIndex = server.indexOf(packRoute);
if (packIndex < 0) throw new Error('Endpoint open-pack nao encontrado.');
const packRange = findBraceRange(server, packIndex);
let packBlock = server.slice(packRange.start, packRange.end);
packBlock = replaceExact(
  packBlock,
  `    user.ownedCards = result.ownedCards;\n    user.markModified('cardInventory');\n    await user.save();`,
  `    user.ownedCards = result.ownedCards;\n    user.markModified('cardInventory');\n    applyQuestEventToUser(user, 'pack_open');\n    await user.save();`,
  'open-pack quest hook'
);
server = server.slice(0, packRange.start) + packBlock + server.slice(packRange.end);

if (!server.includes('registerProductModes(app, io);')) {
  const marker = '// Self-Ping Tick to Keep Render Awake';
  const idx = server.indexOf(marker);
  if (idx < 0) throw new Error('Self-Ping marker nao encontrado.');
  server = server.slice(0, idx) + `registerProductModes(app, io);\n\n` + server.slice(idx);
}
write('server.js', server);
console.log('[OK] server.js');

// ---------------------------------------------------------------------
// Test scripts.
// ---------------------------------------------------------------------
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:social'] = 'node scripts/test-release-social.mjs';
pkg.scripts.test = 'npm run test:core && npm run test:content && npm run test:account && npm run test:multiplayer && npm run test:raid && npm run test:social';
pkg.scripts.check = 'npm test';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json');

console.log('PATCH RELEASE FIX 06 APLICADO.');
