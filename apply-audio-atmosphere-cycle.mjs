import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PAYLOAD = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const p = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(p(rel), 'utf8');
const write = (rel, text) => {
  fs.mkdirSync(path.dirname(p(rel)), { recursive: true });
  fs.writeFileSync(p(rel), text, 'utf8');
};
const backup = rel => {
  const src = p(rel);
  if (!fs.existsSync(src)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${src}.audio-atmosphere-cycle.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
};
const replaceRequired = (text, before, after, label) => {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`Anchor ausente: ${label}`);
  return text.replace(before, after);
};

for (const rel of ['js/audio.js', 'js/ui-manager.js', 'js/scene-manager.js', 'sw.js', 'package.json']) {
  backup(rel);
}

// 1) Replace the audio engine as a complete cohesive module.
write('js/audio.js', fs.readFileSync(path.join(PAYLOAD, 'audio-atmosphere-source.js'), 'utf8'));
console.log('[OK] js/audio.js - Audio Director restaurado/expandido');

// 2) Route impacts by attack type, not generic punch.
let ui = read('js/ui-manager.js');
ui = replaceRequired(
  ui,
  `    if (typeof soundEngine.playPunch === 'function') soundEngine.playPunch();
    else if (typeof soundEngine.playBeamBlast === 'function') soundEngine.playBeamBlast();`,
  `    if (typeof soundEngine.playImpact === 'function') {
      soundEngine.playImpact(attackType, damage);
    } else if (typeof soundEngine.playPunch === 'function') {
      soundEngine.playPunch();
    }`,
  'triggerImpactEffects audio'
);

ui = replaceRequired(
  ui,
  `  showGameResult(isPlayerWinner) {
    const existing = document.getElementById('game-result-overlay');`,
  `  showGameResult(isPlayerWinner) {
    soundEngine.playResult?.(isPlayerWinner);
    const existing = document.getElementById('game-result-overlay');`,
  'game result audio'
);

// Improve non-damaging unique techniques if their existing generic calls are present.
ui = ui.replace(
  `          soundEngine.playBeamBlast();
        }
      });
    } else if (type === 'timeSkip') {`,
  `          soundEngine.playSolarFlare?.();
        }
      });
    } else if (type === 'timeSkip') {`
);
ui = ui.replace(
  `          soundEngine.playZVanish();
        }
      });
    } else if (type === 'counter') {`,
  `          soundEngine.playTimeSkip?.();
        }
      });
    } else if (type === 'counter') {`
);

// Card clash gets mode-aware audio while retaining visual logic.
const reactionOld = `    if (mode === 'evade') {
      soundEngine.playZVanish();
    } else if (mode === 'defense') {
      soundEngine.playCardClash();
      soundEngine.playBeamDamage();
    } else {
      soundEngine.playCardClash();
      soundEngine.playClashPunches(700);
    }`;
const reactionNew = `    if (typeof soundEngine.playReaction === 'function') {
      soundEngine.playReaction(mode);
    } else if (mode === 'evade') {
      soundEngine.playZVanish();
    } else {
      soundEngine.playCardClash();
    }`;
if (ui.includes(reactionOld)) ui = ui.replace(reactionOld, reactionNew);

write('js/ui-manager.js', ui);
console.log('[OK] js/ui-manager.js - SFX por ataque/reacao');

// 3) Scene-aware BGM and ambience.
let scene = read('js/scene-manager.js');
const oldSceneBlock = `  onSceneEnter(sceneId, options) {
    // Fire specific audio & visual triggers per AAA scene with safe optional chaining
    if (sceneId === GAME_SCENES.TITLE) {
      if (typeof soundEngine.playMenuTheme === 'function') soundEngine.playMenuTheme();
    } else if (sceneId === GAME_SCENES.ARENA) {
      if (typeof soundEngine.playBattleTheme === 'function') soundEngine.playBattleTheme();
      if (typeof document !== 'undefined') document.body.classList.add('arena-active');
    } else {
      if (typeof document !== 'undefined') document.body.classList.remove('arena-active');
    }

    // Dispatch scene change custom event`;

const newSceneBlock = `  onSceneEnter(sceneId, options) {
    // Audio director follows the scene instead of leaving battle/menu tracks orphaned.
    if (sceneId === GAME_SCENES.ARENA) {
      soundEngine.playBattleTheme?.();
      soundEngine.startAmbience?.('battle');
      if (typeof document !== 'undefined') document.body.classList.add('arena-active');
    } else if (sceneId === GAME_SCENES.RANKED) {
      soundEngine.playQueueTheme?.();
      soundEngine.startAmbience?.('queue');
      if (typeof document !== 'undefined') document.body.classList.remove('arena-active');
    } else {
      soundEngine.playMenuTheme?.();
      soundEngine.startAmbience?.('menu');
      if (typeof document !== 'undefined') document.body.classList.remove('arena-active');
    }

    // Dispatch scene change custom event`;

scene = replaceRequired(scene, oldSceneBlock, newSceneBlock, 'scene audio director');
write('js/scene-manager.js', scene);
console.log('[OK] js/scene-manager.js - BGM/ambiencia por cena');

// 4) Service worker must never cache/intercept media Range requests.
let sw = read('sw.js');
sw = sw.replace(
  /const CACHE_VERSION = ['"][^'"]+['"];/,
  `const CACHE_VERSION = 'dbclash-release-v2-audio';`
);

const oldBypass = `function shouldBypass(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.protocol === 'chrome-extension:'
  );
}`;
const newBypass = `function shouldBypass(request, url) {
  const isAudio = /\\.(mp3|wav|ogg|m4a|aac)$/i.test(url.pathname);
  const isRange = request.headers.has('range');
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.protocol === 'chrome-extension:' ||
    isAudio ||
    isRange
  );
}`;
sw = replaceRequired(sw, oldBypass, newBypass, 'service worker media bypass');
sw = replaceRequired(
  sw,
  `  if (url.origin !== self.location.origin || shouldBypass(url)) return;`,
  `  if (url.origin !== self.location.origin || shouldBypass(request, url)) return;`,
  'service worker bypass invocation'
);
write('sw.js', sw);
console.log('[OK] sw.js - audio/Range fora do cache');

// 5) Release regression test.
write('scripts/test-release-audio.mjs', fs.readFileSync(path.join(PAYLOAD, 'test-release-audio-source.mjs'), 'utf8'));
console.log('[OK] scripts/test-release-audio.mjs');

// 6) Wire into release test gate.
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:audio'] = 'node scripts/test-release-audio.mjs';
if (!String(pkg.scripts.test || '').includes('test:audio')) {
  pkg.scripts.test = `${pkg.scripts.test} && npm run test:audio`;
}
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json - test:audio');

console.log('AUDIO + SFX + ATMOSPHERE CYCLE APLICADO.');
