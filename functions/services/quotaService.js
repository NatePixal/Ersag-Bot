const { db } = require('../config/db');

const checkQuota = async (leaderId) => {
    const doc = await db.collection('quotas').doc(leaderId).get();
    if (!doc.exists) return true; // Default allow, or set to false to require purchase
    const data = doc.data();
    return data.used < data.limit;
};

const incrementUsage = async (leaderId) => {
    const docRef = db.collection('quotas').doc(leaderId);
    const doc = await docRef.get();
    if (!doc.exists) {
        await docRef.set({ used: 1, limit: 100, last_reset: new Date().toISOString() });
    } else {
        await docRef.update({ used: doc.data().used + 1 });
    }
};

const resetDailyQuota = async () => {
    const quotas = await db.collection('quotas').get();
    const batch = db.batch();
    quotas.forEach(doc => {
        batch.update(doc.ref, { used: 0, last_reset: new Date().toISOString() });
    });
    await batch.commit();
};

module.exports = { checkQuota, incrementUsage, resetDailyQuota };
