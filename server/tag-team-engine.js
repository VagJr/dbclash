import crypto from 'node:crypto';
import { GameEngine as ServerGameEngine } from './server-engine.js';
import { getStarterDeckForLeader } from '../js/card-database.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeFighterSnapshot(entry) {
  const temp = new ServerGameEngine(() => {}, () => {});
  temp.reset();

  const playerDeck = temp.secureShuffle(entry.deck || []);
  const dummyDeck = temp.secureShuffle(getStarterDeckForLeader('goku'));

  temp.startMatch(
    entry.leader,
    'goku',
    entry.deck || [],
    false,
    {
      playerDeck,
      opponentDeck: dummyDeck,
      initiative: 'player'
    }
  );

  const fighter = clone(temp.player);
  fighter.name = entry.username || fighter.name;
  return fighter;
}

export class TagTeamEngine {
  constructor({ teamA = [], teamB = [], onState = () => {}, onFx = () => {}, onComplete = () => {} } = {}) {
    if (teamA.length !== 2 || teamB.length !== 2) {
      throw new Error('TagTeamEngine requires exactly 2 players per team.');
    }

    this.onState = onState;
    this.onFx = onFx;
    this.onComplete = onComplete;
    this.finished = false;
    this.teamWinner = null;
    this.stateVersion = 0;
    this.initializing = true;

    this.teams = {
      A: teamA.map(entry => ({
        uid: entry.uid,
        username: entry.username,
        leader: entry.leader,
        isBot: !!entry.isBot,
        botDifficulty: entry.botDifficulty || 'normal',
        downed: false,
        abandoned: false,
        fighter: makeFighterSnapshot(entry)
      })),
      B: teamB.map(entry => ({
        uid: entry.uid,
        username: entry.username,
        leader: entry.leader,
        isBot: !!entry.isBot,
        botDifficulty: entry.botDifficulty || 'normal',
        downed: false,
        abandoned: false,
        fighter: makeFighterSnapshot(entry)
      }))
    };

    this.activeIndex = { A: 0, B: 0 };

    this.engine = new ServerGameEngine(
      () => this._handleEngineState(),
      (type, data) => this.onFx(type, data)
    );

    this.engine.reset();
    this.engine.player = clone(this.teams.A[0].fighter);
    this.engine.opponent = clone(this.teams.B[0].fighter);
    this.engine.state = 'FREE_ACTION';
    this.engine.winner = null;
    this.engine.pendingAttack = null;
    this.engine.beamClashData = null;
    this.engine.attackResolved = false;
    this.engine.initiative = crypto.randomInt(0, 2) === 0 ? 'player' : 'opponent';
    this.initializing = false;
    this._emitState();
  }

  sideToKey(side) {
    return side === 'A' ? 'player' : 'opponent';
  }

  keyToSide(key) {
    return key === 'player' ? 'A' : 'B';
  }

  otherSide(side) {
    return side === 'A' ? 'B' : 'A';
  }

  getActiveMember(side) {
    return this.teams[side][this.activeIndex[side]];
  }

  getMember(uid) {
    for (const side of ['A', 'B']) {
      const index = this.teams[side].findIndex(member => member.uid === uid);
      if (index >= 0) return { side, index, member: this.teams[side][index] };
    }
    return null;
  }

  getReserveMember(side) {
    const index = this.activeIndex[side] === 0 ? 1 : 0;
    return this.teams[side][index];
  }

  _syncFromEngine() {
    const activeA = this.getActiveMember('A');
    const activeB = this.getActiveMember('B');
    activeA.fighter = clone(this.engine.player);
    activeB.fighter = clone(this.engine.opponent);
  }

  _loadActiveIntoEngine(side) {
    const key = this.sideToKey(side);
    this.engine[key] = clone(this.getActiveMember(side).fighter);
  }

  _emitState() {
    if (this.initializing) return;
    this._syncFromEngine();
    this.stateVersion += 1;
    this.onState(this);
  }

  _teamAlive(side) {
    return this.teams[side].some(member => !member.downed && !member.abandoned && member.fighter.hp > 0);
  }

  _availableReserveIndex(side) {
    for (let i = 0; i < this.teams[side].length; i++) {
      if (i === this.activeIndex[side]) continue;
      const member = this.teams[side][i];
      if (!member.downed && !member.abandoned && member.fighter.hp > 0) return i;
    }
    return -1;
  }

  _handleEngineState() {
    if (this.initializing || this.finished) return;
    this._syncFromEngine();

    if (this.engine.state === 'GAME_OVER' && this.engine.winner) {
      const winnerSide = this.keyToSide(this.engine.winner);
      const loserSide = this.otherSide(winnerSide);
      const loser = this.getActiveMember(loserSide);
      loser.downed = true;
      loser.fighter.hp = 0;

      const reserveIndex = this._availableReserveIndex(loserSide);
      if (reserveIndex >= 0) {
        this.activeIndex[loserSide] = reserveIndex;
        this._loadActiveIntoEngine(loserSide);
        this.engine.clearReactionTimer?.();
        this.engine.clearBeamClashLoop?.();
        this.engine.state = 'FREE_ACTION';
        this.engine.winner = null;
        this.engine.pendingAttack = null;
        this.engine.beamClashData = null;
        this.engine.attackResolved = false;
        this.engine.initiative = this.sideToKey(loserSide);
        this._emitState();
        return;
      }

      this.finished = true;
      this.teamWinner = winnerSide;
      this.stateVersion += 1;
      this.onState(this);
      this.onComplete(winnerSide, this);
      return;
    }

    this._emitState();
  }

