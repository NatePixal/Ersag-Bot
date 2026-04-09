const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const express = require("express");
const cors = require("cors");

/* ===============================
   1. ENV INITIALIZATION (FIRST)
================================ */
const env = require("./config/env");
env.initEnv();

/* ===============================
   2. IMPORT GATEWAYS
================================ */
const { handleTelegramUpdate } = require("./gateway/telegramGateway");
const { handleLeaderHubUpdate } = require("./gateway/leaderHubGateway");
const { handleBillingUpdate } = require("./gateway/billingGateway");

/* ===============================
   3. SERVICES
================================ */
const { syncProductsFromSheets } = require("./services/sheetsService");

/* ===============================
   4. MINI APP ROUTES
================================ */
const miniAppRoutes = require("./miniapp/api");

/* ===============================
   5. BOT EXPRESS APP
================================ */
const botApp = express();
botApp.use(express.json());

botApp.post("/bot/:botToken", handleTelegramUpdate);
botApp.post("/leader-hub/:botToken", handleLeaderHubUpdate);
botApp.post("/billing/:botToken", handleBillingUpdate);

/* ===============================
   6. API EXPRESS APP
================================ */
const apiApp = express();
apiApp.use(cors({ origin: true }));
apiApp.use(express.json());
apiApp.use("/", miniAppRoutes);

/* ===============================
   7. SHARED SECRETS
================================ */
const secretList = [
  "GROQ_API_KEY",
  "MASTER_BOT_TOKEN",
  "ADMIN_TELEGRAM_ID"
];

/* ===============================
   8. EXPORT FUNCTIONS
================================ */
exports.botGateway = onRequest(
  { secrets: secretList, region: "us-central1" },
  botApp
);

exports.api = onRequest(
  { secrets: secretList, region: "us-central1" },
  apiApp
);

/* ===============================
   9. BACKGROUND JOBS
================================ */
const { checkSubscriptions } = require("./jobs/subscriptionJob");
const { resetQuotas } = require("./jobs/resetQuotaJob");

exports.checkSubscriptions = checkSubscriptions;
exports.resetQuotas = resetQuotas;

exports.manualSync = onSchedule("0 4 * * *", async () => {
  console.log("Starting Scheduled Sync...");

  try {
    await syncProductsFromSheets(env.GOOGLE_SHEETS_ID);
    console.log("Sync Successful!");
  } catch (error) {
    console.error("Sync Failed:", error);
  }
});

/* ===============================
   10. GLOBAL ERROR VISIBILITY
================================ */
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);