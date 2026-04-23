const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const pathToEnv = path.resolve(__dirname, '../.env');
dotenv.config({ path: pathToEnv });

const User = require('../models/User');
const League = require('../models/League');
const connectDB = require('../config/db');

const createSampleLeague = async () => {
  await connectDB();

  try {
    const mainUser = await User.findOne({ email: 'nybro.dart@gmail.com' });
    if (!mainUser) {
      console.error('Main user not found. Please ensure nybro.dart@gmail.com is registered.');
      return;
    }

    const dummyUsersData = [
      { username: 'PlayerOne', email: 'player1@example.com', password: 'password123' },
      { username: 'PlayerTwo', email: 'player2@example.com', password: 'password123' },
      { username: 'PlayerThree', email: 'player3@example.com', password: 'password123' },
    ];

    const userPromises = dummyUsersData.map(userData => 
      User.findOneAndUpdate({ email: userData.email }, userData, { upsert: true, new: true })
    );
    const users = await Promise.all(userPromises);
    users.push(mainUser);

    const newLeague = new League({
      name: 'World Online Dart - Season 1',
      gameType: '501',
      region: 'Scandinavian',
      
      divisions: [{
        divisionNumber: 1,
        name: 'Pro Division',
        players: users.map(u => u._id),
        standings: users.map(u => ({ player: u._id, wins: 0, losses: 0, points: 0 })),
      }]
    });

    // Basic round-robin schedule generation
    const players = newLeague.divisions[0].players;
    let week = 1;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        newLeague.divisions[0].schedule.push({
          week: week,
          player1: players[i],
          player2: players[j],
          status: 'Scheduled'
        });
      }
      week++;
    }

    await newLeague.save();
    console.log(`Successfully created sample league with ${users.length} players.`);

  } catch (error) {
    console.error('Error creating sample league:', error);
  } finally {
    mongoose.disconnect();
  }
};

createSampleLeague();
