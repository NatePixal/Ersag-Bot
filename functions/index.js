const functions = require('firebase-functions');
const express = require('express');
const { handleTelegramUpdate } = require('./gateway/telegramGateway');
// const miniAppRouter = require('./miniapp/api');

const logger = require('./utils/logger');

logger.info('Initializing Firebase Functions Layered Architecture...');

// Telegram Bot Webhook Gateway
const botApp = express();
botApp.use(express.json());
botApp.post('/webhook/:botToken', handleTelegramUpdate);

// Leader Mini App REST APIs
const apiApp = express();
apiApp.use(express.json());
// apiApp.use('/', miniAppRouter);

// Export Functions
exports.botGateway = functions.https.onRequest(botApp);
exports.api = functions.https.onRequest(apiApp);
