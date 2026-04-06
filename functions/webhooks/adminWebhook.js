const express = require('express');
const logger = require('../utils/logger');
const telegramApi = require('../utils/telegramApi');
const env = require('../config/env');
const { db } = require('../config/db');

const app = express();
app.use(express.json());

// Admin Webhook catches operations for the Master Admin panel.
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
        const LEADER_TOKEN = env.MASTER_BOT_TOKEN; // To notify the leader

        // Acknowledge the callback immediately
        await telegramApi.answerCallbackQuery(ADMIN_TOKEN, cq.id);

        // --- PAYMENT APPROVAL PIPELINE ---
        if (data.startsWith("approve_")) {
            const paymentId = data.replace("approve_", "");
            const paymentRef = db.collection("payments").doc(paymentId);
            const paymentSnap = await paymentRef.get();
            
            if (!paymentSnap.exists) {
                return telegramApi.sendMessage(ADMIN_TOKEN, adminChatId, "❌ Diqqat: Bu to'lov topilmadi yoki o'chirilgan.");
            }
            
            const paymentData = paymentSnap.data();
            const leaderId = paymentData.leader_id;

            // 1. Activate Subscription (Add 30 Days)
            const now = new Date();
            const ms30 = 30 * 24 * 60 * 60 * 1000;
            const newExpiry = new Date(now.getTime() + ms30);

            await db.collection("leaders").doc(leaderId).update({
                subscription_active: true,
                expiry_date: newExpiry.toISOString()
            });
            await paymentRef.update({ status: "approved" });

            // Remove buttons from Admin's message to prevent double-clicks
            await telegramApi.editMessageText(ADMIN_TOKEN, adminChatId, messageId, `✅ Tasdiqlandi!\nLeader (ID: ${leaderId}) obunasi 30 kunga faollashdi.`);

            // 2. Notify the Leader via the Leader Bot
            const leaderDoc = await db.collection("leaders").doc(leaderId).get();
            const leaderData = leaderDoc.data();
            
            if (leaderData && leaderData.telegram_id) {
                await telegramApi.sendMessage(LEADER_TOKEN, leaderData.telegram_id, `🎉 Tabriklaymiz! To'lovingiz tasdiqlandi. Boshqaruv paneli orqali barcha qulayliklardan foydalanishingiz mumkin.`);
            }

            // 3. THE FLUSH: Empty the pending_leads Dam directly into their group/bot
            const pendingRef = await db.collection("pending_leads").where("leader_code", "==", leaderId).get();
            
            if (!pendingRef.empty && leaderData.admin_group_id) {
                let flushMsg = `🚨 *YANGI LEADLAR (KUTISH ZALIDAN)*\n\n`;
                const batch = db.batch();
                
                pendingRef.forEach(doc => {
                    const l = doc.data();
                    const phoneFormatted = l.phone ? l.phone : "Noma'lum raqam";
                    flushMsg += `👤 Ism: ${l.firstName || 'Mijoz'}\n📞 Telefon: ${phoneFormatted}\n\n`;
                    batch.delete(doc.ref); // Schedule deletion from pending vault
                });

                // Send the collected leads to the Leader's Group!
                await telegramApi.sendMessage(LEADER_TOKEN, leaderData.admin_group_id, flushMsg);
                await batch.commit(); // Execute deletion
            }
            return;
        }

        // --- PAYMENT REJECTION LOGIC ---
        if (data.startsWith("reject_")) {
            const paymentId = data.replace("reject_", "");
            await db.collection("payments").doc(paymentId).update({ status: "rejected" });
            
            // Remove buttons from Admin's message
            await telegramApi.editMessageText(ADMIN_TOKEN, adminChatId, messageId, `❌ To'lov rad etildi.`);
            
            // Notify the leader
            const paymentSnap = await db.collection("payments").doc(paymentId).get();
            if (paymentSnap.exists) {
                const pData = paymentSnap.data();
                await telegramApi.sendMessage(LEADER_TOKEN, pData.leader_id, `❌ Siz yuborgan to'lov cheki administrator tomonidan rad etildi. Iltimos qayta urinib ko'ring yoki murojaat qiling.`);
            }
            return;
        }

    } catch (e) {
        logger.error("adminWebhook execution error:", e);
    }
});

module.exports = app;
