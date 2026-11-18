require('dotenv').config();
const dns = require('dns');
// Set public DNS servers to resolve MongoDB Atlas SRV records on networks/ISPs with querySrv issues
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const mongoose = require('mongoose');
const { admin, auth } = require('../config/firebase');
const User = require('../models/User');

/**
 * CLI Helper: First Super Admin Bootstrapper
 * Usage:
 *   node scripts/initSuperAdmin.js <email> [optional_password]
 * Example:
 *   node scripts/initSuperAdmin.js admin@municipal.gov.in SecurePassword@2026
 */
async function initSuperAdmin() {
  const targetEmail = (process.argv[2] || process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const initialPassword = process.argv[3] || 'CivicAdmin@2026';

  console.log('=====================================================');
  console.log('   Civic Municipal Platform - Super Admin Bootstrapper');
  console.log('=====================================================');

  if (!targetEmail) {
    console.error('\n[Error] Target email is required.');
    console.log('Usage:');
    console.log('  node scripts/initSuperAdmin.js <email> [optional_password]\n');
    process.exit(1);
  }

  if (!auth) {
    console.error('\n[Error] Firebase Admin Auth is uninitialized. Check backend/serviceAccountKey.json.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civic_db';
  await mongoose.connect(mongoUri);
  console.log('[Connected] MongoDB connected successfully.');

  try {
    let userRecord;

    try {
      userRecord = await auth.getUserByEmail(targetEmail);
      console.log(`[Found] Existing Firebase user record for: ${targetEmail} (UID: ${userRecord.uid})`);
      // Ensure account is enabled and password is set to initialPassword
      await auth.updateUser(userRecord.uid, { disabled: false, password: initialPassword });
      console.log(`[Updated] Password and active state updated for: ${targetEmail}`);
    } catch (lookupErr) {
      if (lookupErr.code === 'auth/user-not-found') {
        console.log(`[Creating] User "${targetEmail}" not found in Firebase. Creating account...`);
        userRecord = await auth.createUser({
          email: targetEmail,
          password: initialPassword,
          displayName: 'Municipal Super Admin',
          emailVerified: true,
        });
        console.log(`[Created] Super Admin account created with password: ${initialPassword}`);
      } else {
        throw lookupErr;
      }
    }

    // 1. Set Custom Claims in Firebase Auth
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'super_admin',
    });
    console.log(`[Success] Applied Firebase custom claim: { role: 'super_admin' }`);

    // 2. Synchronize / Upsert into MongoDB User Collection
    const mongoUser = await User.findOneAndUpdate(
      { firebaseUid: userRecord.uid },
      {
        firebaseUid: userRecord.uid,
        email: targetEmail,
        name: userRecord.displayName || 'Municipal Super Admin',
        role: 'super_admin',
        isActive: true,
        isOnLeave: false,
      },
      { upsert: true, new: true }
    );
    console.log(`[Success] Synced MongoDB User document (ID: ${mongoUser._id})`);

    console.log('\n---------------- Verified Account Profile ----------------');
    console.log(`  Email:  ${targetEmail}`);
    console.log(`  UID:    ${userRecord.uid}`);
    console.log(`  Role:   super_admin`);
    console.log(`  Status: Active`);
    console.log('----------------------------------------------------------');
    console.log('\n[Ready] You can now sign in with this account into the Admin Portal.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n[Fatal Error] Failed to bootstrap Super Admin account:');
    console.error(error.message || error);
    process.exit(1);
  }
}

initSuperAdmin();
