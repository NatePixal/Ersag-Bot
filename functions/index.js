const functions = require('firebase-functions');
const { onRequest } = require("firebase-functions/v2/https"); // <-- Gen 2 Import added here
const express = require('express');
const { handleTelegramUpdate } = require('./gateway/telegramGateway');
const miniAppRouter = require('./miniapp/api');

const logger = require('./utils/logger');

logger.info('Initializing Firebase Functions Layered Architecture...');

// Telegram Bot Webhook Gateway
const botApp = express();
botApp.use(express.json());
botApp.post('/webhook/:botToken', handleTelegramUpdate);

// Leader Mini App REST APIs
const apiApp = express();
apiApp.use(express.json());
apiApp.use('/api', miniAppRouter);

// Export Functions (Using Gen 2 syntax for the secret)
exports.botGateway = onRequest({ secrets: ["GROQ_API_KEY"] }, botApp);
exports.api = functions.https.onRequest(apiApp);

// Scheduled Jobs
const { checkSubscriptions } = require('./jobs/subscriptionJob');
exports.checkSubscriptions = checkSubscriptions;

const { resetQuotas } = require('./jobs/resetQuotaJob');
exports.resetQuotas = resetQuotas;