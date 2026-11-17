require('dotenv').config();
const mongoose = require('mongoose');

async function clearData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civic_db';
    await mongoose.connect(mongoUri);
    console.log('[Clear Data] Connected to MongoDB at:', mongoUri);

    const db = mongoose.connection.db;

    // Delete all complaints
    const complaintsResult = await db.collection('complaints').deleteMany({});
    console.log(`[Clear Data] Deleted ${complaintsResult.deletedCount} complaints from 'complaints' collection.`);

    // Delete all notifications
    const notifsResult = await db.collection('notifications').deleteMany({});
    console.log(`[Clear Data] Deleted ${notifsResult.deletedCount} notifications from 'notifications' collection.`);

    console.log('[Clear Data Complete] All complaint and notification data successfully wiped. Database is now completely clean (0 records).');
    process.exit(0);
  } catch (err) {
    console.error('[Clear Data Error]:', err);
    process.exit(1);
  }
}

clearData();
