import mongoose from 'mongoose';

const DojoSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  tag: { type: String, required: true, unique: true, uppercase: true, trim: true },
  ownerUid: { type: String, required: true },
  members: { type: [String], default: [] },
  power: { type: Number, default: 0, min: 0 },
  victories: { type: Number, default: 0, min: 0 },
  losses: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const Dojo = mongoose.models.Dojo || mongoose.model('Dojo', DojoSchema);
