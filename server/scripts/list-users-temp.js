const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const listUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'username email role');
    console.log('Users found:', users);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

listUsers();
