import assert from 'node:assert/strict';
import { createRewardService, normalizeRewardRequest, buildRewardMutation, RewardPersistenceError, deferRewardFinalization } from '../server/reward-service.js';

const clone = value => structuredClone(value);
function profile(uid) {
  return { uid, isGuest: false, xp: 450, level: 1, rankPoints: 1000, victories: 2, losses: 1,
    zeni: 1000, gems: 3, dust: 250, raidTrophies: 0, dailyQuests: {},
    cardInventory: { nxs_goku_01: 2 }, escrowInventory: { nxs_goku_02: 1 }, customDecks: { goku: ['atk_01'] } };
}
// This repository models transaction rollback, serialized commits and injected
// failures. It is not a substitute for replica-set integration QA.
function fakeRepository(users = [profile('a')]) {
  const repository = { users: new Map(users.map(user => [user.uid, clone(user)])), receipts: new Map(), saves: 0,
    fault: null, errorNotes: 0, queue: Promise.resolve(), intentsBeforeFirstSave: null };
  repository.ensureIntent = async request => {
    if (!repository.receipts.has(request._id)) repository.receipts.set(request._id, { ...clone(request), status: 'pending', createdAt: new Date(), lastAttemptAt: null });
    return clone(repository.receipts.get(request._id));
  };
  repository.transaction = async work => {
    const previous = repository.queue;
    let release; repository.queue = new Promise(resolve => { release = resolve; });
    await previous;
    const session = { users: new Map([...repository.users].map(([key, user]) => [key, clone(user)])),
      receipts: new Map([...repository.receipts].map(([key, receipt]) => [key, clone(receipt)])) };
    try {
      const result = await work(session);
      repository.users = session.users; repository.receipts = session.receipts;
      return result;
    } finally { release(); }
  };
  repository.findReceipt = async (id, session) => session.receipts.get(id);
  repository.findUser = async (uid, session) => { const user = session.users.get(uid); return user?.isGuest ? null : user; };
  repository.saveUser = async (user, changes, session) => {
    repository.intentsBeforeFirstSave ??= repository.receipts.size;
    if (repository.fault) await repository.fault({ phase: 'user', user, changes, session, repository });
    Object.assign(user, clone(changes)); session.users.set(user.uid, user); repository.saves++;
  };
  repository.saveReceipt = async (receipt, reward, session) => {
    if (repository.fault) await repository.fault({ phase: 'receipt', receipt, reward, session, repository });
    Object.assign(receipt, { status: 'applied', reward: clone(reward), appliedAt: new Date() });
    session.receipts.set(receipt._id, receipt);
  };
  repository.noteError = async (id, error) => {
    const receipt = repository.receipts.get(id);
    if (receipt?.status === 'pending') { receipt.lastError = error.code || error.name; receipt.lastAttemptAt = new Date(); repository.errorNotes++; }
  };
  repository.listPending = async limit => [...repository.receipts.values()].filter(receipt => receipt.status === 'pending')
    .sort((a, b) => Number(a.lastAttemptAt || 0) - Number(b.lastAttemptAt || 0)).slice(0, limit).map(clone);
  return repository;
}
const ranked = (uid = 'a', matchId = 'match-01', isWin = true) => ({ uid, matchId, event: 'ranked', payload: { isWin } });
const raid = (uid = 'a', matchId = 'raid-01', result = 'VICTORY') => ({ uid, matchId, event: 'raid', payload: { bossId: 'cell_max', result } });
const serviceFor = repository => createRewardService(repository, { pause: async () => {} });
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('PASS', name); }

