require('dotenv').config();
const mongoose = require('mongoose');
const { auth } = require('../config/firebase');
const User = require('../models/User');

/**
 * CLI Helper: Change / Update Super Admin Email
 * Usage:
 *   node scripts/changeSuperAdminEmail.js <old_email> <new_email>
 * Example:
 *   node scripts/changeSuperAdminEmail.js commissioner@delhicivic.gov.in mynewemail@gmail.com
 */
async function changeSuperAdminEmail() {
  const oldEmail = (process.argv[2] || '').trim().toLowerCase();
  const newEmail = (process.argv[3] || '').trim().toLowerCase();

  console.log('=====================================================');
  console.log('   Civic Municipal Platform - Change Super Admin Email');
  console.log('=====================================================');

  if (!oldEmail || !newEmail) {
    console.error('\n[Error] Both old email and new email are required.');
    console.log('Usage:');
    console.log('  node scripts/changeSuperAdminEmail.js <old_email> <new_email>\n');
    console.log('Example:');
    console.log('  node scripts/changeSuperAdminEmail.js commissioner@delhicivic.gov.in mynewemail@gmail.com\n');
    process.exit(1);
  }

  if (!auth) {
    console.error('\n[Error] Firebase Admin Auth is not initialized. Check serviceAccountKey.json.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civic_db';
  await mongoose.connect(mongoUri);
  console.log('[Connected] MongoDB connected successfully.');

  try {
    // 1. Fetch user from Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(oldEmail);
      console.log(`[Found] Firebase account found for: ${oldEmail} (UID: ${userRecord.uid})`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.error(`\n[Error] No Firebase account exists with old email: "${oldEmail}".`);
        process.exit(1);
      }
      throw err;
    }

    // 2. Update email in Firebase Auth
    await auth.updateUser(userRecord.uid, {
      email: newEmail,
      emailVerified: true,
    });
    console.log(`[Success] Firebase Auth email updated: ${oldEmail} -> ${newEmail}`);

    // 3. Update email in MongoDB User collection
    const updatedMongoUser = await User.findOneAndUpdate(
      { firebaseUid: userRecord.uid },
      { email: newEmail, role: 'super_admin' },
      { new: true }
    );
    console.log(`[Success] MongoDB User record updated for UID: ${userRecord.uid}`);

    console.log('\n---------------- Updated Profile ----------------');
    console.log(`  Old Email: ${oldEmail}`);
    console.log(`  New Email: ${newEmail}`);
    console.log(`  Role:      super_admin`);
    console.log(`  UID:       ${userRecord.uid}`);
    console.log('-------------------------------------------------');
    console.log('\n[Ready] You can now sign in using the new email with your existing password!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n[Fatal Error] Failed to update email:');
    console.error(error.message || error);
    process.exit(1);
  }
}

changeSuperAdminEmail();
