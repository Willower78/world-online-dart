const mongoose = require('mongoose');
const League = require('../models/League');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const createLeagues = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected...');

    const admin = await User.findOne({ isAdmin: true });
    if (!admin) {
        console.log("No admin found. Please run make-admin.js first or ensure a user exists.");
        process.exit(1);
    }

    const leagues = [
        {
            name: "Premier League",
            region: "Scandinavian",
            maxPlayersPerDivision: 10,
            entryFeeEuros: 10,
            perGameFeeSilverStars: 5,
            status: "Recruiting",
            divisions: [
                { divisionNumber: 1, players: [], standings: [], schedule: [] },
                { divisionNumber: 2, players: [], standings: [], schedule: [] }
            ]
        },
        {
            name: "Amateur League",
            region: "Scandinavian",
            maxPlayersPerDivision: 20,
            entryFeeEuros: 5,
            perGameFeeSilverStars: 2,
            status: "Recruiting",
            divisions: [
                { divisionNumber: 1, players: [], standings: [], schedule: [] }
            ]
        }
    ];

    // Clear existing leagues? Maybe not, just add if missing.
    // User said "I cant find the leagues", implying there are none.
    
    for (const data of leagues) {
        const exists = await League.findOne({ name: data.name });
        if (!exists) {
            const league = new League({
                ...data,
                createdBy: admin._id
            });
            await league.save();
            console.log(`Created league: ${league.name}`);
        } else {
            console.log(`League already exists: ${data.name}`);
        }
    }

    console.log('Leagues seeded successfully.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

createLeagues();
