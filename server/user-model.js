import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  displayName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  isGuest: { type: Boolean, default: false },

  level: { type: Number, default: 1, min: 1 },
  xp: { type: Number, default: 0, min: 0 },
  rankPoints: { type: Number, default: 1000, min: 0 },
  division: { type: String, default: 'Bronze I' },
  victories: { type: Number, default: 0, min: 0 },
  losses: { type: Number, default: 0, min: 0 },

  unlockedLeaders: { type: [String], default: ['goku', 'vegeta', 'gohan', 'frieza'] },
  selectedLeader: { type: String, default: 'goku' },
  customDecks: { type: Object, default: {} },

  ownedCards: { type: [String], default: [] },
  cardInventory: { type: Object, default: {} },

  raidTrophies: { type: Number, default: 0, min: 0 },
  zeni: { type: Number, default: 500, min: 0 },
  gems: { type: Number, default: 10, min: 0 },
  dust: { type: Number, default: 300, min: 0 },

  dojoId: { type: String, default: null },
  dailyQuests: { type: Object, default: {} },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

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
    cardInventory: this.cardInventory,
    raidTrophies: this.raidTrophies,
    zeni: this.zeni,
    gems: this.gems,
    dust: this.dust,
    dojoId: this.dojoId,
    dailyQuests: this.dailyQuests,
    createdAt: this.createdAt
  };
};

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
