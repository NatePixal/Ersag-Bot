const telegramApi = require('../utils/telegramApi');
const logger = require('../utils/logger');
const leadService = require('../services/leadService');
const crypto = require('crypto');

const run = async (update, botToken) => {
    logger.info('Running billingBot features');
    const message = update.message;
    
    // Safety check mostly for standard messages
    if (!message && update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        if (update.callback_query.data === 'card_details') {
            await telegramApi.sendMessage(botToken, chatId, "Humo Card: 8600 0000 0000 0000\nPlease send a screenshot of the receipt here after payment is complete.");
            return;
        }
    }
    
    if (!message) return;

    const chatId = message.chat.id;
    const text = message.text || '';

    // If user sends photo (payment receipt)
    if (message.photo) {
        await receiveScreenshot(botToken, chatId);
        return;
    }

    if (text === 'Top up balance' || text === '/start') {
        const replyMarkup = {
            inline_keyboard: [
                [{text: "💳 By Paynet Link", url: "https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r0AQHPJHMYyoRFazt0202115204531153038605802UZ5910AO'PAYNET'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz6304BA67"}],
                [{text: "🏦 By Card (Direct)", callback_data: "card_details"}],
                [{text: "👨‍💻 Contact Admin", url: "https://t.me/MSU_Berdibekov"}]
            ]
        };
        await telegramApi.sendMessage(botToken, chatId, "Please select payment method and send a photo of the receipt once paid:", replyMarkup);
    }
};

const receiveScreenshot = async (botToken, chatId) => {
    logger.info('Billing bot received payment screenshot');
    await telegramApi.sendMessage(botToken, chatId, "Screenshot added for review. Admin will approve shortly.");
};

const approvePayment = async (leaderId) => {
    logger.info(`Admin approved payment for leader ${leaderId}`);
    // Generate an internal flush ID since admin overrides frontend validation
    const internalFlushId = `admin-override-${crypto.randomUUID()}`;
    await leadService.flushPendingLeads(leaderId, internalFlushId);
};

module.exports = { run, receiveScreenshot, approvePayment };
