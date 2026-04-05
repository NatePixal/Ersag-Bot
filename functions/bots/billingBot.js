const telegramApi = require('../utils/telegramApi');
const logger = require('../utils/logger');
const leadService = require('../services/leadService');
const subscriptionService = require('../services/subscriptionService');
const env = require('../config/env');
const crypto = require('crypto');

const run = async (update, botToken) => {
    logger.info('Running billingBot features');
    const message = update.message;
    
    if (!message && update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        if (update.callback_query.data === 'card_details') {
            await telegramApi.sendMessage(botToken, chatId,
                "🏦 *Karta ma'lumotlari:*\n\n" +
                "`8600 3300 0790 6762`\n\n" +
                "To'lov qilganingizdan so'ng *chek rasmini* shu yerga yuboring. Admin tasdiqlaydi."
            );
            return;
        }
    }
    
    if (!message) return;

    const chatId = message.chat.id;
    const userId = String(message.from.id);
    const text = message.text || '';

    // If user sends photo (payment receipt) → forward to admin group
    if (message.photo) {
        await receiveScreenshot(botToken, chatId, userId, message);
        return;
    }

    if (text === 'Top up balance' || text === '/billing' || text === '/start') {
        // Check current subscription status for context
        const subState = await subscriptionService.checkLeaderAccess(userId);
        const statusNote = subState.status === 'active'
            ? "✅ Obunangiz hozir faol."
            : subState.status === 'grace'
            ? "⚠️ Obunangiz tugayapti. Davom ettirish uchun to'lang."
            : "❌ Obunangiz tugagan. Botni qayta yoqish uchun to'lang.";

        const replyMarkup = {
            inline_keyboard: [
                [{ text: "💳 Paynet orqali To'lash", url: "https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r0AQHPJHMYyoRFazt0202115204531153038605802UZ5910AO'PAYNET'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz6304BA67" }],
                [{ text: "🏦 Karta orqali To'lash", callback_data: "card_details" }],
                [{ text: "👨‍💻 Admin bilan bog'lanish", url: "https://t.me/MSU_Berdibekov" }]
            ]
        };
        await telegramApi.sendMessage(botToken, chatId,
            `💳 *Obuna To'lovi*\n\n` +
            `${statusNote}\n\n` +
            `📦 Tarif: *1 oy — 99,000 UZS*\n` +
            `Includes: Cheksiz lead qabul qilish + AI konsultant + CRM\n\n` +
            `To'lov qilganingizdan so'ng *chek rasmini* shu yerga yuboring 📸`,
            replyMarkup
        );
    }
};

const receiveScreenshot = async (botToken, chatId, userId, message) => {
    logger.info(`[Billing] Receipt from leader ${userId}`);

    // Confirm to the leader
    await telegramApi.sendMessage(botToken, chatId,
        "✅ Chek qabul qilindi! Admin tomonidan *24 soat* ichida tasdiqlanadi.\n\n" +
        "Savol bo'lsa: @MSU_Berdibekov"
    );

    // Forward to admin group with pre-filled approve command
    if (env.ADMIN_GROUP_ID && env.MASTER_BOT_TOKEN) {
        const fileId = message.photo[message.photo.length - 1].file_id;
        
        // Send caption with pre-filled approve command
        const caption =
            `📥 *Yangi to'lov cheki!*\n\n` +
            `👤 Leader ID: \`${userId}\`\n` +
            `📛 Ismi: ${message.from.first_name || '?'} ${message.from.last_name || ''}\n` +
            `⏰ ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}\n\n` +
            `✅ Tasdiqlash uchun:\n/approve ${userId}`;

        // Forward the photo to admin group
        await fetch(`https://api.telegram.org/bot${env.MASTER_BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: env.ADMIN_GROUP_ID,
                photo: fileId,
                caption,
                parse_mode: 'Markdown'
            })
        });
        logger.info(`[Billing] Forwarded receipt to admin group ${env.ADMIN_GROUP_ID}`);
    }
};

const approvePayment = async (leaderId) => {
    logger.info(`[Billing] Admin approved payment for leader ${leaderId}`);
    const internalFlushId = `admin-override-${crypto.randomUUID()}`;
    await leadService.flushPendingLeads(leaderId, internalFlushId);
};

module.exports = { run, receiveScreenshot, approvePayment };

