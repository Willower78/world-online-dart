// server/config/db.js
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const connectDB = async () => {
  console.log('Attempting to connect to MongoDB with URI:', process.env.MONGO_URI);
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB Ansluten: ${conn.connection.host}`);
};

module.exports = connectDB;