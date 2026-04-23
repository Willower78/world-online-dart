const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const League = require('../models/League');
const connectDB = require('../config/db');

const listLeagues = async () => {
  await connectDB();

  try {
    const leagues = await League.find({});

    if (leagues.length === 0) {
      console.log('No leagues found in the database.');
    } else {
      console.log('Leagues found:');
      leagues.forEach(league => {
        console.log(JSON.stringify(league, null, 2));
      });
    }
  } catch (error) {
    console.error('Error listing leagues:', error);
  } finally {
    mongoose.disconnect();
  }
};

listLeagues();
