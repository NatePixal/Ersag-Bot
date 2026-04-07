// functions/jobs/subscriptionJob.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require('../config/db');
const logger = require('../utils/logger');

exports.checkSubscriptions = onSchedule("0 0 * * *", async (event) => {
    logger.info("Running daily subscription check...");
    const now = new Date();
    
    const expiredLeaders = await db.collection('leaders')
        .where('expiryDate', '<', now)
        .where('account_status', '==', 'active')
        .get();

    const batch = db.batch();
    expiredLeaders.forEach(doc => {
        batch.update(doc.ref, { account_status: 'expired' });
    });

    await batch.commit();
    logger.info(`Deactivated ${expiredLeaders.size} expired subscriptions.`);
});