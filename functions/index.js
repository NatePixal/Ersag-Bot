"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const express = require("express");
const cors = require("cors");

const { db } = require("./config/db");
const env = require("./config/env");
const logger = require("./utils/logger");

const botRegistry = require("./services/botRegistryService");
const customerBot = require("./bots/customerBot");
const leaderHubBot = require("./bots/leaderHubBot");
const billingBot = require("./bots/billingBot");
const adminBot = require("./bots/adminBot");

/**
 * 🌉 THE THREE PILLARS GATEWAY
 * Standardized single entry point for ALL Telegram bots.
 * Routes based on ID/Token lookup in Firestore.
 */
exports.telegramGateway = onRequest(
    {
        secrets: ["GROQ_API_KEY"], // Add other secrets if needed
        timeoutSeconds: 60,
    },
    async (req, res) => {
        // Always acknowledge Telegram first!
        res.status(200).send("OK");

        try {
            const body = req.body;
            let botToken = null;
            let botDoc = null;

            // Resolve bot based on query parameter (?id=UUID or ?token=TOKEN)
            if (req.query.id) {
                botDoc = await botRegistry.getBotByTenantId(req.query.id);
                botToken = botDoc ? botDoc.bot_token : null;
            } else if (req.query.token) {
                botToken = req.query.token;
                botDoc = await botRegistry.getBotByToken(botToken);
            }

            if (!botToken) {
                logger.warn("telegramGateway: Missing bot resolution", { query: req.query });
                return;
            }

            const botRole = botDoc ? (botDoc.bot_type || botDoc.bot_role || 'sales') : 'sales';
            
            logger.info(`Routing to ${botRole}`, { id: req.query.id });

            // Route to the appropriate "Brain"
            switch (botRole) {
                case 'leader':
                case 'leader_hub':
                    await leaderHubBot.handleUpdate(body, botDoc, botToken);
                    break;
                case 'billing':
                    await billingBot.handleUpdate(body, botDoc, botToken);
                    break;
                case 'admin':
                    await adminBot.handleUpdate(body, botDoc, botToken);
                    break;
                default:
                    // Default is the Sales Workforce (Customer Bot)
                    await customerBot.handleUpdate(body, botDoc, botToken);
            }
        } catch (err) {
            logger.error("telegramGateway error:", err);
        }
    }
);

// Backward compatibility redirects (Optional, but safer for existing bots)
exports.customerWebhook = exports.telegramGateway;
exports.leaderWebhook = exports.telegramGateway;
exports.adminWebhook = exports.telegramGateway;

/**
 * 🌉 THE WEB BRIDGE (Mini App APIs)
 */
const apiApp = express();
apiApp.use(cors({ origin: true }));
apiApp.use(express.json());

// Mount everything directly. exports.api URL will be https://.../api/customer/...
apiApp.use("/", miniAppRouter);

exports.api = onRequest(apiApp);

/**
 * ⚙️ BACKGROUND JOBS (Schedulers)
 */
const { processAiMessage } = require("./workers/aiWorker");
exports.aiWorker = processAiMessage;

const { subscriptionJob } = require("./jobs/subscriptionJob");
const { dailyQuotaReset } = require("./jobs/resetQuotaJob");
exports.subscriptionJob = subscriptionJob;
exports.dailyQuotaReset = dailyQuotaReset;
