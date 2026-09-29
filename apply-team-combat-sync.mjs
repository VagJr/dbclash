import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PAYLOAD = path.dirname(
  new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
);

const full = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(full(rel), 'utf8');
const write = (rel, text) => {
  fs.mkdirSync(path.dirname(full(rel)), { recursive: true });
  fs.writeFileSync(full(rel), text, 'utf8');
};
const backup = rel => {
  const src = full(rel);
  if (!fs.existsSync(src)) throw new Error(`Arquivo ausente: ${rel}`);
  const bak = `${src}.team-combat-sync.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
};

function findBlockEnd(text, openBraceIndex) {
  let depth = 0;
  let quote = null;
  let escape = false;
  let line = false;
  let block = false;

  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];
    const nx = text[i + 1];

    if (line) {
      if (ch === '\n') line = false;
      continue;
    }
    if (block) {
      if (ch === '*' && nx === '/') {
        block = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && nx === '/') {
      line = true;
      i++;
      continue;
    }
    if (ch === '/' && nx === '*') {
      block = true;
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
      if (depth === 0) return i;
    }
  }

  throw new Error('Bloco JS sem fechamento.');
}

function replaceFunction(text, signature, replacement, label) {
  const start = text.indexOf(signature);
  if (start < 0) throw new Error(`Funcao ausente: ${label}`);

  // Find body opening while respecting destructuring in parameters.
  const parenStart = text.indexOf('(', start);
  let parenDepth = 0;
  let bodyBrace = -1;

  for (let i = parenStart; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') {
      parenDepth--;
      if (parenDepth === 0) {
        bodyBrace = text.indexOf('{', i);
        break;
      }
    }
  }

  if (bodyBrace < 0) throw new Error(`Corpo ausente: ${label}`);
  const end = findBlockEnd(text, bodyBrace);

  return text.slice(0, start) + replacement + text.slice(end + 1);
}

function replaceClass(text, signature, replacement, label) {
  const start = text.indexOf(signature);
  if (start < 0) throw new Error(`Classe ausente: ${label}`);
  const bodyBrace = text.indexOf('{', start);
  if (bodyBrace < 0) throw new Error(`Corpo ausente: ${label}`);
  const end = findBlockEnd(text, bodyBrace);
  return text.slice(0, start) + replacement + text.slice(end + 1);
}

for (const rel of [
  'server/squad-battle-engine.js',
  'server/realtime-bot-controllers.js',
  'server/product-modes.js',
  'js/team-ui.js',
  'js/multiplayer-manager.js',
  'styles/arena.css',
  'package.json'
]) backup(rel);

// ----------------------------------------------------------
// Authoritative squad engine
// ----------------------------------------------------------
write(
  'server/squad-battle-engine.js',
  fs.readFileSync(
    path.join(PAYLOAD, 'squad-battle-engine-sync-source.js'),
    'utf8'
  )
);
console.log('[OK] server/squad-battle-engine.js - reaction + beam clash + canonical state');

// ----------------------------------------------------------
// Bot controller: add reaction/clash awareness without
// disturbing Raid realtime controller below it.
// ----------------------------------------------------------
let bots = read('server/realtime-bot-controllers.js');

if (!bots.includes('canUseReaction')) {
  bots = bots.replace(
    `import {
  getCardRule,`,
    `import {
  canUseReaction,
  getCardRule,`
  );
}

const chooseSquad = `export function chooseSquadBotAction(engine, uid) {
  const found = engine?.getMember(uid);
  const player = found?.member;
  if (!player || !player.isBot || player.downed || player.abandoned) return null;

  const clash = engine.getClashFor?.(uid);
  if (clash) return { action: 'mashBeamClash', score: 1000 };

  const pending = engine.getPendingFor?.(uid);
  if (pending) {
    const reactions = player.hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card && getEffectiveCardCost(player, card) <= player.ki)
      .filter(({ card }) => canUseReaction(player, pending.card, card))
      .map(item => {
        const rule = getCardRule(item.card);
        let score = 50;
        if (item.card.isBeam && pending.card?.isBeam && isAttackAction(item.card)) {
          score = 180 + Number(item.card.power || 0);
        } else if (item.card.type === 'evade') {
          score = 170;
        } else if (item.card.type === 'counter') {
          score = 130 + Number(rule.counterDamage || item.card.power || 0);
        } else if (item.card.type === 'defense') {
          score = 100 + Number(item.card.block || 0);
        }
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = reactions[0];
    if (!best) return null;
    return {
      action: 'playCard',
      cardIndex: best.index,
      cardId: best.card.id,
      targetUid: null,
      score: best.score
    };
  }

  if (!engine.canAct(uid)) return null;

  const enemies = engine.getEnemies(uid);
  if (!enemies.length) return null;

  const options = [];
  player.hand.forEach((card, index) => {
    if (!card || getEffectiveCardCost(player, card) > player.ki) return;

    if (isAttackAction(card)) {
      for (const target of enemies) {
        if (engine.getPendingFor?.(target.uid) || engine.getClashFor?.(target.uid)) continue;
        options.push({
          action: 'playCard',
          cardIndex: index,
          cardId: card.id,
          targetUid: target.uid,
          score: scoreAttack(player, target, card)
        });
      }
      return;
    }

    if (isImmediateTechnique(card)) {
      options.push({
        action: 'playCard',
        cardIndex: index,
        cardId: card.id,
        targetUid: null,
        score: scoreSelfCard(player, card)
      });
    }
  });

  options.sort((a, b) => b.score - a.score);
  const best = options[0];

  if (best && (best.score >= 24 || player.ki >= 8 || hpRatio(player) < 0.42)) {
    return best;
  }
  if (player.ki < 9) return { action: 'chargeKi', score: 10 };
  if (best) return best;
  return { action: 'passTurn', score: 0 };
}`;

bots = replaceFunction(
  bots,
  'export function chooseSquadBotAction(',
  chooseSquad,
  'chooseSquadBotAction'
);

const controller = `export class SquadBotController {
  constructor({ engine } = {}) {
    this.engine = engine;
    this.timers = new Map();
    this.disposed = false;
  }

  poke() {
    if (this.disposed || !this.engine || this.engine.finished) return;

    const bots = [
      ...this.engine.getTeam('A'),
      ...this.engine.getTeam('B')
    ].filter(player =>
      player.isBot &&
      !player.downed &&
      !player.abandoned
    );

    for (const bot of bots) {
      if (this.timers.has(bot.uid)) continue;

      const decisionNow = chooseSquadBotAction(this.engine, bot.uid);
      const inClash = decisionNow?.action === 'mashBeamClash';
      const inReaction = !!this.engine.getPendingFor?.(bot.uid);

      let waitForReady = 0;
      if (!inClash && !inReaction) {
        waitForReady = Math.max(
          0,
          Number(bot.actionReadyAt || 0) - Date.now()
        );
      }

      const delay = inClash
        ? 105 + rand(70)
        : inReaction
          ? 260 + rand(260)
          : thinkDelay();

      const timer = setTimeout(() => {
        this.timers.delete(bot.uid);
        if (this.disposed || this.engine.finished) return;

        const decision = chooseSquadBotAction(this.engine, bot.uid);
        if (decision) {
          this.engine.action(
            bot.uid,
            decision.action,
            {
              cardIndex: decision.cardIndex,
              cardId: decision.cardId,
              targetUid: decision.targetUid
            }
          );
        }

        queueMicrotask(() => this.poke());
      }, waitForReady + delay);

      timer.unref?.();
      this.timers.set(bot.uid, timer);
    }
  }

  dispose() {
    this.disposed = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}`;

bots = replaceClass(
  bots,
  'export class SquadBotController',
  controller,
  'SquadBotController'
);

write('server/realtime-bot-controllers.js', bots);
console.log('[OK] server/realtime-bot-controllers.js - bots respondem e fazem mash');

// ----------------------------------------------------------
// Room-level canonical versioning.
// ----------------------------------------------------------
let modes = read('server/product-modes.js');

const sendTeamState = `  function sendTeamState(roomCode) {
    const room = teamRooms.get(roomCode);
    if (!room?.engine) return;

    room.stateVersion += 1;
    const snapshotVersion = room.stateVersion;
    const serverNow = Date.now();

    for (const slot of Object.values(room.slots)) {
      if (!slot.connected || !slot.socketId) continue;

      const state = room.engine.getStateFor(slot.uid);
      if (!state) continue;

      state.roomCode = roomCode;
      state.matchId = room.matchId;
      state.ranked = room.ranked;
      state.stateVersion = snapshotVersion;
      state.serverNow = serverNow;

      io.to(slot.socketId).emit('team_state', state);
    }
  }`;

modes = replaceFunction(
  modes,
  '  function sendTeamState(',
  sendTeamState,
  'sendTeamState'
);

// Add room stateVersion/fxSeq if not present.
const roomMarker = `      ranked,
      finalized: false,
      lastSeq: {},`;

if (modes.includes(roomMarker)) {
  modes = modes.replace(
    roomMarker,
    `      ranked,
      finalized: false,
      stateVersion: 0,
      fxSeq: 0,
      lastSeq: {},`
  );
}

// Replace onFx with ordered team FX.
const oldFx = `      onFx: (type, data) => io.to(code).emit('game_fx', { type, data }),`;
const newFx = `      onFx: (type, data) => {
        room.fxSeq += 1;
        io.to(code).emit('game_fx', {
          type,
          data: {
            ...(data || {}),
            roomFxSeq: room.fxSeq,
            matchId: room.matchId
          }
        });
      },`;

if (modes.includes(oldFx)) {
  modes = modes.replace(oldFx, newFx);
} else if (!modes.includes('roomFxSeq')) {
  throw new Error('Anchor onFx do SquadBattleEngine nao encontrado.');
}

// Attach snapshot receives current canonical room version.
const attachAnchor = `      state: room.engine.getStateFor(slot.uid)
    });`;

if (modes.includes(attachAnchor)) {
  modes = modes.replace(
    attachAnchor,
    `      state: (() => {
        const state = room.engine.getStateFor(slot.uid);
        if (state) {
          state.roomCode = roomCode;
          state.matchId = room.matchId;
          state.ranked = room.ranked;
          state.stateVersion = room.stateVersion;
          state.serverNow = Date.now();
        }
        return state;
      })()
    });`
  );
}

// Final result state must also carry the canonical version.
const resultState = `          state: room.engine.getStateFor(slot.uid)
        });`;

if (modes.includes(resultState)) {
  modes = modes.replace(
    resultState,
    `          state: (() => {
            const state = room.engine.getStateFor(slot.uid);
            if (state) {
              state.roomCode = roomCode;
              state.matchId = room.matchId;
              state.ranked = room.ranked;
              state.stateVersion = room.stateVersion;
              state.serverNow = Date.now();
            }
            return state;
          })()
        });`
  );
}

// Dispose engine timers at finalize.
if (
  modes.includes('room.botController?.dispose?.();') &&
  !modes.includes('room.engine?.dispose?.();')
) {
  modes = modes.replace(
    'room.botController?.dispose?.();',
    'room.botController?.dispose?.();\n    room.engine?.dispose?.();'
  );
}

write('server/product-modes.js', modes);
console.log('[OK] server/product-modes.js - snapshot version canonica');

// ----------------------------------------------------------
// Client event ordering and full squad FX routing.
// ----------------------------------------------------------
let mm = read('js/multiplayer-manager.js');

const oldTeamHandlerStart = `    socketManager.on('team_state', payload => {
      if (!payload || !this.teamRoomCode) return;
      const version = Number(payload.stateVersion ?? -1);`;

if (mm.includes(oldTeamHandlerStart)) {
  mm = mm.replace(
    oldTeamHandlerStart,
    `    socketManager.on('team_state', payload => {
      if (!payload || !this.teamRoomCode) return;
      if (payload.roomCode && payload.roomCode !== this.teamRoomCode) return;
      if (this.teamMatchId && payload.matchId && payload.matchId !== this.teamMatchId) return;

      const version = Number(payload.stateVersion ?? -1);`
  );
}

const oldFxCondition = `      if (this.teamRoomCode && payload?.type === 'squad_attack') {
        teamBattleUI.handleFx(payload);
        return;
      }`;

const newFxCondition = `      if (
        this.teamRoomCode &&
        String(payload?.type || '').startsWith('squad_')
      ) {
        if (payload?.data?.matchId && payload.data.matchId !== this.teamMatchId) return;
        teamBattleUI.handleFx(payload);
        return;
      }`;

if (mm.includes(oldFxCondition)) {
  mm = mm.replace(oldFxCondition, newFxCondition);
} else if (!mm.includes("String(payload?.type || '').startsWith('squad_')")) {
  // Insert before legacy fx normalization.
  const fxAnchor = `    socketManager.on('game_fx', payload => {
      if (!this.isMultiplayer || !payload) return;`;

  if (!mm.includes(fxAnchor)) {
    throw new Error('game_fx listener nao encontrado.');
  }

  mm = mm.replace(
    fxAnchor,
    `${fxAnchor}

      if (
        this.teamRoomCode &&
        String(payload?.type || '').startsWith('squad_')
      ) {
        if (payload?.data?.matchId && payload.data.matchId !== this.teamMatchId) return;
        teamBattleUI.handleFx(payload);
        return;
      }`
  );
}

// Make team_result obey version/match as well.
const teamResultAnchor = `    socketManager.on('team_result', payload => {
      if (payload?.user) {`;

if (mm.includes(teamResultAnchor)) {
  mm = mm.replace(
    teamResultAnchor,
    `    socketManager.on('team_result', payload => {
      if (payload?.state?.matchId && this.teamMatchId && payload.state.matchId !== this.teamMatchId) return;

      if (payload?.user) {`
  );
}

// Avoid final stale state overwriting a newer snapshot.
const resultApply = `      if (payload?.state) this.applyTeamState(payload.state);`;
if (mm.includes(resultApply)) {
  mm = mm.replace(
    resultApply,
    `      if (payload?.state) {
        const version = Number(payload.state.stateVersion ?? -1);
        if (version < 0 || version >= this.latestTeamStateVersion) {
          if (version >= 0) this.latestTeamStateVersion = version;
          this.applyTeamState(payload.state);
        }
      }`
  );
}

write('js/multiplayer-manager.js', mm);
console.log('[OK] js/multiplayer-manager.js - ordem/sync + todos FX squad');

// ----------------------------------------------------------
// Official arena UI replacement.
// ----------------------------------------------------------
write(
  'js/team-ui.js',
  fs.readFileSync(
    path.join(PAYLOAD, 'team-ui-combat-sync-source.js'),
    'utf8'
  )
);
console.log('[OK] js/team-ui.js - cartas no centro + reaction + clash');

// CSS append once.
let arena = read('styles/arena.css');
const cssMarker = '2v2 Combat Presentation — attack/response cards + Beam Clash';
if (!arena.includes(cssMarker)) {
  arena += '\n\n' +
    fs.readFileSync(
      path.join(PAYLOAD, 'team-combat-presentation.css'),
      'utf8'
    ) +
    '\n';
}
write('styles/arena.css', arena);
console.log('[OK] styles/arena.css - apresentacao central 2v2');

// ----------------------------------------------------------
// Update previous team UI test to accept all squad FX.
// ----------------------------------------------------------
const teamUiTestPath = 'scripts/test-release-team-arena-ui.mjs';
if (fs.existsSync(full(teamUiTestPath))) {
  let oldTest = read(teamUiTestPath);
  oldTest = oldTest.replace(
    `assert.ok(mm.includes("payload?.type === 'squad_attack'"));`,
    `assert.ok(mm.includes("String(payload?.type || '').startsWith('squad_')"));`
  );
  write(teamUiTestPath, oldTest);
  console.log('[OK] test-release-team-arena-ui.mjs atualizado');
}

// New regression suite.
write(
  'scripts/test-release-team-combat-sync.mjs',
  fs.readFileSync(
    path.join(PAYLOAD, 'test-release-team-combat-sync.mjs'),
    'utf8'
  )
);

const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:team-sync'] =
  'node scripts/test-release-team-combat-sync.mjs';

if (!String(pkg.scripts.test || '').includes('test:team-sync')) {
  pkg.scripts.test =
    `${pkg.scripts.test} && npm run test:team-sync`;
}

write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json - test:team-sync');

console.log('2v2 COMBAT PRESENTATION + SYNC CYCLE APLICADO.');
