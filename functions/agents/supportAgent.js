const telegramApi = require('../utils/telegramApi');
const logger = require('../utils/logger');

const FAQ_UZ = [
    { q: "narx", a: "ERSAG mahsulotlari narxi 50,000 so'mdan boshlanadi. Katalogdan to'liq narxlarni ko'ring." },
    { q: "chegirma", a: "A'zo bo'lganingizda 20% chegirma olasiz! Ro'yxatdan o'tish bepul." },
    { q: "yetkazib berish", a: "Toshkent bo'yicha 1-2 ish kunida yetkazib beramiz. Viloyatlarga 3-5 kun." },
    { q: "halol", a: "Ha! Barcha ERSAG mahsulotlari 100% organik va halol sertifikatiga ega." },
    { q: "qaytarish", a: "14 kun ichida sifatsiz mahsulotni bepul almashtiramiz." },
];

const FAQ_RU = [
    { q: "цена", a: "Продукты ERSAG начинаются от 50 000 сум. Посмотрите полные цены в каталоге." },
    { q: "скидка", a: "При регистрации вы получаете скидку 20%! Регистрация бесплатна." },
    { q: "доставка", a: "По Ташкенту 1-2 рабочих дня. По регионам 3-5 дней." },
    { q: "халяль", a: "Да! Все продукты ERSAG на 100% органические и имеют халяль сертификат." },
    { q: "возврат", a: "В течение 14 дней мы бесплатно заменяем некачественный товар." },
];

const run = async (update, botToken) => {
    logger.info('Running supportAgent (Help/FAQ)');
    const message = update.message;
    if (!message) return;
    
    const chatId = message.chat.id;
    const text = (message.text || '').toLowerCase();
    const rawText = message.text || '';

    // Show dedicated Support menu on /start or explicit menu request
    if (rawText.startsWith('/start') || rawText === 'FAQ' || rawText === 'Menyu' || rawText === 'Меню') {
        await sendSupportMenu(botToken, chatId, /[а-яё]/i.test(text) ? 'ru' : 'uz');
        return;
    }

    // Handle Support menu buttons explicitly
    if (rawText === '❓ FAQ — Savollar') {
        await telegramApi.sendMessage(botToken, chatId,
            "❓ *Ko'p beriladigan savollar:*\n\n" +
            "• Narx: Mahsulotlar 50,000 so'mdan\n" +
            "• Chegirma: A'zo bo'lsangiz 20%\n" +
            "• Yetkazib berish: Toshkent 1-2 kun\n" +
            "• Halol sertifikat: Ha, barchasi\n" +
            "• Qaytarish: 14 kun ichida\n\n" +
            "Batafsil savol uchun: @MSU_Berdibekov"
        );
        return;
    }

    if (rawText === '💬 Narx va chegirma') {
        await telegramApi.sendMessage(botToken, chatId,
            "💬 *Narx va chegirma:*\n\n" +
            "📦 Mahsulotlar 50,000 so'mdan boshlanadi.\n" +
            "🎁 A'zo bo'lsangiz darhol *20% chegirma* olasiz!\n" +
            "Ro'yxatdan o'tish — bepul.\n\n" +
            "To'liq katalog va narxlar: @MSU_Berdibekov"
        );
        return;
    }

    if (rawText === '🚚 Yetkazib berish') {
        await telegramApi.sendMessage(botToken, chatId,
            "🚚 *Yetkazib berish:*\n\n" +
            "🏙️ Toshkent: 1-2 ish kunida\n" +
            "🗺️ Viloyatlar: 3-5 ish kunida\n" +
            "📦 Minimal buyurtma yo'q.\n\n" +
            "Buyurtma berish: @MSU_Berdibekov"
        );
        return;
    }

    if (rawText === "📞 Admin bilan bog'lanish") {
        await telegramApi.sendMessage(botToken, chatId, "📞 Admin: @MSU_Berdibekov");
        return;
    }

    // FAQ: Track Order stub
    if (text.includes('track') || text.includes('buyurtma') || text.includes('заказ') || text.includes('kuzat')) {
        await telegramApi.sendMessage(botToken, chatId,
            "📦 Buyurtmangizni kuzatish uchun buyurtma raqamingizni yuboring yoki admin bilan bog'laning: @MSU_Berdibekov"
        );
        return;
    }
    
    // Detect language from text (simple heuristic)
    const isRussian = /[а-яё]/i.test(text);
    const faq = isRussian ? FAQ_RU : FAQ_UZ;
    
    const match = faq.find(item => text.includes(item.q));
    
    if (match) {
        await telegramApi.sendMessage(botToken, chatId, `❓ ${match.a}`);
    } else {
        const msg = isRussian
            ? "Здравствуйте! Задайте вопрос про:\n• Цены\n• Скидку\n• Доставку\n• Халяль\n• Возврат\n\nИли напишите @MSU_Berdibekov для прямой связи."
            : "Salom! Quyidagi mavzularda savol bering:\n• Narx\n• Chegirma\n• Yetkazib berish\n• Halol\n• Qaytarish\n\nYoki @MSU_Berdibekov bilan to'g'ridan to'g'ri bog'laning.";
        await telegramApi.sendMessage(botToken, chatId, msg);
    }
};

const sendSupportMenu = async (botToken, chatId, lang = 'uz') => {
    // Support Brain menu — FAQ, Order Tracking, Contact Admin only
    const replyMarkup = {
        keyboard: [
            [{ text: "❓ FAQ — Savollar" }, { text: "📦 Buyurtmani kuzatish" }],
            [{ text: "💬 Narx va chegirma" }, { text: "🚚 Yetkazib berish" }],
            [{ text: "📞 Admin bilan bog'lanish" }]
        ],
        resize_keyboard: true
    };
    const textMsg = lang === 'ru'
        ? "Служба поддержки — выберите тему:"
        : "Yordam markazi — mavzuni tanlang:";
    await telegramApi.sendMessage(botToken, chatId, textMsg, replyMarkup);
};

module.exports = { run, sendSupportMenu };
