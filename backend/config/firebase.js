const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * Initialize Firebase Admin SDK using serviceAccountKey.json
 */
let firebaseApp = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(
      `[Firebase] Admin SDK initialized via env variable for project: ${serviceAccount.project_id || 'default'}`
    );
  } else {
    const candidatePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      '/etc/secrets/serviceAccountKey.json',
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(__dirname, '..', 'serviceAccountKey.json'),
      path.resolve(process.cwd(), 'backend', 'serviceAccountKey.json'),
    ].filter(Boolean);

    let serviceAccountPath = candidatePaths.find((p) => fs.existsSync(p));

    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log(
        `[Firebase] Admin SDK initialized successfully for project: ${serviceAccount.project_id || 'default'}`
      );
    } else {
      console.warn(
        `[Firebase] Warning: Service account key file not found at candidates [${candidatePaths.join(', ')}]. Authentication will fail until provided.`
      );
    }
  }
} catch (error) {
  console.error(`[Firebase] Initialization error: ${error.message}`);
}

const auth = firebaseApp ? admin.auth() : null;
const messaging = firebaseApp ? admin.messaging() : null;

module.exports = {
  admin,
  auth,
  messaging,
};
