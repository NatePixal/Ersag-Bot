const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const { handleTelegramUpdate } = require('./gateway/telegramGateway');
const miniAppRouter = require('./miniapp/api');

const logger = require('./utils/logger');

logger.info('Initializing Firebase Functions (Gen 2)...');

// Telegram Bot Webhook Gateway
const botApp = express();
botApp.use(express.json());
botApp.post('/webhook/:botToken', handleTelegramUpdate);

// Leader Mini App REST APIs
const apiApp = express();
apiApp.use(express.json());
apiApp.use('/api', miniAppRouter);

// Export HTTP Functions (Gen 2)
exports.botGateway = onRequest(botApp);
exports.api = onRequest(apiApp);

// Export Scheduled Jobs (Gen 2)
const { subscriptionJob } = require('./jobs/subscriptionJob');
const { dailyQuotaReset } = require('./jobs/resetQuotaJob');
exports.subscriptionJob = subscriptionJob;
exports.dailyQuotaReset = dailyQuotaReset;
