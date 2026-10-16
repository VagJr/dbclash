import crypto from 'node:crypto';
import { LEADERS, getCardById } from '../js/card-database.js';
import {
  getEffectiveCardCost,
  getLeaderAttackBonus,
  getCardRule,
  getDefenseBlockMultiplier,
  isAttackAction,
  isImmediateTechnique,
  isPhysicalAttack
} from '../js/content-rules.js';
import {
  getRaidBoss,
  raidPhaseForHp,
  raidBossAttackProfile,
  RAID_PLAYER_ACTION_COOLDOWN_MS,
  RAID_BOSS_ACTION_MS
} from '../js/raid-rules.js';
import { chooseRaidBossDecision } from './bot-ai.js';

function shuffleSecure(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class RaidRoomEngine {
  constructor({ bossId = 'cell_max', players = [], onState = () => {}, onEvent = () => {}, onComplete = () => {} } = {}) {
    this.bossTemplate = getRaidBoss(bossId);
    this.boss = { ...this.bossTemplate, hp: this.bossTemplate.maxHp, phase: 1 };
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
        isBot: !!entry.isBot,
        botDifficulty: entry.botDifficulty || 'normal',
        threat: 0,
        guardBlock: 0,
        dodgeNext: false,
        dodgeRule: null,
        counterNext: 0,
        counterRule: null,
        reflectNext: 0,
        stealKiNext: 0,
        downed: false,
        abandoned: false,
        hand: [],
        deck: shuffleSecure(entry.deck || []),
        discard: [],
        actionReadyAt: Date.now() + 500
      };
    });

    this.state = 'ACTIVE';
    this.round = 1;
    this.logs = [];
    this.stateVersion = 0;
    this.finished = false;
    this.bossActionAt = Date.now() + RAID_BOSS_ACTION_MS;
    this.onState = onState;
    this.onEvent = onEvent;
    this.onComplete = onComplete;

    for (const player of this.players) this.draw(player, 5);
    this._log(`RAID simultaneo iniciado contra ${this.boss.name}.`, 'info');
    // Intentionally do not call onState from constructor. The owning room must
    // finish assigning room.engine before any callback can observe it.
  }

  _log(text, type = 'info') {
    this.logs.unshift({ text, type, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (this.logs.length > 50) this.logs.length = 50;
  }

  _notify() {
    this.stateVersion += 1;
    this.onState(this);
  }

  _complete(result) {
    if (this.finished) return;
    this.finished = true;
    this.state = result;
    this.bossActionAt = 0;
    this._notify();
    this.onComplete(result, this);
  }

  draw(player, count = 1) {
    for (let i = 0; i < count; i++) {
      if (!player || player.hand.length >= 7) break;
      if (!player.deck.length) {
        if (!player.discard.length) break;
        player.deck = shuffleSecure(player.discard);
        player.discard = [];
      }
      const cardId = player.deck.pop();
      const card = getCardById(cardId);
      if (card) player.hand.push({ ...card, instanceId: `${card.id}_${crypto.randomUUID()}` });
    }
  }

  getPlayer(uid) {
    return this.players.find(player => player.uid === uid) || null;
  }

  getAlivePlayers() {
    return this.players.filter(player => !player.downed && !player.abandoned && player.hp > 0);
  }

  canAct(uid, now = Date.now()) {
    if (this.finished || this.state !== 'ACTIVE') return false;
    const player = this.getPlayer(uid);
    return !!player && !player.downed && !player.abandoned && player.hp > 0 && now >= (player.actionReadyAt || 0);
  }

  _awakenIfNeeded(player) {
    if (!player || player.isAwakened || player.hp <= 0) return;
    if (player.hp <= (player.leader.awakenThresholdHp || 200)) {
      player.isAwakened = true;
      if (player.leader.id === 'piccolo') player.hp = Math.min(player.maxHp, player.hp + 50);
      this._log(`${player.username} despertou ${player.leader.awakenedName || 'Poder Total'}.`, 'awaken');
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
      player.reflectNext = Math.max(player.reflectNext, Number(rule.reflect || 0));
      player.stealKiNext = Math.max(player.stealKiNext, Number(rule.stealKi || 0));
      if (rule.heal) player.hp = Math.min(player.maxHp, player.hp + rule.heal);
      if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
      if (rule.draw) this.draw(player, rule.draw);
    } else if (card.type === 'evade') {
      player.dodgeNext = true;
      player.dodgeRule = { ...rule };
      if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
      if (rule.draw) this.draw(player, rule.draw);
    } else if (card.type === 'counter') {
      player.counterNext = Math.max(player.counterNext, Number(rule.counterDamage || card.power || 0));
      player.counterRule = { ...rule };
      if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
    }
  }

  _damageBoss(amount, sourcePlayer, card) {
    const damage = Math.max(0, Math.floor(Number(amount) || 0));
    if (damage <= 0) return 0;
    this.boss.hp = Math.max(0, this.boss.hp - damage);
    sourcePlayer.threat = Math.max(0, Number(sourcePlayer.threat) || 0) + damage;
    const oldPhase = this.boss.phase;
    this.boss.phase = raidPhaseForHp(this.boss.hp, this.boss.maxHp);
    this._log(`${sourcePlayer.username} causou ${damage} em ${this.boss.name} com ${card.name}.`, 'damage');
    this.onEvent('raid_player_attack', {
      sourceUid: sourcePlayer.uid,
      card: { id: card.id, name: card.name, isBeam: !!card.isBeam },
      damage
    });

    if (this.boss.phase > oldPhase) {
      this._log(`${this.boss.name} entrou na FASE ${this.boss.phase}.`, 'info');
      this.onEvent('boss_phase', { phase: this.boss.phase, bossId: this.boss.id });
    }
    if (this.boss.hp <= 0) this._complete('VICTORY');
    return damage;
  }

  playCard(uid, handIndex, remoteCardId = null) {
    if (!this.canAct(uid)) return false;
    const player = this.getPlayer(uid);

    let index = Number.isInteger(handIndex) ? handIndex : -1;
    if (remoteCardId) {
      const found = player.hand.findIndex(card => card.id === remoteCardId);
      if (found >= 0) index = found;
    }
    if (index < 0 || index >= player.hand.length) return false;

    const card = player.hand[index];
    const cost = getEffectiveCardCost(player, card);
    if (player.ki < cost) return false;
    const validType = isAttackAction(card) || isImmediateTechnique(card) || ['defense', 'evade', 'counter'].includes(card.type);
    if (!validType) return false;

    const handBefore = [...player.hand];
    player.ki -= cost;
    player.hand.splice(index, 1);
    player.discard.push(card.id);

    if (isAttackAction(card)) {
      const bonus = player.nextAttackBonus + getLeaderAttackBonus(player, card, handBefore);
      player.nextAttackBonus = 0;
      this._damageBoss(Number(card.power || 0) + bonus, player, card);
    } else if (isImmediateTechnique(card)) {
      this._applyImmediateTechnique(player, card);
      this._log(`${player.username} usou ${card.name}.`, 'info');
    } else {
      this._prepareDefense(player, card);
      this._log(`${player.username} preparou ${card.name} contra o proximo ataque do chefe.`, 'info');
    }

    player.actionReadyAt = Date.now() + (getCardRule(card).retainInitiative ? 650 : RAID_PLAYER_ACTION_COOLDOWN_MS);
    if (!this.finished) {
      this.draw(player, 1);
      this._notify();
    }
    return true;
  }

  chargeKi(uid) {
    if (!this.canAct(uid)) return false;
    const player = this.getPlayer(uid);
    const amount = player.leader.id === 'frieza' && player.isAwakened ? 3 : 2;
    player.ki = Math.min(10, player.ki + amount);
    player.actionReadyAt = Date.now() + 1100;
    this._log(`${player.username} carregou ${amount} Ki.`, 'charge');
    this._notify();
    return true;
  }

  passTurn(uid) {
    if (!this.canAct(uid)) return false;
    const player = this.getPlayer(uid);
    player.actionReadyAt = Date.now() + 650;
    this._log(`${player.username} reposicionou-se no campo.`, 'info');
    this._notify();
    return true;
  }

  _reactionAllowed(rule, attackProfile) {
    if (!rule) return true;
    if (rule.beamOnly && !attackProfile?.isBeam) return false;
    if (rule.physicalOnly && !attackProfile?.isPhysical) return false;
    return true;
  }

  _applyBossDamage(player, rawDamage, attackProfile = {}) {
    if (player.dodgeNext && this._reactionAllowed(player.dodgeRule, attackProfile)) {
      player.dodgeNext = false;
      player.dodgeRule = null;
      this._log(`${player.username} esquivou completamente do ataque do chefe.`, 'evade');
      return 0;
    }
    player.dodgeNext = false;
    player.dodgeRule = null;

    const block = Math.max(0, Number(player.guardBlock) || 0);
    const damage = Math.max(0, Math.floor(rawDamage - block));
    player.guardBlock = 0;
    player.hp = Math.max(0, player.hp - damage);

    if (player.counterNext > 0) {
      const allowed = this._reactionAllowed(player.counterRule, attackProfile);
      const counter = player.counterNext;
      player.counterNext = 0;
      player.counterRule = null;
      if (allowed && player.hp > 0) {
        this.boss.hp = Math.max(0, this.boss.hp - counter);
        this._log(`${player.username} contra-atacou e causou ${counter} no chefe.`, 'counter');
      }
    }

    if (player.reflectNext > 0 && player.hp > 0) {
      this.boss.hp = Math.max(0, this.boss.hp - player.reflectNext);
      player.reflectNext = 0;
    }

    if (player.hp <= 0) {
      player.downed = true;
      this._log(`${player.username} foi derrubado.`, 'damage');
    } else {
      this._awakenIfNeeded(player);
    }

    return damage;
  }

  _bossTurn(now = Date.now()) {
    if (this.finished) return;
    this.boss.phase = raidPhaseForHp(this.boss.hp, this.boss.maxHp);
    const decision = chooseRaidBossDecision({
      boss: this.boss,
      players: this.getAlivePlayers(),
      phase: this.boss.phase,
      round: this.round
    });
    const profile = decision?.profile || raidBossAttackProfile(this.boss, this.boss.phase, this.round);
    const selected = (decision?.targetUids || []).map(uid => this.getPlayer(uid)).filter(Boolean);
    const targets = selected.length ? selected : this.getAlivePlayers().slice(0, profile.mode === 'all' ? 4 : profile.mode === 'two' ? 2 : 1);

    this._log(`${this.boss.name} usou ${profile.name}.`, 'damage');
    this.onEvent('boss_attack', {
      bossId: this.boss.id,
      name: profile.name,
      damage: profile.damage,
      targetUids: targets.map(target => target.uid)
    });

    for (const target of targets) {
      const dealt = this._applyBossDamage(target, profile.damage, { isBeam: true, isPhysical: false });
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
    for (const player of this.getAlivePlayers()) {
      player.ki = Math.min(10, player.ki + 1);
      this.draw(player, 1);
    }
    this.bossActionAt = now + RAID_BOSS_ACTION_MS;
    this._notify();
  }

  abandonPlayer(uid) {
    const player = this.getPlayer(uid);
    if (!player || player.abandoned) return false;
    player.abandoned = true;
    player.downed = true;
    player.hp = 0;
    this._log(`${player.username} deixou o Raid.`, 'info');
    if (!this.getAlivePlayers().length) this._complete('DEFEAT');
    else this._notify();
    return true;
  }

  tick(now = Date.now()) {
    if (this.finished) return false;
    if (now >= this.bossActionAt) {
      this._bossTurn(now);
      return true;
    }
    return false;
  }

  getStateFor(uid) {
    const player = this.getPlayer(uid);
    if (!player) return null;

    const publicPlayer = p => ({
      uid: p.uid,
      username: p.username,
      leader: p.leader,
      hp: p.hp,
      maxHp: p.maxHp,
      ki: p.ki,
      isAwakened: p.isAwakened,
      isBot: !!p.isBot,
      threat: p.threat,
      guardBlock: p.guardBlock,
      dodgeNext: p.dodgeNext,
      counterNext: p.counterNext,
      downed: p.downed,
      abandoned: p.abandoned,
      handSize: p.hand.length,
      actionReadyAt: p.actionReadyAt
    });

    return {
      mode: 'raid-realtime',
      state: this.state,
      stateVersion: this.stateVersion,
      round: this.round,
      bossActionAt: this.bossActionAt,
      boss: {
        id: this.boss.id,
        name: this.boss.name,
        hp: this.boss.hp,
        maxHp: this.boss.maxHp,
        phase: this.boss.phase,
        color: this.boss.color
      },
      players: this.players.map(publicPlayer),
      you: {
        ...publicPlayer(player),
        hand: clone(player.hand),
        canAct: this.canAct(uid)
      },
      logs: clone(this.logs)
    };
  }
}
