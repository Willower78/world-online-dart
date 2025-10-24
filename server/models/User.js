const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  friends: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Array of users who have sent a friend request to this user
  friendRequests: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  isAdmin: {
    type: Boolean,
    default: false
  },
  // --- Fält för Stripe-integration ---
  stripeCustomerId: {
    type: String
  },
  subscriptionStatus: {
    type: String,
    enum: ['none', 'active', 'canceled', 'past_due'],
    default: 'none'
  },
  // --- Nya profilfält ---
  profilePicture: {
    type: String,
    default: '/uploads/default-avatar.png' // En standardbild
  },
  location: {
    type: String,
    trim: true
  },
  birthdate: {
    type: Date
  }
  // TODO: Lägg till matchHistory och stats senare
});

module.exports = mongoose.model('User', UserSchema);