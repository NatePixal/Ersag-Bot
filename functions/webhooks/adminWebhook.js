const express = require('express');
const logger = require('../utils/logger');
const telegramApi = require('../utils/telegramApi');
const env = require('../config/env');
const { db } = require('../config/db');
const subscriptionService = require('../services/subscriptionService');
const leadService = require('../services/leadService');
const notificationService = require('../services/notificationService');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/**
 * 🛡️ Pillar 3: System Control (adminWebhook)
 * Private command center for the Platform Owner to manage billing.
 */
app.post('/', async (req, res) => {
    res.status(200).send("OK");

    try {
        const body = req.body;
        if (!body.callback_query) return;

        const cq = body.callback_query;
        const data = cq.data;
        const adminChatId = cq.message.chat.id;
        const messageId = cq.message.message_id;

        const ADMIN_TOKEN = env.ADMIN_BOT_TOKEN || env.MASTER_BOT_TOKEN;
        const MASTER_BOT_TOKEN = env.MASTER_BOT_TOKEN;

        // Acknowledge the callback
        await telegramApi.answerCallbackQuery(ADMIN_TOKEN, cq.id);

        // --- PAYMENT APPROVAL: "The Flush" Protocol ---
        if (data.startsWith("approve_")) {
            const leaderId = data.replace("approve_", "");
            
            // 1. Activate Subscription (Pillar 3 logic: Auto-extend by 30 days)
            const newExpiry = await subscriptionService.activateSubscription(leaderId);
            
            // update Admin UI
            await telegramApi.editMessageText(ADMIN_TOKEN, adminChatId, messageId, 
                `✅ Tasdiqlandi!\nLeader (ID: ${leaderId}) obunasi faollashdi.\nTugash sanasi: ${newExpiry.toLocaleDateString('uz-UZ')}`);

            // 2. Notify the Leader via Master Bot
            await telegramApi.sendMessage(MASTER_BOT_TOKEN, leaderId, 
                `🎉 *Tabriklaymiz!* To'lovingiz tasdiqlandi.\n\n` +
                `Obuna muddati: *${newExpiry.toLocaleDateString('uz-UZ')}* gacha uzaytirildi.\n` +
                `Barcha qulflangan leadlar hozir guruhingizga yuboriladi! 🚀`);

            // 3. "THE FLUSH": Empty the pending vault directly into their group
            const pendingLeads = await leadService.getPendingLeads(leaderId);
            
            if (pendingLeads.length > 0) {
                const flushId = `flush-${leaderId}-${crypto.randomUUID().slice(0,8)}`;
                
                // Update database states in transaction
                await leadService.flushPendingLeads(leaderId, flushId);
                
                // Send captured leads to the leader's group
                for (const lead of pendingLeads) {
                    await notificationService.notifyLeaderNewLead(MASTER_BOT_TOKEN, leaderId, lead);
                }
                
                logger.info(`[Admin] Flushed ${pendingLeads.length} leads for leader ${leaderId}`);
            }
            return;
        }

        // --- PAYMENT REJECTION ---
        if (data.startsWith("reject_")) {
            const leaderId = data.replace("reject_", "");
            
            await telegramApi.editMessageText(ADMIN_TOKEN, adminChatId, messageId, `❌ To'lov rad etildi (Leader ID: ${leaderId}).`);
            
            await telegramApi.sendMessage(MASTER_BOT_TOKEN, leaderId, 
                `❌ Siz yuborgan to'lov cheki rad etildi.\n\nIltimos, qayta yuboring yoki admin bilan bog'laning: @MSU_Berdibekov`);
            return;
        }

    } catch (e) {
        logger.error("adminWebhook execution error:", e);
    }
});

module.exports = app;
