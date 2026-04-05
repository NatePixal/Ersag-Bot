const admin = require('firebase-admin');

// Prevent multiple initializations in Firebase Functions
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

module.exports = { admin, db };
