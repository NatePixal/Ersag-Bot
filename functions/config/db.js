// functions/config/db.js
const admin = require('firebase-admin');

// Initialize only once
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Helpful shortcut for timestamps
const Timestamp = admin.firestore.Timestamp;

module.exports = { db, admin, Timestamp };