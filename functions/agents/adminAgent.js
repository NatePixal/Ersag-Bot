const telegramApi = require('../utils/telegramApi');
const leadService = require('../services/leadService');
const billingBot = require('../bots/billingBot');
const logger = require('../utils/logger');
const crypto = require('crypto');
const env = require('../config/env');

const run = async (update, botToken) => {
    logger.info('Running adminAgent');
    const message = update.message;
    if (!message) return;

    const chatId = message.chat.id;
    const text = (message.text || '').trim();

    // Security double-check — only the admin can use this
    if (String(chatId) !== String(env.ADMIN_CHAT_ID)) {
        await telegramApi.sendMessage(botToken, chatId, "⛔ Ruxsat yo'q.");
        return;
    }

    // /approve <leader_id>
    if (text.startsWith('/approve')) {
        const parts = text.split(' ');
        const leaderId = parts[1];
        if (!leaderId) {
            await telegramApi.sendMessage(botToken, chatId, "⚠️ Format: /approve <leader_id>");
            return;
        }
        try {
            await billingBot.approvePayment(leaderId);
            await telegramApi.sendMessage(botToken, chatId, `✅ Leader ${leaderId} uchun leadlar yuborildi.`);
        } catch (err) {
            await telegramApi.sendMessage(botToken, chatId, `❌ Xatolik: ${err.message}`);
        }
        return;
    }

    // /stats — show pending leads summary
    if (text === '/stats') {
        try {
            const { db } = require('../config/db');
            const snap = await db.collection('leads').where('status', '==', 'pending').get();
            await telegramApi.sendMessage(botToken, chatId, `📊 Hozirda ${snap.size} ta pending lead mavjud.`);
        } catch (err) {
            await telegramApi.sendMessage(botToken, chatId, `❌ Stats xatolik: ${err.message}`);
        }
        return;
    }

    // Default admin help menu
    await telegramApi.sendMessage(botToken, chatId,
        "👤 Admin Panel\n\n" +
        "/approve <leader_id> — Leadlarni tasdiqlash\n" +
        "/stats — Pending leadlar soni"
    );
};

module.exports = { run };
