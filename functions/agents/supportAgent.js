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

module.exports = { run };
