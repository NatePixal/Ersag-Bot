const telegramApi = require('../utils/telegramApi');
const aiService = require('./aiService');
const logger = require('../utils/logger');
const customerService = require('../services/customerService');
const leadService = require('../services/leadService'); // To capture leads when contact is shared

const run = async (update, botToken) => {
    logger.info('Running leadAgent');
    const message = update.message;
    const callbackQuery = update.callback_query;
    
    // Safety check
    if (!message && !callbackQuery) return;

    const chatId = message ? message.chat.id : callbackQuery.message.chat.id;
    const telegramUserId = message ? message.from.id : callbackQuery.from.id;

    // Handle Language Selector Callback
    if (callbackQuery && callbackQuery.data.startsWith('lang_')) {
        const selectedLang = callbackQuery.data.split('_')[1];
        await customerService.upsertCustomer(botToken, telegramUserId, { language: selectedLang });
        await sendMainMenu(botToken, chatId, selectedLang);
        return;
    }

    // Handle Contact Sharing (Lead Dam Passing)
    if (message && message.contact) {
        const contact = message.contact;
        const name = contact.first_name || 'Mijoz';
        const phone = contact.phone_number;
        
        await leadService.captureLead(botToken, telegramUserId, { name, phone });
        await customerService.upsertCustomer(botToken, telegramUserId, { is_lead_captured: true, phone });
        
        const lang = (await customerService.getCustomer(botToken, telegramUserId))?.language || 'uz';
        const msg = lang === 'ru' ? "Спасибо! Ваши данные приняты. Теперь вы можете использовать все функции." : "Rahmat! Ma'lumotlaringiz qabul qilindi. Endi barcha xizmatlardan foydalanishingiz mumkin.";
        
        await telegramApi.sendMessage(botToken, chatId, msg);
        await sendMainMenu(botToken, chatId, lang);
        return;
    }

    const text = (message && message.text) ? message.text : '';

    // Check Customer State (Lead Dam Logic)
    const customer = await customerService.getCustomer(botToken, telegramUserId);
    const lang = customer?.language || 'uz';
    const isLeadCaptured = customer?.is_lead_captured || false;

    // Handle standard static buttons first
    if ([
        'Ersag Portal', 'Katalog', 'VIP group', 'Admin bilan aloqa', 'Ulashish',
        "Go'zallik", "Sog'liq", 'Tozalash', 'Bepul konsultatsiya',
        "Ro'yxatdan o'tish", '👨‍⚕️ Doctor Ersag', '🔍 Mahsulot kodi',
        '🌟 VIP group', '✅ Ro\'yxatdan o\'tish', '🛍️ Ersag Portal', '📦 Katalog',
        "💄 Go'zallik", "💪 Sog'liq", '🏠 Tozalash', '📞 Admin bilan aloqa'
    ].includes(text)) {
        
        // Lead Dam Enforcement: Block access to certain features if not collected
        if (!isLeadCaptured && ['Ersag Portal', 'Katalog', "Go'zallik", "Sog'liq", 'Tozalash'].includes(text)) {
            const damMsg = lang === 'ru' 
                ? "Пожалуйста, поделитесь своим номером телефона (нажмите «Ulashish / Поделиться кнопкой»), чтобы получить доступ к каталогу и порталу." 
                : "Katalog va portalga kirish uchun, iltimos kontakt ulashish tugmasini bosing ('Ulashish').";
            await telegramApi.sendMessage(botToken, chatId, damMsg);
            return;
        }

        await handleMenuAction(botToken, chatId, text, lang);
        return;
    }

    // Default AI behavior if not clicking a standard menu
    // ENFORCE LEAD DAM FOR AI
    if (!isLeadCaptured) {
        const systemPrompt = lang === 'ru'
            ? "Вы дружелюбный ИИ-помощник ERSAG. Пользователь еще не оставил свой контакт. Ваша цель - убедить их нажать кнопку 'Ulashish' или 'Ro'yxatdan o'tish', чтобы вы могли полноценно с ними работать."
            : "You are a friendly lead generation assistant for ERSAG. Your goal is to collect their phone number. Ask them to press 'Ulashish' (share contact) or 'Ro'yxatdan o'tish'. Be brief.";
        
        const messages = [{ role: "user", content: text }];
        const response = await aiService.callLLM(messages, systemPrompt);
        await telegramApi.sendMessage(botToken, chatId, response);
        return;
    }

    // Fully unlocked AI
    const messages = [{ role: "user", content: text }];
    const systemPrompt = lang === 'ru'
        ? "Вы умный консультант ERSAG. Пользователь подтвержден. Отвечайте на его запросы о продукции."
        : "Siz ERSAG kompaniyasining aqlli maslahatchisisiz. Mijoz tasdiqlangan. Ularga mahsulotlar bo'yicha yordam bering.";
    
    const response = await aiService.callLLM(messages, systemPrompt);
    await telegramApi.sendMessage(botToken, chatId, response);
};

