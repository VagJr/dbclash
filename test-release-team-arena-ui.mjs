import assert from 'node:assert/strict';
import fs from 'node:fs';

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

const ui = fs.readFileSync(new URL('../js/team-ui.js', import.meta.url), 'utf8');
const arena = fs.readFileSync(new URL('../styles/arena.css', import.meta.url), 'utf8');
const mm = fs.readFileSync(new URL('../js/multiplayer-manager.js', import.meta.url), 'utf8');

test('2v2 usa scene-arena oficial e nao cria overlay fullscreen proprio', () => {
  assert.ok(ui.includes("document.getElementById('scene-arena')"));
  assert.ok(ui.includes("classList.add('squad-realtime-mode')"));
  assert.equal(ui.includes("position:fixed"), false);
  assert.equal(ui.includes("inset:0"), false);
});

test('HUD principal usa p1 e alvo usa p2 oficiais', () => {
  assert.ok(ui.includes("this._renderMainHud('p1', you"));
  assert.ok(ui.includes("this._renderMainHud('p2', selectedEnemy"));
  assert.ok(ui.includes("document.getElementById(`${prefix}-leader-box`)"));
});

test('dois HUDs extras estendem fighter-hud oficial', () => {
  assert.ok(ui.includes('fighter-hud dokkan-scouter-hud squad-secondary-hud'));
  assert.ok(ui.includes('squad-enemy-secondary-hud'));
  assert.ok(ui.includes('squad-ally-secondary-hud'));
});

test('mao 2v2 reutiliza card oficial e assetLoader', () => {
  assert.ok(ui.includes("document.getElementById('p1-hand')"));
  assert.ok(ui.includes("assetLoader.renderCardArtHTML(card)"));
  assert.ok(ui.includes('card type-${card.type}'));
  assert.ok(ui.includes("class=\"card-header\""));
  assert.ok(ui.includes('card-ki-cost'));
});

test('botoes oficiais charge e pass sao interceptados apenas durante 2v2', () => {
  assert.ok(ui.includes("intercept('charge-ki-btn', 'chargeKi')"));
  assert.ok(ui.includes("intercept('pass-turn-btn', 'passTurn')"));
  assert.ok(ui.includes("this.state.mode !== '2v2-realtime'"));
});

test('selecao de alvo mantem p2 como alvo oficial', () => {
  assert.ok(ui.includes('selectedTargetUid'));
  assert.ok(ui.includes('targetUid'));
  assert.ok(ui.includes('squad-target-selected'));
  assert.ok(ui.includes('4 LUTADORES EM CAMPO'));
});

test('drop-zone oficial aceita drag de carta do 2v2', () => {
  assert.ok(ui.includes("closest?.('#drop-zone')"));
  assert.ok(ui.includes('this.draggedCardIndex'));
});

test('battle log oficial recebe logs do squad com escaping', () => {
  assert.ok(ui.includes("document.getElementById('battle-log-container')"));
  assert.ok(ui.includes("escapeHtml(log.text || '')"));
});

test('CSS integra quatro HUDs no grid da arena existente', () => {
  assert.ok(arena.includes('#scene-arena.squad-realtime-mode .arena-zone-top'));
  assert.ok(arena.includes('#scene-arena.squad-realtime-mode .arena-zone-bot'));
  assert.ok(arena.includes('grid-template-areas:'));
  assert.ok(arena.includes('#squad-enemy-secondary-hud'));
  assert.ok(arena.includes('#squad-ally-secondary-hud'));
});

test('FX de squad e roteado para o HUD oficial', () => {
  assert.ok(mm.includes("payload?.type === 'squad_attack'"));
  assert.ok(mm.includes('teamBattleUI.handleFx(payload)'));
  assert.ok(ui.includes('handleFx(payload)'));
  assert.ok(arena.includes('.squad-hit-flash'));
});

console.log(`TEAM ARENA UI RELEASE TESTS: ${passed} PASS / 0 FAIL`);
