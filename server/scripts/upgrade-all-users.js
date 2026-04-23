const User = require('../models/User');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const upgradeAllUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const result = await User.updateMany(
      { subscriptionStatus: { $ne: 'active' } },
      { $set: { subscriptionStatus: 'active' } }
    );

    console.log(`Successfully upgraded ${result.modifiedCount} users to Premium.`);
  } catch (error) {
    console.error('Error upgrading users to premium:', error);
  } finally {
    await mongoose.disconnect();
  }
};

upgradeAllUsers();
