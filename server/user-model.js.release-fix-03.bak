import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  displayName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  isGuest: { type: Boolean, default: false },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  rankPoints: { type: Number, default: 1000 },
  division: { type: String, default: 'Bronze I' },
  victories: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  unlockedLeaders: { type: [String], default: ['goku', 'vegeta', 'gohan', 'frieza'] },
  selectedLeader: { type: String, default: 'goku' },
  customDecks: { type: Object, default: {} },
  ownedCards: { type: [String], default: [] },
  raidTrophies: { type: Number, default: 0 },
  zeni: { type: Number, default: 500 },
  gems: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Password Hash Pre-save Hook
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare Password Method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Return Safe Public Profile
UserSchema.methods.toPublicJSON = function () {
  return {
    uid: this.uid,
    displayName: this.displayName,
    email: this.email,
    isGuest: this.isGuest,
    level: this.level,
    xp: this.xp,
    rankPoints: this.rankPoints,
    division: this.division,
    victories: this.victories,
    losses: this.losses,
    unlockedLeaders: this.unlockedLeaders,
    selectedLeader: this.selectedLeader,
    customDecks: this.customDecks,
    ownedCards: this.ownedCards,
    raidTrophies: this.raidTrophies,
    zeni: this.zeni,
    gems: this.gems,
    createdAt: this.createdAt
  };
};

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
