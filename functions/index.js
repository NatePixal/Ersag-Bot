const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const express = require('express');
const cors = require('cors');

// 1. Core Logic Imports
const { handleTelegramUpdate } = require('./gateway/telegramGateway');
const { syncProductsFromSheets } = require('./services/sheetsService');
const miniAppRoutes = require('./miniapp/api');
const env = require('./config/env');

// 2. Setup Express Apps
const botApp = express();
botApp.use(express.json());
botApp.post('/:botToken', handleTelegramUpdate);

const apiApp = express();
apiApp.use(cors({ origin: true }));
apiApp.use(express.json());
apiApp.use('/', miniAppRoutes);

// 3. EXPORTS (These define what appears in your Google Cloud Console)

// The Bots
exports.botGateway = onRequest({ 
    secrets: ["GROQ_API_KEY", "MASTER_BOT_TOKEN", "ADMIN_TELEGRAM_ID"] 
}, botApp);

// The Mini App
exports.api = onRequest({ 
    secrets: ["GROQ_API_KEY", "MASTER_BOT_TOKEN", "ADMIN_TELEGRAM_ID"] 
}, apiApp);

// The Jobs (Importing them directly to ensure they are seen)
const { checkSubscriptions } = require('./jobs/subscriptionJob');
const { resetQuotas } = require('./jobs/resetQuotaJob');

exports.checkSubscriptions = checkSubscriptions;
exports.resetQuotas = resetQuotas;

// The Manual Sync
exports.manualSync = onSchedule("0 4 * * *", async (event) => {
    console.log("Manual Sync Triggered");
    try {
        await syncProductsFromSheets(env.GOOGLE_SHEETS_ID);
        console.log("Sync Successful");
    } catch (error) {
        console.error("Sync Failed:", error);
    }
});