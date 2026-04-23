const mongoose = require('mongoose');
const League = require('../models/League');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        const uri = "mongodb+srv://dart_user:WilliamMh12013@cluster0.wskxny1.mongodb.net/world-online-dart?retryWrites=true&w=majority&appName=Cluster0";
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const seedLeagues = async () => {
    await connectDB();

    try {
        // Find a user to assign as creator (admin)
        const adminUser = await User.findOne();
        if (!adminUser) {
            console.log('No users found. Please create a user first.');
            process.exit(1);
        }

        const leagues = [
            {
                name: 'Scandinavian Pro League',
                region: 'Scandinavian',
                status: 'Recruiting',
                entryFeeEuros: 10,
                perGameFeeSilverStars: 1,
                seasonLengthWeeks: 10,
                createdBy: adminUser._id
            },
            {
                name: 'UK Premier Darts',
                region: 'British',
                status: 'Recruiting',
                entryFeeEuros: 15,
                perGameFeeSilverStars: 2,
                seasonLengthWeeks: 12,
                createdBy: adminUser._id
            },
            {
                name: 'German Masters',
                region: 'German',
                status: 'Recruiting',
                entryFeeEuros: 12,
                perGameFeeSilverStars: 1,
                seasonLengthWeeks: 8,
                createdBy: adminUser._id
            },
            {
                name: 'Asian Darts Championship',
                region: 'Asian',
                status: 'InProgress',
                entryFeeEuros: 20,
                perGameFeeSilverStars: 5,
                seasonLengthWeeks: 15,
                createdBy: adminUser._id
            }
        ];

        // Clear existing leagues? Maybe not, just add if empty.
        // Or upsert. Let's just delete all and re-seed for clean state.
        await League.deleteMany({});
        console.log('Cleared existing leagues.');

        await League.insertMany(leagues);
        console.log('Leagues seeded successfully!');

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
};

seedLeagues();
