import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SOUND_ASSETS, ATTACK_SFX_PROFILES } from '../js/audio.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS', name);
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

test('manifest de audio cobre todos os arquivos existentes relevantes', () => {
  const expected = [
    'soundtrack.mp3',
    'battle1.mp3',
    'battle2.mp3',
    'awakening.mp3',
    'carregar_ki.mp3',
    'clash_punchs.mp3',
    'dano_do_beam.mp3',
    'dbz-beam-fx.wav',
    'dragonball-z-heavy-kick-fx.wav',
    'kamehameha.mp3',
    'teleport_vanish.wav'
  ];
  assert.deepEqual(Object.values(SOUND_ASSETS).sort(), expected.sort());

  for (const file of expected) {
    assert.equal(fs.existsSync(new URL(`../music/${file}`, import.meta.url)), true, `asset ausente: ${file}`);
  }
});

test('audio usa URL relativa ao modulo e nao depende do host atual', () => {
  const src = fs.readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');
  assert.ok(src.includes("new URL(`../music/${file}`, import.meta.url).href"));
});

test('todos os ataques visuais possuem perfil SFX distinto', () => {
  const expected = [
    'punch', 'kamehameha', 'genkidama', 'finalFlash', 'deathBeam',
    'specialBeam', 'masenko', 'bigBang', 'burningAttack', 'supernova',
    'kienzan', 'kikoho', 'dragonFist', 'meteorCombination', 'spiritSword', 'kiBlast'
  ];
  for (const type of expected) {
    assert.ok(Array.isArray(ATTACK_SFX_PROFILES[type]), `sem perfil: ${type}`);
    assert.ok(ATTACK_SFX_PROFILES[type].length >= 1, `perfil vazio: ${type}`);
  }
});

test('impactos da UI usam attackType em vez de punch generico', () => {
  const src = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  const start = src.indexOf('  triggerImpactEffects(');
  assert.ok(start >= 0);
  const block = src.slice(start, start + 1300);

  assert.match(
    block,
    /soundEngine\.playImpact(?:\?\.)?\(\s*attackType\s*,\s*damage\s*\)/
  );

  assert.equal(
    /soundEngine\.playPunch\s*\(/.test(block),
    false
  );
});

test('resultado de partida possui feedback sonoro', () => {
  const src = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  const start = src.indexOf('  showGameResult(');
  const block = src.slice(start, start + 500);
  assert.match(block, /soundEngine\.playResult(?:\?\.)?\(\s*isPlayerWinner\s*\)/);
});

test('scene manager troca BGM e atmosfera por contexto', () => {
  const src = fs.readFileSync(new URL('../js/scene-manager.js', import.meta.url), 'utf8');
  assert.ok(src.includes('soundEngine.playBattleTheme'));
  assert.ok(src.includes('soundEngine.playQueueTheme'));
  assert.ok(src.includes('soundEngine.playMenuTheme'));
  assert.ok(src.includes("soundEngine.startAmbience?.('battle')") || src.includes("soundEngine.startAmbience('battle')"));
  assert.ok(src.includes("soundEngine.startAmbience?.('queue')") || src.includes("soundEngine.startAmbience('queue')"));
  assert.ok(src.includes("soundEngine.startAmbience?.('menu')") || src.includes("soundEngine.startAmbience('menu')"));
});

test('service worker ignora Range e arquivos de audio', () => {
  const src = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(src.includes("request.headers.has('range')"));
  assert.ok(src.includes('mp3|wav|ogg|m4a|aac'));
  assert.ok(src.includes('shouldBypass(request, url)'));
});

test('cache version foi atualizada para limpar runtime antigo', () => {
  const src = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(src.includes("dbclash-release-v3-nexus-audio"));
});

test('BGM respeita unlock de autoplay e preferencias persistentes', () => {
  const src = fs.readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');
  assert.ok(src.includes('this.unlocked = true'));
  assert.ok(src.includes('dbclash_audio_muted'));
  assert.ok(src.includes('dbclash_audio_master'));
});

test('SFX inclui ambiencia, reaction e match result', () => {
  const src = fs.readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');
  assert.ok(src.includes('startAmbience('));
  assert.ok(src.includes('playReaction('));
  assert.ok(src.includes('playResult('));
  assert.ok(src.includes('playMatchFound('));
  assert.ok(src.includes('_noiseBurst('));
});

console.log(`AUDIO RELEASE TESTS: ${passed} PASS / 0 FAIL`);
