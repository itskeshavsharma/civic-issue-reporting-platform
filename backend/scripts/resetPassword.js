require('dotenv').config();
const { auth } = require('../config/firebase');

/**
 * CLI Helper: Change / Reset Password for Any Account
 * Usage:
 *   node scripts/resetPassword.js <email> <new_password>
 * Example:
 *   node scripts/resetPassword.js commissioner@delhicivic.gov.in NewPassword@2026
 */
async function resetPassword() {
  const targetEmail = (process.argv[2] || '').trim().toLowerCase();
  const newPassword = process.argv[3] || '';

  console.log('=====================================================');
  console.log('   Civic Municipal Platform - Password Reset Tool');
  console.log('=====================================================');

  if (!targetEmail || !newPassword) {
    console.error('\n[Error] Both email and new password are required.');
    console.log('Usage:');
    console.log('  node scripts/resetPassword.js <email> <new_password>\n');
    console.log('Example:');
    console.log('  node scripts/resetPassword.js commissioner@delhicivic.gov.in NewPassword@2026\n');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('\n[Error] Password must be at least 6 characters long.');
    process.exit(1);
  }

  if (!auth) {
    console.error('\n[Error] Firebase Admin Auth is not initialized. Check serviceAccountKey.json.');
    process.exit(1);
  }

  try {
    const userRecord = await auth.getUserByEmail(targetEmail);
    console.log(`[Found] User account found: ${targetEmail} (UID: ${userRecord.uid})`);

    await auth.updateUser(userRecord.uid, {
      password: newPassword,
      disabled: false,
    });

    console.log(`[Success] Password successfully updated for: ${targetEmail}`);
    console.log('\n---------------- Summary ----------------');
    console.log(`  Account:      ${targetEmail}`);
    console.log(`  New Password: ${newPassword}`);
    console.log(`  Status:       Active`);
    console.log('-----------------------------------------');
    console.log('\n[Ready] You can now sign in with your new password!\n');
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`\n[Error] No account found with email: "${targetEmail}".`);
    } else {
      console.error('\n[Fatal Error] Failed to update password:');
      console.error(error.message || error);
    }
    process.exit(1);
  }
}

resetPassword();
