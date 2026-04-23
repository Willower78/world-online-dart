const User = require('../models/User');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const makeAdmin = async (username) => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const user = await User.findOneAndUpdate(
      { username: username },
      { $set: { isAdmin: true } },
      { new: true }
    );

    if (user) {
      console.log(`Successfully promoted ${username} to admin.`);
      console.log(user);
    } else {
      console.log(`User ${username} not found.`);
    }
  } catch (error) {
    console.error('Error promoting user to admin:', error);
  } finally {
    await mongoose.disconnect();
  }
};

const username = process.argv[2];
if (!username) {
  console.log('Please provide a username.');
  process.exit(1);
}

makeAdmin(username);
