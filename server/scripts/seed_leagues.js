const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const League = require('../models/League');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const leaguesToSeed = [
  {
    name: 'WOD Scandinavian League',
    region: 'Scandinavian',
    themeColor: '#006aa7', // Blue
    entryFeeEuros: 10,
    divisions: [] 
  },
  {
    name: 'WOD UK League',
    region: 'British',
    themeColor: '#c8102e', // Red
    entryFeeEuros: 10,
    divisions: []
  },
  {
    name: 'WOD Dutch League',
    region: 'Dutch',
    themeColor: '#f37820', // Orange
    entryFeeEuros: 10,
    divisions: []
  },
  {
    name: 'WOD German League',
    region: 'German',
    themeColor: '#000000', // Black (or #FFCE00 for Gold/Yellow)
    entryFeeEuros: 10,
    divisions: []
  },
  {
    name: 'WOD USA League',
    region: 'American',
    themeColor: '#3c3b6e', // Navy
    entryFeeEuros: 10,
    divisions: []
  }
];

const seedLeagues = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/world-online-dart'; // Fallback
    console.log(`Connecting to DB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.');

    for (const leagueData of leaguesToSeed) {
      const existing = await League.findOne({ name: leagueData.name });
      if (existing) {
        console.log(`League "${leagueData.name}" already exists. Skipping.`);
        // Optional: Update color if missing
        if (!existing.themeColor) {
            existing.themeColor = leagueData.themeColor;
            await existing.save();
            console.log(`-> Updated themeColor for "${leagueData.name}"`);
        }
      } else {
        await League.create(leagueData);
        console.log(`League "${leagueData.name}" created.`);
      }
    }

    console.log('Seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding leagues:', error);
    process.exit(1);
  }
};

seedLeagues();
