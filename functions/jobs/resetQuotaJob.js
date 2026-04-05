const { onSchedule } = require('firebase-functions/v2/scheduler');
const quotaService = require('../services/quotaService');
const logger = require('../utils/logger');

exports.dailyQuotaReset = onSchedule('every 24 hours', async (event) => {
    logger.info('Running background job: Resetting daily quotas');
    await quotaService.resetDailyQuota();
});