  action(uid, action, data = {}) {
    if (this.finished) return false;
    const found = this.getMember(uid);
    if (!found || found.member.downed || found.member.abandoned) return false;
    if (found.index !== this.activeIndex[found.side]) return false;

    const actorKey = this.sideToKey(found.side);

    switch (action) {
      case 'playCard':
        this.engine._playCard(actorKey, data.cardIndex, data.cardId);
        return true;
      case 'chargeKi':
        this.engine._chargeKi(actorKey);
        return true;
      case 'passTurn':
        this.engine._passTurn(actorKey);
        return true;
      case 'mashBeamClash':
        this.engine._mashBeamClash(actorKey);
        return true;
      case 'tag':
        return this.tag(uid);
      default:
        return false;
    }
  }

  tag(uid) {
    if (this.finished || this.engine.state !== 'FREE_ACTION') return false;
    const found = this.getMember(uid);
    if (!found || found.index !== this.activeIndex[found.side]) return false;

    const actorKey = this.sideToKey(found.side);
    if (this.engine.initiative !== actorKey) return false;

    const reserveIndex = this._availableReserveIndex(found.side);
    if (reserveIndex < 0) return false;

    this._syncFromEngine();
    this.activeIndex[found.side] = reserveIndex;
    this._loadActiveIntoEngine(found.side);
    this.engine._passTurn(actorKey);
    return true;
  }

  abandon(uid) {
    const found = this.getMember(uid);
    if (!found || found.member.abandoned) return false;

    const wasActive = found.index === this.activeIndex[found.side];
    found.member.abandoned = true;
    found.member.downed = true;
    found.member.fighter.hp = 0;

    if (!this._teamAlive(found.side)) {
      this.finished = true;
      this.teamWinner = this.otherSide(found.side);
      this.engine.state = 'GAME_OVER';
      this.engine.winner = this.sideToKey(this.teamWinner);
      this.stateVersion += 1;
      this.onState(this);
      this.onComplete(this.teamWinner, this);
      return true;
    }

    if (wasActive) {
      const reserveIndex = this._availableReserveIndex(found.side);
      if (reserveIndex >= 0) {
        this.activeIndex[found.side] = reserveIndex;
        this._loadActiveIntoEngine(found.side);
        this.engine.clearReactionTimer?.();
        this.engine.clearBeamClashLoop?.();
        this.engine.state = 'FREE_ACTION';
        this.engine.winner = null;
        this.engine.pendingAttack = null;
        this.engine.beamClashData = null;
        this.engine.attackResolved = false;
        this.engine.initiative = this.sideToKey(found.side);
      }
    }

    this._emitState();
    return true;
  }

  getStateFor(uid) {
    this._syncFromEngine();
    const found = this.getMember(uid);
    if (!found) return null;

    const viewerKey = this.sideToKey(found.side);
    const duel = this.engine.getFullSyncState(viewerKey);

    // A reserve player must not see the active teammate's private hand.
    if (found.index !== this.activeIndex[found.side]) {
      if (found.side === 'A' && duel.player?.hand) {
        duel.player.hand = duel.player.hand.map(() => ({ hidden: true }));
      }
      if (found.side === 'B' && duel.opponent?.hand) {
        duel.opponent.hand = duel.opponent.hand.map(() => ({ hidden: true }));
      }
    }

    const publicMember = (member, side, index) => ({
      uid: member.uid,
      username: member.username,
      leader: member.fighter.leader,
      isBot: !!member.isBot,
      hp: member.fighter.hp,
      maxHp: member.fighter.maxHp,
      ki: member.fighter.ki,
      isAwakened: member.fighter.isAwakened,
      downed: member.downed,
      abandoned: member.abandoned,
      active: this.activeIndex[side] === index,
      handSize: member.fighter.hand?.length || 0
    });

    return {
      mode: '2v2',
      stateVersion: this.stateVersion,
      teamSide: found.side,
      teamWinner: this.teamWinner,
      finished: this.finished,
      activeUidA: this.getActiveMember('A').uid,
      activeUidB: this.getActiveMember('B').uid,
      duel,
      teams: {
        A: this.teams.A.map((member, index) => publicMember(member, 'A', index)),
        B: this.teams.B.map((member, index) => publicMember(member, 'B', index))
      },
      you: {
        uid: found.member.uid,
        active: found.index === this.activeIndex[found.side],
        hand: found.index === this.activeIndex[found.side] ? found.member.fighter.hand : clone(found.member.fighter.hand)
      }
    };
  }
}
