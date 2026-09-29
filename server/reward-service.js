import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { User } from './user-model.js';
import { applyRankedResult, levelForXp } from '../js/ranked-rules.js';
import { RAID_BOSSES, raidRewardForBoss } from '../js/raid-rules.js';
import { progressDailyQuestState, dailyDateKey } from '../js/daily-quest-rules.js';

const receiptSchema = new mongoose.Schema({
  _id: { type: String },
  matchId: { type: String, required: true },
  uid: { type: String, required: true },
  event: { type: String, enum: ['ranked', 'raid'], required: true },
  payload: { type: Object, required: true },
  signature: { type: String, required: true },
  status: { type: String, enum: ['pending', 'applied'], default: 'pending', required: true },
  reward: { type: Object, default: null },
  appliedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  lastAttemptAt: { type: Date, default: null }
}, { timestamps: true, optimisticConcurrency: true });
receiptSchema.index({ status: 1, lastAttemptAt: 1, createdAt: 1 });
receiptSchema.index({ uid: 1, matchId: 1, event: 1 }, { unique: true });
// Receipts deliberately have no TTL: deleting a paid receipt permits a replay.
export const RewardReceipt = mongoose.models.RewardReceipt || mongoose.model('RewardReceipt', receiptSchema);

export class RewardPersistenceError extends Error {
  constructor(code, message, { cause, receiptId = null, durable = false } = {}) {
    super(message, cause ? { cause } : undefined);
    this.code = code; this.receiptId = receiptId; this.durable = durable;
  }
}
function requireValue(condition, code, message) {
  if (!condition) throw new RewardPersistenceError(code, message);
}
export function normalizeRewardRequest(input) {
  requireValue(typeof input?.matchId === 'string' && input.matchId.length > 0 && input.matchId.length <= 200, 'INVALID_MATCH', 'Identificador de partida inválido.');
  requireValue(typeof input?.uid === 'string' && input.uid.length > 0 && input.uid.length <= 200, 'INVALID_USER', 'Conta inválida.');
  let payload;
  if (input.event === 'ranked') {
    requireValue(typeof input.payload?.isWin === 'boolean', 'INVALID_RESULT', 'Resultado ranqueado inválido.');
    payload = { isWin: input.payload.isWin };
  } else if (input.event === 'raid') {
    requireValue(!!RAID_BOSSES[input.payload?.bossId], 'INVALID_BOSS', 'Chefe inválido.');
    requireValue(['VICTORY', 'DEFEAT'].includes(input.payload?.result), 'INVALID_RESULT', 'Resultado de raid inválido.');
    payload = { bossId: input.payload.bossId, result: input.payload.result };
  } else throw new RewardPersistenceError('INVALID_EVENT', 'Evento de recompensa inválido.');
  const identity = JSON.stringify([input.matchId, input.uid, input.event]);
  return { _id: crypto.createHash('sha256').update(identity).digest('hex'), matchId: input.matchId, uid: input.uid, event: input.event,
    payload, signature: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}

// Pure mutation builder. No card, escrow, Dust or deck fields are replaced.
export function buildRewardMutation(profile, event, payload, dateKey = dailyDateKey()) {
  requireValue(profile && profile.isGuest !== true, 'ACCOUNT_REQUIRED', 'Recompensas online exigem conta.');
  let changes, reward;
  if (event === 'ranked') {
    requireValue(typeof payload?.isWin === 'boolean', 'INVALID_RESULT', 'Resultado ranqueado inválido.');
    changes = applyRankedResult(profile, payload.isWin);
    changes.dailyQuests = progressDailyQuestState(profile.dailyQuests, 'online_match', 1, dateKey);
    if (payload.isWin) changes.dailyQuests = progressDailyQuestState(changes.dailyQuests, 'online_win', 1, dateKey);
    reward = { xp: changes.xp - Math.max(0, Number(profile.xp) || 0), rankPoints: changes.rankPoints - Math.max(0, Number(profile.rankPoints) || 0) };
  } else {
    requireValue(event === 'raid' && !!RAID_BOSSES[payload?.bossId] && ['VICTORY', 'DEFEAT'].includes(payload?.result), 'INVALID_RESULT', 'Resultado de raid inválido.');
    reward = payload.result === 'VICTORY' ? raidRewardForBoss(payload.bossId) : { zeni: 0, xp: 0, trophies: 0, gems: 0 };
    const xp = Math.max(0, Number(profile.xp) || 0) + reward.xp;
    changes = { zeni: Math.max(0, Number(profile.zeni) || 0) + reward.zeni, xp, level: levelForXp(xp),
      raidTrophies: Math.max(0, Number(profile.raidTrophies) || 0) + reward.trophies,
      gems: Math.max(0, Number(profile.gems) || 0) + reward.gems,
      dailyQuests: progressDailyQuestState(profile.dailyQuests, 'raid_complete', 1, dateKey) };
  }
  for (const [key, value] of Object.entries(changes)) {
    if (typeof value === 'number') requireValue(Number.isSafeInteger(value) && value >= 0, 'BALANCE_LIMIT', `Valor inválido em ${key}.`);
  }
  return { changes, reward };
}
function ready() {
  requireValue(mongoose.connection.readyState === 1, 'DATABASE_UNAVAILABLE', 'Banco indisponível. A recompensa ainda não foi registrada.');
}
const mongoRepository = {
  async ensureIntent(request) {
    ready();
    try {
      await RewardReceipt.updateOne({ _id: request._id }, { $setOnInsert: { ...request, status: 'pending' } }, { upsert: true, runValidators: true });
    } catch (error) {
      // Two submissions can race on the unique receipt; reading the winner is safe.
      if (error.code !== 11000) throw error;
    }
    return RewardReceipt.findById(request._id);
  },
  async transaction(work) { ready(); return mongoose.connection.transaction(work, { readPreference: 'primary' }); },
  async findReceipt(id, session) { return RewardReceipt.findById(id).session(session); },
  async findUser(uid, session) { return User.findOne({ uid, isGuest: false }).session(session); },
  async saveUser(user, changes, session) {
    for (const [key, value] of Object.entries(changes)) user[key] = value;
    user.markModified('dailyQuests');
    await user.save({ session });
  },
  async saveReceipt(receipt, reward, session) {
    receipt.status = 'applied'; receipt.reward = reward; receipt.appliedAt = new Date();
    receipt.lastError = null; receipt.lastAttemptAt = new Date(); receipt.markModified('reward');
    await receipt.save({ session });
  },
  async noteError(id, error) {
    await RewardReceipt.updateOne({ _id: id, status: 'pending' }, { $set: { lastError: String(error?.code || error?.name || 'REWARD_PENDING').slice(0, 100), lastAttemptAt: new Date() } });
  },
  async listPending(limit) { ready(); return RewardReceipt.find({ status: 'pending' }).sort({ lastAttemptAt: 1, createdAt: 1 }).limit(limit).lean(); }
};
export function retryableRewardError(error) {
  return error?.name === 'VersionError' || error?.code === 11000 || error?.code === 112 || error?.code === 251 ||
    error?.hasErrorLabel?.('TransientTransactionError') || error?.hasErrorLabel?.('UnknownTransactionCommitResult') || error?.name === 'MongoNetworkError';
}
function verifyReceipt(receipt, request) {
  requireValue(receipt && receipt.signature === request.signature && receipt.uid === request.uid && receipt.matchId === request.matchId && receipt.event === request.event,
    'REWARD_CONFLICT', 'Este recibo já pertence a outro resultado.');
}

export function createRewardService(repository = mongoRepository, { retries = 4, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  async function record(input) {
    const request = normalizeRewardRequest(input);
    let intent;
    try { intent = await repository.ensureIntent(request); }
    catch (error) {
      throw new RewardPersistenceError(error.code === 'DATABASE_UNAVAILABLE' ? error.code : 'REWARD_NOT_RECORDED',
        'Não foi possível registrar o resultado. Nenhuma recompensa foi confirmada.', { cause: error, receiptId: request._id });
    }
    verifyReceipt(intent, request);
    return intent;
  }
  async function apply(input, recorded = false) {
    const request = normalizeRewardRequest(input);
    if (!recorded) await record(input);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await repository.transaction(async session => {
          const receipt = await repository.findReceipt(request._id, session);
          verifyReceipt(receipt, request);
          const user = await repository.findUser(request.uid, session);
          requireValue(user, 'ACCOUNT_REQUIRED', 'Conta não encontrada para a recompensa.');
          if (receipt.status === 'applied') return { user, reward: receipt.reward, receipt, replayed: true };
          requireValue(receipt.status === 'pending', 'INVALID_RECEIPT', 'Recibo inválido.');
          const profile = typeof user.toObject === 'function' ? user.toObject() : user;
          const { changes, reward } = buildRewardMutation(profile, request.event, request.payload);
          await repository.saveUser(user, changes, session);
          await repository.saveReceipt(receipt, reward, session);
          return { user, reward, receipt, replayed: false };
        });
      } catch (error) {
        if (retryableRewardError(error) && attempt < retries) { await pause(20 * (attempt + 1)); continue; }
        try { await repository.noteError(request._id, error); } catch {}
        const unavailable = /Transaction numbers|replica set|mongos/i.test(error?.message || '');
        throw new RewardPersistenceError(unavailable ? 'TRANSACTIONS_REQUIRED' : 'REWARD_PENDING',
          'O resultado foi registrado; a recompensa está pendente de persistência.', { cause: error, receiptId: request._id, durable: true });
      }
    }
  }
  async function recoverPending({ limit = 25 } = {}) {
    const intents = await repository.listPending(Math.max(1, Math.min(100, Math.floor(limit))));
    const results = [];
    for (const intent of intents) {
      try { results.push({ receiptId: intent._id, applied: true, result: await apply(intent) }); }
      catch (error) { results.push({ receiptId: intent._id, applied: false, error }); }
    }
    return results;
  }
  async function applyBatch(inputs) {
    requireValue(Array.isArray(inputs) && inputs.length <= 8, 'INVALID_BATCH', 'Grupo de recompensas inválido.');
    const normalized = inputs.map(normalizeRewardRequest);
    requireValue(new Set(normalized.map(input => input._id)).size === normalized.length, 'DUPLICATE_BATCH', 'Resultado repetido no mesmo grupo.');
    // Persist every participant's intent before attempting any wallet mutation.
    for (const input of normalized) await record(input);
    const results = [];
    for (const input of normalized) results.push(await apply(input, true));
    return results;
  }
  return { record, apply, applyBatch, recoverPending };
}
const rewardService = createRewardService();
export const applyMatchReward = input => rewardService.apply(input);
export const applyMatchRewardBatch = inputs => rewardService.applyBatch(inputs);
export const recordMatchRewardIntent = input => rewardService.record(input);
export const recoverPendingRewards = options => rewardService.recoverPending(options);
let recoveryTimer = null;
export function startRewardRecovery({ intervalMs = 15000, onError = null } = {}) {
  if (recoveryTimer) return () => {};
  let running = false;
  const tick = async () => {
    if (running || mongoose.connection.readyState !== 1) return;
    running = true;
    try {
      const outcomes = await recoverPendingRewards({ limit: 25 });
      if (onError) for (const outcome of outcomes) if (!outcome.applied) onError(outcome.error, outcome.receiptId);
    } catch (error) { if (onError) onError(error); }
    finally { running = false; }
  };
  recoveryTimer = setInterval(tick, Math.max(3000, intervalMs));
  recoveryTimer.unref?.();
  void tick();
  return () => { clearInterval(recoveryTimer); recoveryTimer = null; };
}

// Rooms retire after bounded retries. Durable pending receipts outlive the room and
// are recovered from MongoDB, so no unbounded in-memory reward queue is needed.
export function deferRewardFinalization(room, error, { retry, retire, notify = () => {} }) {
  const code = error.code || 'REWARD_PENDING';
  if (room.rewardNoticeCode !== code) {
    room.rewardNoticeCode = code;
    notify({ code, durable: !!error.durable, receiptId: error.receiptId || null,
      message: error.durable ? 'Resultado registrado. Recompensa pendente; será retomada pelo servidor.' : 'A recompensa não foi confirmada. O banco está indisponível.' });
  }
  room.rewardRetryCount = (room.rewardRetryCount || 0) + 1;
  if (room.rewardRetryCount <= 3 && !room.rewardRetryTimer) {
    room.rewardRetryTimer = setTimeout(() => { room.rewardRetryTimer = null; void retry(); }, [750, 2000, 5000][room.rewardRetryCount - 1]);
    room.rewardRetryTimer.unref?.();
  } else if (!room.rewardRetireTimer) {
    room.rewardRetireTimer = setTimeout(() => { if (!room.rewardFinalized) retire(); }, 30000);
    room.rewardRetireTimer.unref?.();
  }
}