const sendMainMenu = async (botToken, chatId, lang) => {
    // Sales Brain menu — Ersag Portal, catalog, AI Doctor, product lookups
    const replyMarkup = {
        keyboard: [
            [{ text: "🛍️ Ersag Portal" }, { text: "📦 Katalog" }],
            [{ text: "💄 Go'zallik" }, { text: "💪 Sog'liq" }, { text: "🏠 Tozalash" }],
            [{ text: "👨‍⚕️ Doctor Ersag" }, { text: "🔍 Mahsulot kodi" }],
            [{ text: "🌟 VIP group" }, { text: "✅ Ro'yxatdan o'tish" }],
            [{ text: "📞 Admin bilan aloqa" }]
        ],
        resize_keyboard: true
    };
    const textMsg = lang === 'ru' ? "Главное меню (Продажи):" : "Asosiy menyu (Savdo):";
    await telegramApi.sendMessage(botToken, chatId, textMsg, replyMarkup);
};

const handleMenuAction = async (botToken, chatId, text, lang) => {
    // Normalise — strip emoji prefix for matching
    const key = text.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\u20E3\s]+/u, '').trim();
    switch (key) {
        case 'Ersag Portal':
            await telegramApi.sendMessage(botToken, chatId, lang === 'ru' ? "Нажмите на кнопку web-app для входа на портал Ersag." : "Ersag portaliga kirish uchun web-app tugmasini bosing.");
            break;
        case 'Katalog':
            await telegramApi.sendMessage(botToken, chatId, lang === 'ru' ? "Все продукты здесь: 👉 Каталог" : "Barcha mahsulotlar bu yerda: 👉 Katalog");
            break;
        case 'Admin bilan aloqa':
            await telegramApi.sendMessage(botToken, chatId, "Admin: @MSU_Berdibekov");
            break;
        case 'Ro\'yxatdan o\'tish':
            await telegramApi.sendMessage(botToken, chatId, lang === 'ru' ? "Регистрация бесплатна и дает 20% скидку! Воспользуйтесь сайтом." : "A'zo bo'lish bepul va 20% chegirma beradi! Saytdan foydalaning.");
            break;
        case 'VIP group':
            await require('../services/vipService').sendVipInvite(botToken, chatId, chatId);
            break;
        case 'Doctor Ersag':
            await require('./doctorAgent').showSymptomSelector(botToken, chatId);
            break;
        case 'Mahsulot kodi':
            await telegramApi.sendMessage(botToken, chatId, lang === 'ru' ? "Введите код продукта (например ERG-101):" : "Mahsulot kodini kiriting (masalan ERG-101):");
            break;
        default:
            await telegramApi.sendMessage(botToken, chatId, lang === 'ru' ? "Ваш выбор принят." : "Tanlovingiz qabul qilindi.");
            break;
    }
};

module.exports = { run };