await test('server event validation rejects invalid outcomes before registering an intent', async () => {
  assert.throws(() => normalizeRewardRequest({ ...ranked(), payload: { isWin: 'yes' } }), error => error.code === 'INVALID_RESULT');
  assert.throws(() => normalizeRewardRequest({ ...raid(), payload: { bossId: 'unknown', result: 'VICTORY' } }), error => error.code === 'INVALID_BOSS');
  assert.throws(() => normalizeRewardRequest({ ...ranked(), event: 'grant', payload: { zeni: 9999 } }), error => error.code === 'INVALID_EVENT');
  assert.notEqual(normalizeRewardRequest(ranked('a'))._id, normalizeRewardRequest(ranked('b'))._id);
});
await test('ranked receipt updates XP, RP and quests once without touching cards or wallets', async () => {
  const repo = fakeRepository(), service = serviceFor(repo), before = clone(repo.users.get('a'));
  const first = await service.apply(ranked()), replay = await service.apply(ranked());
  assert.equal(first.replayed, false); assert.equal(replay.replayed, true);
  assert.equal(repo.users.get('a').xp, 600); assert.equal(repo.users.get('a').rankPoints, 1025);
  assert.equal(repo.users.get('a').dailyQuests.progress.play_online_2, 1);
  assert.equal(repo.users.get('a').dailyQuests.progress.win_online_1, 1); assert.equal(repo.saves, 1);
  for (const key of ['zeni', 'dust', 'gems', 'cardInventory', 'escrowInventory', 'customDecks']) assert.deepEqual(repo.users.get('a')[key], before[key]);
  await assert.rejects(service.apply(ranked('a', 'match-01', false)), error => error.code === 'REWARD_CONFLICT');
});
await test('concurrent duplicate submissions commit one reward and one receipt', async () => {
  const repo = fakeRepository(), service = serviceFor(repo);
  const results = await Promise.all(Array.from({ length: 6 }, () => service.apply(ranked())));
  assert.equal(repo.users.get('a').xp, 600); assert.equal(repo.receipts.size, 1); assert.equal(repo.saves, 1);
  assert.equal(results.filter(result => !result.replayed).length, 1);
});
await test('VersionError retries use a fresh wallet after a concurrent purchase', async () => {
  const repo = fakeRepository(), service = serviceFor(repo); let injected = false;
  repo.fault = async ({ phase, repository }) => {
    if (phase === 'user' && !injected) {
      injected = true; repository.users.get('a').zeni = 500;
      const error = new Error('Concurrent wallet save'); error.name = 'VersionError'; throw error;
    }
  };
  await service.apply(raid());
  assert.equal(repo.users.get('a').zeni, 1100); assert.equal(repo.users.get('a').xp, 650);
  assert.equal(repo.saves, 1); assert.equal(repo.receipts.size, 1);
});
await test('receipt-write failure rolls back the user and persists a recoverable intent', async () => {
  const repo = fakeRepository(), service = serviceFor(repo), before = clone(repo.users.get('a'));
  repo.fault = async ({ phase }) => { if (phase === 'receipt') throw new Error('Injected commit failure'); };
  await assert.rejects(service.apply(raid()), error => error.code === 'REWARD_PENDING' && error.durable === true);
  assert.deepEqual(repo.users.get('a'), before);
  assert.equal([...repo.receipts.values()][0].status, 'pending');
  repo.fault = null; const recovered = await service.recoverPending();
  assert.equal(recovered[0].applied, true); assert.equal(repo.users.get('a').zeni, 1600);
  assert.equal([...repo.receipts.values()][0].status, 'applied');
  await service.apply(raid()); assert.equal(repo.users.get('a').zeni, 1600);
});
await test('every team intent exists before payment and partial failure recovers other participants', async () => {
  const repo = fakeRepository(['a', 'b', 'c', 'd'].map(profile)), service = serviceFor(repo);
  repo.fault = async ({ phase, user }) => { if (phase === 'user' && user.uid === 'b') throw new Error('Injected participant failure'); };
  await assert.rejects(service.applyBatch(['a', 'b', 'c', 'd'].map(uid => ranked(uid, 'team-01'))), error => error.durable === true);
  assert.equal(repo.intentsBeforeFirstSave, 4); assert.equal(repo.receipts.size, 4);
  assert.equal(repo.users.get('a').xp, 600); assert.equal(repo.users.get('c').xp, 450);
  repo.fault = null; await service.recoverPending();
  for (const user of repo.users.values()) assert.equal(user.xp, 600);
  assert.equal([...repo.receipts.values()].filter(receipt => receipt.status === 'applied').length, 4);
});
await test('defeated raid records completion without paying victory currency', async () => {
  const repo = fakeRepository(), service = serviceFor(repo);
  const result = await service.apply(raid('a', 'raid-defeat', 'DEFEAT'));
  assert.equal(repo.users.get('a').zeni, 1000); assert.equal(repo.users.get('a').xp, 450);
  assert.equal(repo.users.get('a').dailyQuests.progress.complete_raid_1, 1);
  assert.deepEqual(result.reward, { zeni: 0, xp: 0, trophies: 0, gems: 0 });
});
await test('balance overflow fails before mutation rather than creating unsafe money', async () => {
  assert.throws(() => buildRewardMutation({ ...profile('a'), zeni: Number.MAX_SAFE_INTEGER }, 'raid', { bossId: 'cell_max', result: 'VICTORY' }), error => error.code === 'BALANCE_LIMIT');
});
await test('database-down intent failure never claims a persisted or paid result', async () => {
  const repo = fakeRepository(), service = serviceFor(repo), before = clone(repo.users.get('a'));
  repo.ensureIntent = async () => { throw new RewardPersistenceError('DATABASE_UNAVAILABLE', 'offline'); };
  await assert.rejects(service.apply(ranked()), error => error.code === 'DATABASE_UNAVAILABLE' && error.durable === false);
  assert.deepEqual(repo.users.get('a'), before); assert.equal(repo.receipts.size, 0);
});
await test('room retry notifications stay quiet and retention is bounded', async () => {
  const room = {}, notices = [];
  const error = new RewardPersistenceError('REWARD_PENDING', 'pending', { durable: true });
  for (let attempt = 0; attempt < 4; attempt++) {
    deferRewardFinalization(room, error, { retry: async () => {}, retire: () => {}, notify: notice => notices.push(notice) });
    if (room.rewardRetryTimer) { clearTimeout(room.rewardRetryTimer); room.rewardRetryTimer = null; }
  }
  assert.equal(notices.length, 1); assert.ok(room.rewardRetireTimer); clearTimeout(room.rewardRetireTimer);
});
console.log(`NEXUS REWARDS: ${passed} PASS / 0 FAIL. Repository mocks verify logic; real replica-set transactions remain unverified.`);
