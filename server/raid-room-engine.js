import crypto from 'node:crypto';
import { LEADERS, getCardById } from '../js/card-database.js';
import {
  getEffectiveCardCost,
  getLeaderAttackBonus,
  getCardRule,
  getDefenseBlockMultiplier,
  isAttackAction,
  isImmediateTechnique,
  isPhysicalAttack,
  canUseReaction,
  getChargeAmount,
  getBeamMashPower
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
    this.boss = { ...this.bossTemplate, hp: this.bossTemplate.maxHp, phase: 1, ki: 10, hand: [] };
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
        openGuardUntil: 0,
        get isOpenGuard() { return this.openGuardUntil > Date.now(); },
        isBot: !!entry.isBot,
        botDifficulty: entry.botDifficulty || 'normal',
        threat: 0,
        guardBlock: 0,
        guardRule: null,
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
    this.bossIntent = null;
    this.beamClashes = new Map();
    this.lastMashAt = new Map();
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
    this.bossIntent = null;
    this.beamClashes.clear();
    this.lastMashAt.clear();
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
    return !!player && !player.downed && !player.abandoned && player.hp > 0 && !this.beamClashes.has(uid) && now >= (player.actionReadyAt || 0);
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
    if (rule.heal && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + rule.heal);
    if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
    if (rule.draw) this.draw(player, rule.draw);
    if (rule.nextAttackBonus) player.nextAttackBonus = Math.max(player.nextAttackBonus || 0, rule.nextAttackBonus);
    this._awakenIfNeeded(player);
  }

  _prepareDefense(player, card) {
    const rule = getCardRule(card);
    if (card.type === 'defense') {
      let block = Number(card.block || 0);
      if (player.leader.id === 'piccolo') block += 15;
      player.guardBlock = Math.max(player.guardBlock, block);
      player.guardRule = { ...rule };
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
    const rule = getCardRule(card);
    let damage = Math.max(0, Math.floor(Number(amount) || 0));
    if (this.boss.hand?.length && !rule.unblockableDefense) {
      const guard = this.boss.hand.shift();
      damage = Math.max(0, damage - Math.floor(Number(guard.block || 0) * getDefenseBlockMultiplier(sourcePlayer, card)));
    }
    if (rule.breakShield && this.boss.hp > 0) damage = Math.max(damage, this.boss.hp - Math.max(0, (Math.ceil(this.boss.hp / 50) - 1) * 50));
    damage = Math.min(this.boss.hp, damage);
    if (damage <= 0) return 0;
    const previousHp = this.boss.hp;
    this.boss.hp = Math.max(0, this.boss.hp - damage);
    if (sourcePlayer.leader.id === 'gohan' && Math.ceil(this.boss.hp / 50) < Math.ceil(previousHp / 50)) this.draw(sourcePlayer, 2);
    sourcePlayer.threat = Math.max(0, Number(sourcePlayer.threat) || 0) + damage;
    const oldPhase = this.boss.phase;
    this.boss.phase = raidPhaseForHp(this.boss.hp, this.boss.maxHp);
    if (rule.drainKi) this.boss.ki = Math.max(0, this.boss.ki - rule.drainKi);
    if (rule.burnDefense) this.boss.hand.splice(0, rule.burnDefense);
    this._log(`${sourcePlayer.username} causou ${damage} em ${this.boss.name} com ${card.name}.`, 'damage');
    this.onEvent('raid_player_attack', {
      sourceUid: sourcePlayer.uid,
      card: { id: card.id, name: card.name, isBeam: !!card.isBeam },
      damage
    });

    if (this.boss.phase > oldPhase) {
      this.boss.hand = Array.from({ length: 2 }, () => ({ id: `boss_guard_${this.boss.phase}`, type: 'defense', block: this.boss.phase * 8 }));
      this._log(`${this.boss.name} entrou na FASE ${this.boss.phase}.`, 'info');
      this.onEvent('boss_phase', { phase: this.boss.phase, bossId: this.boss.id });
    }
    if (this.boss.hp <= 0) this._complete('VICTORY');
    return damage;
  }

  playCard(uid, handIndex, remoteCardId = null) {
    const player = this.getPlayer(uid);
    if (!player || player.downed || player.abandoned || this.finished || this.beamClashes.has(uid)) return false;
    const responding = this.bossIntent?.targetUids.includes(uid) && Date.now() < this.bossIntent.deadline;
    if (!responding && !this.canAct(uid)) return false;

    let index = Number.isInteger(handIndex) ? handIndex : -1;
    if (remoteCardId) {
      const found = player.hand.findIndex(card => card.id === remoteCardId);
      if (found < 0) return false;
      index = found;
    }
    if (index < 0 || index >= player.hand.length) return false;

    const card = player.hand[index];
    if (this.bossIntent?.targetUids.includes(uid) && Date.now() >= this.bossIntent.deadline && (['defense', 'evade', 'counter'].includes(card.type) || (card.isBeam && this.bossIntent.profile.isBeam))) return false;
    const cost = getEffectiveCardCost(player, card);
    if (player.ki < cost) return false;
    const validType = isAttackAction(card) || isImmediateTechnique(card) || ['defense', 'evade', 'counter'].includes(card.type);
    if (!validType) return false;
    const bossCard = this.bossIntent ? this._bossAttackCard(this.bossIntent.profile) : null;
    const beamResponse = responding && card.isBeam && canUseReaction(player, bossCard, card);
    if (responding && ['defense', 'evade', 'counter'].includes(card.type) && !canUseReaction(player, bossCard, card)) return false;
    const reaction = responding && (beamResponse || ['defense', 'evade', 'counter'].includes(card.type));
    if (reaction && this.bossIntent.respondedUids.includes(uid)) return false;
    if (responding && !beamResponse && !['defense', 'evade', 'counter'].includes(card.type) && !this.canAct(uid)) return false;

    const handBefore = [...player.hand];
    player.ki -= cost;
    player.hand.splice(index, 1);
    player.discard.push(card.id);
    if (reaction) this.bossIntent.respondedUids.push(uid);

    if (beamResponse) {
      const power = Number(card.power || 0) + player.nextAttackBonus + getLeaderAttackBonus(player, card, handBefore);
      player.nextAttackBonus = 0;
      this.beamClashes.set(uid, { uid, card: clone(card), power, bossDamage: this.bossIntent.profile.damage, profile: clone(this.bossIntent.profile), progress: Math.max(35, Math.min(65, 50 + (power - this.bossIntent.profile.damage) * 0.16)), deadline: Date.now() + 4200 });
      this.bossIntent.clashUids.push(uid);
      this.onEvent('raid_beam_clash', { uid, cardId: card.id });
    } else if (isAttackAction(card)) {
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
    if (reaction && (getCardRule(card).gainInitiative || getCardRule(card).stealInitiative || ['counter', 'evade'].includes(card.type))) player.actionReadyAt = Date.now();
    if (!this.getAlivePlayers().length && !this.finished) this._complete('DEFEAT');
    if (!this.finished) {
      this.draw(player, 1);
      this._notify();
    }
    return true;
  }

  chargeKi(uid) {
    if (!this.canAct(uid)) return false;
    const player = this.getPlayer(uid);
    if (player.ki >= 10) return false;
    const amount = getChargeAmount(player, null);
    player.ki = Math.min(10, player.ki + amount);
    player.openGuardUntil = Date.now() + 3500;
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

  _bossAttackCard(profile) {
    return { id: `raid_${this.boss.id}_${this.round}`, name: profile.name, type: 'attack', power: profile.damage, isBeam: !!profile.isBeam, isCombo: !!profile.isPhysical, damageKind: profile.isPhysical ? 'physical' : profile.isBeam ? 'beam' : 'ki' };
  }

  _telegraphBossAttack(now = Date.now()) {
    if (this.finished || this.bossIntent) return;
    const decision = chooseRaidBossDecision({ boss: this.boss, players: this.getAlivePlayers(), phase: this.boss.phase, round: this.round });
    const profile = { ...decision.profile };
    profile.damage = Math.max(1, Math.floor(profile.damage * (0.7 + 0.03 * this.boss.ki)));
    this.bossIntent = { id: `raid_intent_${this.round}`, profile, targetUids: decision.targetUids, respondedUids: [], clashUids: [], createdAt: now, deadline: this.bossActionAt };
    this.onEvent('boss_telegraph', clone(this.bossIntent));
    this._notify();
  }

  mashBeamClash(uid) {
    const clash = this.beamClashes.get(uid);
    const player = this.getPlayer(uid);
    const now = Date.now();
    if (this.finished || !clash || !player || player.downed || now >= clash.deadline || now - (this.lastMashAt.get(uid) || 0) < 80) return false;
    this.lastMashAt.set(uid, now);
    clash.progress = Math.max(0, Math.min(100, clash.progress + getBeamMashPower(player)));
    if (clash.progress >= 100) this._resolveRaidClash(uid);
    else this._notify();
    return true;
  }

  _resolveRaidClash(uid) {
    const clash = this.beamClashes.get(uid);
    const player = this.getPlayer(uid);
    if (!clash || !player || this.finished) return false;
    this.beamClashes.delete(uid);
    this.lastMashAt.delete(uid);
    const won = clash.progress > 50;
    if (won) this._damageBoss(clash.power, player, clash.card);
    else this._applyBossDamage(player, clash.bossDamage, clash.profile);
    this._log(`${player.username} ${won ? 'venceu' : 'perdeu'} a disputa de Ki Beam.`, 'beam');
    this.onEvent('raid_beam_resolved', { uid, won, power: clash.power });
    if (!this.getAlivePlayers().length && !this.finished) this._complete('DEFEAT');
    if (!this.finished) this._notify();
    return true;
  }

  _applyBossDamage(player, rawDamage, attackProfile = {}) {
    if (player.dodgeNext && !player.isOpenGuard && this._reactionAllowed(player.dodgeRule, attackProfile)) {
      player.dodgeNext = false;
      player.dodgeRule = null;
      player.actionReadyAt = Date.now();
      if (player.leader.id === 'trunks') {
        this.draw(player, player.isAwakened ? 2 : 1);
        if (player.isAwakened) player.ki = Math.min(10, player.ki + 2);
      }
      this._log(`${player.username} esquivou completamente do ataque do chefe.`, 'evade');
      return 0;
    }
    player.dodgeNext = false;
    player.dodgeRule = null;

    const block = this._reactionAllowed(player.guardRule, attackProfile) ? Math.max(0, Number(player.guardBlock) || 0) : 0;
    const counterAllowed = player.counterNext > 0 && this._reactionAllowed(player.counterRule, attackProfile);
    const damage = counterAllowed ? 0 : Math.min(player.hp, Math.max(0, Math.floor((player.isOpenGuard ? rawDamage * 1.5 : rawDamage) - block)));
    const guardRule = player.guardRule;
    player.guardBlock = 0;
    player.guardRule = null;
    player.hp = Math.max(0, player.hp - damage);
    if (damage > 0 && player.leader.id === 'goku') player.ki = Math.min(10, player.ki + 1);
    if (guardRule?.kiGainVsBeam && attackProfile.isBeam && player.hp > 0) player.ki = Math.min(10, player.ki + guardRule.kiGainVsBeam);
    if (guardRule?.gainInitiative && player.hp > 0) player.actionReadyAt = Date.now();

    if (player.counterNext > 0) {
      const allowed = counterAllowed;
      const counter = player.counterNext;
      player.counterNext = 0;
      player.counterRule = null;
      if (allowed && player.hp > 0) {
        player.actionReadyAt = Date.now();
        this.boss.hp = Math.max(0, this.boss.hp - counter);
        this._log(`${player.username} contra-atacou e causou ${counter} no chefe.`, 'counter');
      }
    }

    if (player.reflectNext > 0 && player.hp > 0) {
      this.boss.hp = Math.max(0, this.boss.hp - player.reflectNext);
      player.reflectNext = 0;
    }
    if (player.stealKiNext > 0 && player.hp > 0) {
      const stolen = Math.min(player.stealKiNext, this.boss.ki);
      this.boss.ki -= stolen;
      player.ki = Math.min(10, player.ki + stolen);
    }
    player.stealKiNext = 0;

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
    const decision = this.bossIntent ? { profile: this.bossIntent.profile, targetUids: this.bossIntent.targetUids } : chooseRaidBossDecision({
      boss: this.boss,
      players: this.getAlivePlayers(),
      phase: this.boss.phase,
      round: this.round
    });
    const profile = decision?.profile || raidBossAttackProfile(this.boss, this.boss.phase, this.round);
    const selected = (decision?.targetUids || []).map(uid => this.getPlayer(uid)).filter(player => player && !player.downed && !player.abandoned);
    const targets = this.bossIntent || selected.length ? selected : this.getAlivePlayers().slice(0, profile.mode === 'all' ? 4 : profile.mode === 'two' ? 2 : 1);

    this._log(`${this.boss.name} usou ${profile.name}.`, 'damage');
    this.onEvent('boss_attack', {
      bossId: this.boss.id,
      name: profile.name,
      damage: profile.damage,
      targetUids: targets.map(target => target.uid)
    });

    for (const target of targets) {
      if (this.beamClashes.has(target.uid) || this.bossIntent?.clashUids.includes(target.uid)) continue;
      const dealt = this._applyBossDamage(target, profile.damage, profile);
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
    this.boss.ki = Math.min(10, this.boss.ki + 1);
    this.bossIntent = null;
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
    this.beamClashes.delete(uid);
    this.lastMashAt.delete(uid);
    this._log(`${player.username} deixou o Raid.`, 'info');
    if (!this.getAlivePlayers().length) this._complete('DEFEAT');
    else this._notify();
    return true;
  }

  tick(now = Date.now()) {
    if (this.finished) return false;
    for (const [uid, clash] of this.beamClashes) {
      if (now >= clash.deadline) this._resolveRaidClash(uid);
      else {
        const elapsed = Math.max(0, now - (clash.lastBossMashAt || clash.deadline - 4200));
        if (elapsed >= 220) {
          clash.progress = Math.max(0, clash.progress - Math.floor(elapsed / 220) * 3);
          clash.lastBossMashAt = now;
          if (clash.progress <= 0) this._resolveRaidClash(uid);
          else this._notify();
        }
      }
      if (this.finished) return true;
    }
    if (!this.bossIntent && now >= this.bossActionAt - 2000) this._telegraphBossAttack(now);
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
      isOpenGuard: p.isOpenGuard,
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
      serverNow: Date.now(),
      state: this.state,
      stateVersion: this.stateVersion,
      round: this.round,
      bossActionAt: this.bossActionAt,
      bossIntent: this.bossIntent ? clone(this.bossIntent) : null,
      beamClashes: [...this.beamClashes.values()].map(clash => clone(clash)),
      boss: {
        id: this.boss.id,
        name: this.boss.name,
        hp: this.boss.hp,
        maxHp: this.boss.maxHp,
        phase: this.boss.phase,
        ki: this.boss.ki,
        guardCount: this.boss.hand.length,
        color: this.boss.color
      },
      players: this.players.map(publicPlayer),
      you: {
        ...publicPlayer(player),
        hand: clone(player.hand),
        beamClash: this.beamClashes.has(uid) ? clone(this.beamClashes.get(uid)) : null,
        canAct: this.canAct(uid)
      },
      logs: clone(this.logs)
    };
  }
}
