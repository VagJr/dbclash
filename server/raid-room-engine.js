import crypto from 'node:crypto';
import { LEADERS, getCardById } from '../js/card-database.js';
import {
  getEffectiveCardCost,
  getLeaderAttackBonus,
  getCardRule,
  isAttackAction,
  isImmediateTechnique
} from '../js/content-rules.js';
import {
  getRaidBoss,
  raidPhaseForHp,
  raidBossAttackProfile,
  RAID_TURN_MS
} from '../js/raid-rules.js';

function shuffleSecure(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class RaidRoomEngine {
  constructor({ bossId = 'cell_max', players = [], onState = () => {}, onEvent = () => {}, onComplete = () => {} } = {}) {
    this.bossTemplate = getRaidBoss(bossId);
    this.boss = {
      ...this.bossTemplate,
      hp: this.bossTemplate.maxHp,
      phase: 1
    };

    this.players = players.map((entry, index) => {
      const leader = LEADERS[entry.leader] || LEADERS.goku;
      return {
        uid: entry.uid,
        username: entry.username || `Guerreiro ${index + 1}`,
        leader: { ...leader },
        hp: leader.maxHp || 400,
        maxHp: leader.maxHp || 400,
        ki: leader.id === 'frieza' ? 6 : 4,
        isAwakened: false,
        nextAttackBonus: 0,
        guardBlock: 0,
        dodgeNext: false,
        counterNext: 0,
        downed: false,
        abandoned: false,
        hand: [],
        deck: shuffleSecure(entry.deck || []),
        discard: []
      };
    });

    this.state = 'ACTIVE';
    this.round = 1;
    this.currentPlayerIndex = 0;
    this.actedThisRound = new Set();
    this.turnDeadline = Date.now() + RAID_TURN_MS;
    this.logs = [];
    this.stateVersion = 0;
    this.finished = false;
    this.onState = onState;
    this.onEvent = onEvent;
    this.onComplete = onComplete;

    for (const player of this.players) this.draw(player, 5);
    this._moveCurrentToAlive();
    this._log(`RAID iniciado contra ${this.boss.name}.`, 'info');
    this._notify();
  }

  _log(text, type = 'info') {
    this.logs.unshift({
      text,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (this.logs.length > 40) this.logs.length = 40;
  }

  _notify() {
    this.stateVersion += 1;
    this.onState(this);
  }

  _complete(result) {
    if (this.finished) return;
    this.finished = true;
    this.state = result;
    this.turnDeadline = 0;
    this._notify();
    this.onComplete(result, this);
  }

  draw(player, count = 1) {
    for (let i = 0; i < count; i++) {
      if (!player || player.hand.length >= 7) break;

      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffleSecure(player.discard);
        player.discard = [];
      }

      const cardId = player.deck.pop();
      const card = getCardById(cardId);
      if (card) {
        player.hand.push({
          ...card,
          instanceId: `${card.id}_${crypto.randomUUID()}`
        });
      }
    }
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex] || null;
  }

  get currentPlayerUid() {
    return this.currentPlayer?.uid || null;
  }

  getPlayer(uid) {
    return this.players.find(player => player.uid === uid) || null;
  }

  getAlivePlayers() {
    return this.players.filter(player => !player.downed && !player.abandoned && player.hp > 0);
  }

  _moveCurrentToAlive() {
    if (!this.players.length) return;

    for (let offset = 0; offset < this.players.length; offset++) {
      const index = (this.currentPlayerIndex + offset) % this.players.length;
      const candidate = this.players[index];
      if (candidate && !candidate.downed && !candidate.abandoned && candidate.hp > 0) {
        this.currentPlayerIndex = index;
        this.turnDeadline = Date.now() + RAID_TURN_MS;
        return;
      }
    }
  }

  _awakenIfNeeded(player) {
    if (!player.isAwakened && player.hp > 0 && player.hp <= (player.leader.awakenThresholdHp || 200)) {
      player.isAwakened = true;
      if (player.leader.id === 'piccolo') {
        player.hp = Math.min(player.maxHp, player.hp + 50);
      }
      this._log(`${player.username} despertou ${player.leader.awakenedName}.`, 'info');
    }
  }

  _applyImmediateTechnique(player, card) {
    const rule = getCardRule(card);

    if (rule.selfDamage) {
      player.hp = Math.max(0, player.hp - rule.selfDamage);
      if (player.hp <= 0) player.downed = true;
    }
    if (rule.heal) player.hp = Math.min(player.maxHp, player.hp + rule.heal);
    if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
    if (rule.draw) this.draw(player, rule.draw);
    if (rule.nextAttackBonus) player.nextAttackBonus += rule.nextAttackBonus;

    this._awakenIfNeeded(player);
  }

  _prepareDefense(player, card) {
    const rule = getCardRule(card);

    if (card.type === 'defense') {
      let block = Number(card.block || 0);
      if (player.leader.id === 'piccolo') block += 15;
      player.guardBlock = Math.max(player.guardBlock, block);
      if (rule.heal) player.hp = Math.min(player.maxHp, player.hp + rule.heal);
      if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
      if (rule.draw) this.draw(player, rule.draw);
    } else if (card.type === 'evade') {
      player.dodgeNext = true;
      if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
      if (rule.draw) this.draw(player, rule.draw);
    } else if (card.type === 'counter') {
      player.counterNext = Math.max(player.counterNext, Number(rule.counterDamage || card.power || 0));
      if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
    }
  }

  _damageBoss(amount, sourcePlayer, card) {
    const damage = Math.max(0, Math.floor(Number(amount) || 0));
    if (damage <= 0) return 0;

    this.boss.hp = Math.max(0, this.boss.hp - damage);
    const oldPhase = this.boss.phase;
    this.boss.phase = raidPhaseForHp(this.boss.hp, this.boss.maxHp);
    this._log(`${sourcePlayer.username} causou ${damage} em ${this.boss.name} com ${card.name}.`, 'damage');

    if (this.boss.phase > oldPhase) {
      this._log(`${this.boss.name} entrou na FASE ${this.boss.phase}.`, 'info');
      this.onEvent('boss_phase', { phase: this.boss.phase, bossId: this.boss.id });
    }

    if (this.boss.hp <= 0) this._complete('VICTORY');
    return damage;
  }

  playCard(uid, handIndex, remoteCardId = null) {
    if (this.finished || this.state !== 'ACTIVE') return false;
    const player = this.getPlayer(uid);
    if (!player || player.uid !== this.currentPlayerUid || player.downed || player.abandoned) return false;

    let index = Number.isInteger(handIndex) ? handIndex : -1;
    if (remoteCardId) {
      const found = player.hand.findIndex(card => card.id === remoteCardId);
      if (found >= 0) index = found;
    }
    if (index < 0 || index >= player.hand.length) return false;

    const card = player.hand[index];
    const cost = getEffectiveCardCost(player, card);
    if (player.ki < cost) return false;

    const validType =
      isAttackAction(card) ||
      isImmediateTechnique(card) ||
      ['defense', 'evade', 'counter'].includes(card.type);
    if (!validType) return false;

    const handBefore = [...player.hand];
    player.ki -= cost;
    player.hand.splice(index, 1);
    player.discard.push(card.id);

    let retainTurn = false;

    if (isAttackAction(card)) {
      const leaderBonus = getLeaderAttackBonus(player, card, handBefore);
      const bonus = player.nextAttackBonus + leaderBonus;
      player.nextAttackBonus = 0;
      this._damageBoss(Number(card.power || 0) + bonus, player, card);
      retainTurn = !!getCardRule(card).retainInitiative && !this.finished;
    } else if (isImmediateTechnique(card)) {
      this._applyImmediateTechnique(player, card);
      this._log(`${player.username} usou ${card.name}.`, 'info');
    } else {
      this._prepareDefense(player, card);
      this._log(`${player.username} preparou ${card.name} contra o proximo ataque do chefe.`, 'info');
    }

    if (this.finished) return true;

    if (!retainTurn) {
      this.actedThisRound.add(uid);
      this._advanceAfterPlayerAction();
    } else {
      this.turnDeadline = Date.now() + RAID_TURN_MS;
      this._notify();
    }

    return true;
  }

  chargeKi(uid) {
    if (this.finished || this.state !== 'ACTIVE') return false;
    const player = this.getPlayer(uid);
    if (!player || player.uid !== this.currentPlayerUid || player.downed || player.abandoned) return false;

    const amount = player.leader.id === 'frieza' && player.isAwakened ? 3 : 2;
    player.ki = Math.min(10, player.ki + amount);
    this._log(`${player.username} carregou ${amount} Ki.`, 'info');
    this.actedThisRound.add(uid);
    this._advanceAfterPlayerAction();
    return true;
  }

  passTurn(uid) {
    if (this.finished || this.state !== 'ACTIVE') return false;
    const player = this.getPlayer(uid);
    if (!player || player.uid !== this.currentPlayerUid || player.downed || player.abandoned) return false;

    this._log(`${player.username} passou o turno.`, 'info');
    this.actedThisRound.add(uid);
    this._advanceAfterPlayerAction();
    return true;
  }

  _advanceAfterPlayerAction() {
    if (this.finished) return;

    const alive = this.getAlivePlayers();
    if (!alive.length) {
      this._complete('DEFEAT');
      return;
    }

    const unacted = alive.filter(player => !this.actedThisRound.has(player.uid));
    if (!unacted.length) {
      this._bossTurn();
      return;
    }

    for (let offset = 1; offset <= this.players.length; offset++) {
      const index = (this.currentPlayerIndex + offset) % this.players.length;
      const candidate = this.players[index];
      if (
        candidate &&
        !candidate.downed &&
        !candidate.abandoned &&
        candidate.hp > 0 &&
        !this.actedThisRound.has(candidate.uid)
      ) {
        this.currentPlayerIndex = index;
        this.turnDeadline = Date.now() + RAID_TURN_MS;
        this._notify();
        return;
      }
    }
  }

  _selectTargets(profile) {
    const alive = this.getAlivePlayers();
    if (profile.mode === 'all') return alive;
    if (profile.mode === 'two') return alive.slice(0, Math.min(2, alive.length));
    if (!alive.length) return [];
    const index = (this.round - 1) % alive.length;
    return [alive[index]];
  }

  _applyBossDamage(player, rawDamage) {
    if (player.dodgeNext) {
      player.dodgeNext = false;
      this._log(`${player.username} esquivou completamente do ataque do chefe.`, 'evade');
      return 0;
    }

    const damage = Math.max(0, Math.floor(rawDamage - player.guardBlock));
    player.guardBlock = 0;
    player.hp = Math.max(0, player.hp - damage);

    if (player.counterNext > 0 && player.hp > 0) {
      const counter = player.counterNext;
      player.counterNext = 0;
      this.boss.hp = Math.max(0, this.boss.hp - counter);
      this._log(`${player.username} contra-atacou e causou ${counter} no chefe.`, 'damage');
    } else {
      player.counterNext = 0;
    }

    if (player.hp <= 0) {
      player.downed = true;
      this._log(`${player.username} foi derrubado.`, 'damage');
    } else {
      this._awakenIfNeeded(player);
    }

    return damage;
  }

  _bossTurn() {
    if (this.finished) return;

    this.state = 'BOSS_TURN';
    this.boss.phase = raidPhaseForHp(this.boss.hp, this.boss.maxHp);
    const profile = raidBossAttackProfile(this.boss, this.boss.phase, this.round);
    const targets = this._selectTargets(profile);
    this._log(`${this.boss.name} usou ${profile.name}.`, 'damage');

    for (const target of targets) {
      const dealt = this._applyBossDamage(target, profile.damage);
      if (dealt > 0) this._log(`${target.username} recebeu ${dealt} de dano.`, 'damage');
      if (this.boss.hp <= 0) {
        this._complete('VICTORY');
        return;
      }
    }

    if (!this.getAlivePlayers().length) {
      this._complete('DEFEAT');
      return;
    }

    this.round += 1;
    this.actedThisRound.clear();

    for (const player of this.getAlivePlayers()) {
      player.ki = Math.min(10, player.ki + 1);
      this.draw(player, 1);
    }

    this.state = 'ACTIVE';
    this.currentPlayerIndex = 0;
    this._moveCurrentToAlive();
    this._notify();
  }

  abandonPlayer(uid) {
    const player = this.getPlayer(uid);
    if (!player || player.abandoned) return false;

    const wasCurrent = player.uid === this.currentPlayerUid;
    player.abandoned = true;
    player.downed = true;
    player.hp = 0;
    this.actedThisRound.add(uid);
    this._log(`${player.username} deixou o Raid.`, 'info');

    if (!this.getAlivePlayers().length) {
      this._complete('DEFEAT');
      return true;
    }

    if (wasCurrent) this._advanceAfterPlayerAction();
    else this._notify();
    return true;
  }

  tick(now = Date.now()) {
    if (this.finished || this.state !== 'ACTIVE') return false;
    if (!this.turnDeadline || now < this.turnDeadline) return false;
    const uid = this.currentPlayerUid;
    if (!uid) return false;
    this._log('Tempo de turno esgotado. Turno passado automaticamente.', 'info');
    return this.passTurn(uid);
  }

  getStateFor(uid) {
    const you = this.getPlayer(uid);
    return {
      mode: 'raid',
      state: this.state,
      stateVersion: this.stateVersion,
      round: this.round,
      turnDeadline: this.turnDeadline,
      currentPlayerUid: this.currentPlayerUid,
      boss: {
        id: this.boss.id,
        name: this.boss.name,
        hp: this.boss.hp,
        maxHp: this.boss.maxHp,
        phase: this.boss.phase,
        color: this.boss.color
      },
      you: you ? {
        uid: you.uid,
        username: you.username,
        leader: you.leader,
        hp: you.hp,
        maxHp: you.maxHp,
        ki: you.ki,
        isAwakened: you.isAwakened,
        nextAttackBonus: you.nextAttackBonus,
        guardBlock: you.guardBlock,
        dodgeNext: you.dodgeNext,
        counterNext: you.counterNext,
        downed: you.downed,
        abandoned: you.abandoned,
        hand: you.hand,
        deckCount: you.deck.length,
        discardCount: you.discard.length
      } : null,
      players: this.players.map(player => ({
        uid: player.uid,
        username: player.username,
        leader: player.leader,
        hp: player.hp,
        maxHp: player.maxHp,
        ki: player.ki,
        isAwakened: player.isAwakened,
        downed: player.downed,
        abandoned: player.abandoned,
        handSize: player.hand.length
      })),
      logs: this.logs.slice(0, 16)
    };
  }
}
