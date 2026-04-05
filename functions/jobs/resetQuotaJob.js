const functions = require('firebase-functions');
const quotaService = require('../services/quotaService');
const logger = require('../utils/logger');

exports.dailyQuotaReset = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    logger.info('Running background job: Resetting daily quotas');
    await quotaService.resetDailyQuota();
});
