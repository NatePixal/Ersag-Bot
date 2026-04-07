// functions/jobs/resetQuotaJob.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require('../config/db');
const logger = require('../utils/logger');

exports.resetQuotas = onSchedule("0 0 * * *", async (event) => {
    logger.info("Resetting daily AI quotas...");
    
    const leaders = await db.collection('leaders').get();
    const batch = db.batch();

    leaders.forEach(doc => {
        const data = doc.data();
        // Reset daily usage but keep total tokens
        batch.update(doc.ref, { dailyUsage: 0 });
    });

    await batch.commit();
    logger.info("All leader quotas reset for the new day.");
});