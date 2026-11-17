const mongoose = require('mongoose');

/**
 * Connect to MongoDB with connection pooling and event listeners.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/civic_db';

  try {
    const conn = await mongoose.connect(mongoURI, {
      autoIndex: true, // Automatically build indexes defined in schemas (2dsphere, compound)
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB] Initial connection error: ${error.message}`);
    // Do not crash the process immediately in development so diagnostic routes can still respond
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Connection event handlers
  mongoose.connection.on('error', (err) => {
    console.error(`[MongoDB] Runtime connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected from database. Reconnecting...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Successfully reconnected to database.');
  });
};

module.exports = connectDB;
