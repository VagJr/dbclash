import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { User } from './user-model.js';
import { requireSession } from './auth-session.js';
import { reserveExchange, settleExchange, cancelExchange, ExchangeError, EXCHANGE_TTL_MS } from '../js/exchange-rules.js';

const schema = new mongoose.Schema({
  _id: { type: String },
  sellerUid: { type: String, required: true, index: true },
  sellerName: { type: String, required: true },
  kind: { type: String, enum: ['sale', 'trade'], required: true },
  cardId: { type: String, required: true },
  requestedCardId: { type: String, default: null },
  price: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'completed', 'cancelled'], default: 'open', index: true },
  buyerUid: { type: String, default: null },
  expiresAt: { type: Date, required: true },
  completedAt: { type: Date, default: null }
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ status: 1, createdAt: -1 });
export const ExchangeListing = mongoose.models.ExchangeListing || mongoose.model('ExchangeListing', schema);

function publicListing(listing) {
  return { id: listing._id, sellerUid: listing.sellerUid, sellerName: listing.sellerName,
    kind: listing.kind, cardId: listing.cardId, requestedCardId: listing.requestedCardId,
    price: listing.price, status: listing.status, expiresAt: listing.expiresAt, createdAt: listing.createdAt };
}
function applyState(user, state) {
  user.zeni = state.zeni;
  user.cardInventory = state.cardInventory;
  user.escrowInventory = state.escrowInventory;
  user.ownedCards = state.ownedCards;
  user.markModified('cardInventory');
  user.markModified('escrowInventory');
}
function domainError(code, message) { throw new ExchangeError(code, message); }
async function userFor(uid, session) {
  const user = await User.findOne({ uid, isGuest: false }).session(session);
  if (!user) domainError('ACCOUNT_REQUIRED', 'Conta não encontrada.');
  return user;
}

// Card escrow, both wallets, and the listing commit in one database transaction.
// Optimistic concurrency also protects these writes against legacy economy saves.
async function atomic(work) {
  if (mongoose.connection.readyState !== 1) domainError('DATABASE_UNAVAILABLE', 'Mercado indisponível. Tente novamente mais tarde.');
  return mongoose.connection.transaction(work, { readPreference: 'primary' });
}
function errorResponse(error, res) {
  const transactionUnavailable = /Transaction numbers|replica set|mongos/i.test(error?.message || '');
  const code = transactionUnavailable ? 'TRANSACTIONS_REQUIRED' : error.code || 'EXCHANGE_UNAVAILABLE';
  const message = transactionUnavailable ? 'Mercado precisa de um banco com transações habilitadas.'
    : error instanceof ExchangeError ? error.message : 'Não foi possível concluir a negociação. Nenhuma transferência parcial foi aplicada.';
  res.status(error instanceof ExchangeError ? 400 : 503).json({ success: false, code, message });
}

export function registerExchange(app) {
  app.get('/api/exchange', requireSession, async (req, res) => {
    try {
      const query = req.query.own === '1' ? { sellerUid: req.auth.uid, status: 'open' }
        : { status: 'open', expiresAt: { $gt: new Date() } };
      if (req.query.kind === 'sale' || req.query.kind === 'trade') query.kind = req.query.kind;
      const listings = await ExchangeListing.find(query).sort({ createdAt: -1 }).limit(100).lean();
      res.json({ success: true, listings: listings.map(publicListing) });
    } catch (error) { errorResponse(error, res); }
  });

  app.post('/api/exchange', requireSession, async (req, res) => {
    try {
      const { requestId, kind, cardId, requestedCardId, price } = req.body || {};
      if (!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId || '')) domainError('INVALID_REQUEST_ID', 'Identificador da negociação inválido.');
      // A user-scoped key makes retries safe even after a connection interruption.
      const id = crypto.createHash('sha256').update(`${req.auth.uid}:${requestId}`).digest('hex');
      const result = await atomic(async session => {
        const user = await userFor(req.auth.uid, session);
        const previous = await ExchangeListing.findById(id).session(session);
        if (previous) {
          if (previous.kind !== kind || previous.cardId !== cardId || (kind === 'sale' ? previous.price !== price : previous.requestedCardId !== requestedCardId)) {
            domainError('REQUEST_ID_REUSED', 'Este identificador já pertence a outra negociação.');
          }
          return { listing: publicListing(previous), user: user.toPublicJSON() };
        }
        const state = reserveExchange(user.toObject(), { kind, cardId, requestedCardId, price });
        applyState(user, state);
        await user.save({ session });
        const [listing] = await ExchangeListing.create([{ _id: id, sellerUid: user.uid, sellerName: user.displayName,
          kind, cardId, requestedCardId: kind === 'trade' ? requestedCardId : null,
          price: kind === 'sale' ? price : 0, expiresAt: new Date(Date.now() + EXCHANGE_TTL_MS) }], { session });
        return { listing: publicListing(listing), user: user.toPublicJSON() };
      });
      res.json({ success: true, ...result });
    } catch (error) { errorResponse(error, res); }
  });

  app.post('/api/exchange/:id/accept', requireSession, async (req, res) => {
    try {
      if (!/^[a-f0-9]{64}$/.test(req.params.id)) domainError('INVALID_LISTING', 'Oferta inválida.');
      const result = await atomic(async session => {
        const listing = await ExchangeListing.findById(req.params.id).session(session);
        if (!listing) domainError('LISTING_NOT_FOUND', 'Oferta não encontrada.');
        const buyer = await userFor(req.auth.uid, session);
        if (listing.status === 'completed' && listing.buyerUid === buyer.uid) {
          return { listing: publicListing(listing), user: buyer.toPublicJSON() };
        }
        const seller = await userFor(listing.sellerUid, session);
        const state = settleExchange(listing, seller.toObject(), buyer.toObject());
        applyState(seller, state.seller);
        applyState(buyer, state.buyer);
        listing.status = 'completed'; listing.buyerUid = buyer.uid; listing.completedAt = new Date();
        await seller.save({ session });
        await buyer.save({ session });
        await listing.save({ session });
        return { listing: publicListing(listing), user: buyer.toPublicJSON() };
      });
      res.json({ success: true, ...result });
    } catch (error) { errorResponse(error, res); }
  });

  app.post('/api/exchange/:id/cancel', requireSession, async (req, res) => {
    try {
      if (!/^[a-f0-9]{64}$/.test(req.params.id)) domainError('INVALID_LISTING', 'Oferta inválida.');
      const result = await atomic(async session => {
        const listing = await ExchangeListing.findById(req.params.id).session(session);
        if (!listing || listing.sellerUid !== req.auth.uid) domainError('LISTING_NOT_FOUND', 'Oferta não encontrada.');
        const user = await userFor(req.auth.uid, session);
        if (listing.status === 'cancelled') return { listing: publicListing(listing), user: user.toPublicJSON() };
        applyState(user, cancelExchange(listing, user.toObject()));
        listing.status = 'cancelled';
        await user.save({ session });
        await listing.save({ session });
        return { listing: publicListing(listing), user: user.toPublicJSON() };
      });
      res.json({ success: true, ...result });
    } catch (error) { errorResponse(error, res); }
  });
}
