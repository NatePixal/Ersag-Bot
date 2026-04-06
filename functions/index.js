const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const customerWebhookApp = require('./webhooks/customerWebhook');
const leaderWebhookApp = require('./webhooks/leaderWebhook');
const miniAppRouter = require('./miniapp/api');

const logger = require('./utils/logger');

logger.info('Initializing Firebase Functions (Gen 2)...');

// The Three Pillars: Fully Isolated Webhooks
exports.customerWebhook = onRequest(customerWebhookApp);
exports.leaderWebhook = onRequest(leaderWebhookApp);
// exports.adminWebhook = onRequest(adminWebhookApp);

// Background Workers
const { processAiMessage } = require('./workers/aiWorker');
exports.aiWorker = processAiMessage;

// Leader Mini App REST APIs
const apiApp = express();
apiApp.use(express.json());
apiApp.use('/api', miniAppRouter);


exports.api = onRequest(apiApp);

// Export Scheduled Jobs (Gen 2)
const { subscriptionJob } = require('./jobs/subscriptionJob');
const { dailyQuotaReset } = require('./jobs/resetQuotaJob');
exports.subscriptionJob = subscriptionJob;
exports.dailyQuotaReset = dailyQuotaReset;
