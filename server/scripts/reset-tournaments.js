const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const pathToEnv = path.resolve(__dirname, '../.env');
dotenv.config({ path: pathToEnv });

const Tournament = require('../models/Tournament');
const connectDB = require('../config/db');

const resetTournaments = async () => {
  await connectDB();

  try {
    console.log('Deleting all existing tournaments...');
    await Tournament.deleteMany({});
    console.log('All tournaments deleted.');
  } catch (error) {
    console.error('Error deleting tournaments:', error);
  } finally {
    mongoose.disconnect();
    process.exit();
  }
};

resetTournaments();
