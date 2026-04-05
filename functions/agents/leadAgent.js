const telegramApi = require('../utils/telegramApi');
const aiService = require('./aiService');
const logger = require('../utils/logger');

const run = async (update, botToken) => {
    logger.info('Running leadAgent');
    const message = update.message;
    const callbackQuery = update.callback_query;
    const chatId = message ? message.chat.id : callbackQuery.message.chat.id;
    
    if (callbackQuery && callbackQuery.data.startsWith('lang_')) {
        // Save lang choice logic goes here
        // Then send main menu
        await sendMainMenu(botToken, chatId, callbackQuery.data.split('_')[1]);
        return;
    }

    const text = message ? message.text : '';

    // Handle standard static buttons first
    if (['Ersag Portal', 'Katalog', 'VIP group', 'Admin bilan aloqa', 'Ulashish', "Go'zallik", "Sog'liq", 'Tozalash', 'Bepul konsultatsiya', 'Ro\'yxatdan o\'tish'].includes(text)) {
        await handleMenuAction(botToken, chatId, text);
        return;
    }

    // Default AI behavior if not clicking a standard menu
    const messages = [{ role: "user", content: text }];
    const systemPrompt = "You are a friendly lead generation assistant for ERSAG. Your goal is to collect their name and phone number. Ask them to press 'Bepul konsultatsiya' or 'Ro\'yxatdan o\'tish' from the menu.";
    const response = await aiService.callLLM(messages, systemPrompt);
    
    await telegramApi.sendMessage(botToken, chatId, response);
};

const sendMainMenu = async (botToken, chatId, lang) => {
    // As specified: Ersag portal, katalog, vip group, contact of the admin, share contact, beauty, health, cleaning, free consultation, register
    const replyMarkup = {
        keyboard: [
            [{text: "Ersag Portal"}, {text: "Katalog"}],
            [{text: "Go'zallik"}, {text: "Sog'liq"}, {text: "Tozalash"}],
            [{text: "VIP group"}, {text: "Bepul konsultatsiya"}, {text: "Ro'yxatdan o'tish"}],
            [{text: "Admin bilan aloqa", url: "https://t.me/MSU_Berdibekov"}, {text: "Ulashish", request_contact: true}]
        ],
        resize_keyboard: true
    };
    await telegramApi.sendMessage(botToken, chatId, "Asosiy menyu / Главное меню:", replyMarkup);
};

const handleMenuAction = async (botToken, chatId, option) => {
    switch (option) {
        case 'Ersag Portal':
            await telegramApi.sendMessage(botToken, chatId, "Ersag portaliga kirish uchun web-app tugmasini bosing.");
            break;
        case 'Katalog':
            await telegramApi.sendMessage(botToken, chatId, "Barcha mahsulotlar bu yerda: 👉 Katalog");
            break;
        case 'Admin bilan aloqa':
            await telegramApi.sendMessage(botToken, chatId, "Admin bilan bog'lanish uchun: @MSU_Berdibekov");
            break;
        case 'Ro\'yxatdan o\'tish':
            await telegramApi.sendMessage(botToken, chatId, "A'zo bo'lish bepul va 20% chegirma beradi! Saytdan foydalaning.");
            break;
        default:
            await telegramApi.sendMessage(botToken, chatId, "Tanlovingiz qabul qilindi.");
            break;
    }
};

module.exports = { run };
