const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');
const connectDB = require('../config/db');

const makePremium = async (email) => {
  if (!email) {
    console.error('Please provide an email address.');
    process.exit(1);
  }

  await connectDB();

  try {
    const user = await User.findOne({ email });

    if (!user) {
      console.error(`User with email ${email} not found.`);
      process.exit(1);
    }

    user.subscriptionStatus = 'active';
    user.isSubscriber = true;
    await user.save();

    console.log(`Successfully upgraded user ${user.username} (${email}) to premium.`);
  } catch (error) {
    console.error('Error upgrading user:', error);
  } finally {
    mongoose.disconnect();
  }
};

const email = process.argv[2];
makePremium(email);
