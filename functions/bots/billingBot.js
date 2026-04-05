const telegramApi = require('../utils/telegramApi');
const logger = require('../utils/logger');
const leadService = require('../services/leadService');

const run = async (update, botToken) => {
    logger.info('Running billingBot features');
    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || '';

    // If user sends photo
    if (message.photo) {
        await receiveScreenshot(botToken, chatId);
        return;
    }

    if (text === 'Top up balance' || text === '/start') {
        const replyMarkup = {
            inline_keyboard: [
                [{text: "💳 By Paynet Link", url: "https://paynet.uz/paying/link_YOUR_ID_HERE"}],
                [{text: "🏦 By Card", callback_data: "card_details"}],
                [{text: "👨‍💻 Contact Admin", url: "https://t.me/MSU_Berdibekov"}]
            ]
        };
        await telegramApi.sendMessage(botToken, chatId, "Please select payment method and send a photo of the receipt once paid:", replyMarkup);
    } else if (update.callback_query && update.callback_query.data === 'card_details') {
        await telegramApi.sendMessage(botToken, chatId, "Humo Card: 8600 0000 0000 0000\nPlease send a screenshot here after payment is complete.");
    }
};

const receiveScreenshot = async (botToken, chatId) => {
    logger.info('Billing bot received payment screenshot');
    await telegramApi.sendMessage(botToken, chatId, "Screenshot added for review. Admin will approve shortly.");
};

const approvePayment = async (leaderId) => {
    logger.info(`Admin approved payment for leader ${leaderId}`);
    // Activate sub and flush leads
    await leadService.flushPendingLeads(leaderId);
};

module.exports = { run, receiveScreenshot, approvePayment };
