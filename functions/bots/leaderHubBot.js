const telegramApi = require('../utils/telegramApi');
const leadService = require('../services/leadService');

const buildLeadsCsv = (leads) => {
    if (leads.length === 0) return '';
    const headers = 'Name,Phone,Status,Created At\n';
    const rows = leads.map(l => `${l.name},${l.phone},${l.status},${l.created_at}`).join('\n');
    Buffer.from(headers + rows, 'utf-8'); // Using a Blob implementation in the API
    return headers + rows;
};

const run = async (update, botToken) => {
    const message = update.message;
    if (!message) return;
    const chatId = message.chat.id;
    const text = message.text || '';
    const textLower = text.toLowerCase();
    const leaderId = String(message.from.id);

    if (textLower === '/start' || textLower === 'menyu') {
        const replyMarkup = {
            keyboard: [
                [{ text: "🎛️ Boshqaruv Paneli" }],
                [{ text: "📞 Admin bilan boglanish" }]
            ],
            resize_keyboard: true
        };
        await telegramApi.sendMessage(botToken, chatId, "Sotuvchi boshqaruv paneliga xush kelibsiz! Quyidagi menyu orqali harakat qiling:", replyMarkup);
    } else if (textLower.includes('boshqaruv paneli')) {
        const replyMarkup = {
            inline_keyboard: [[{ text: "⚡ Control Panel (Web)", web_app: { url: "https://ersag-ai-bot.web.app/leader.html" } }]]
        };
        await telegramApi.sendMessage(botToken, chatId, "Sotuvchi boshqaruv paneliga xush kelibsiz. Tugmani bosing:", replyMarkup);
    } else if (textLower.includes('admin bilan boglanish')) {
        await telegramApi.sendMessage(botToken, chatId, "📞 Admin: @MSU_Berdibekov");
    } else {
        await telegramApi.sendMessage(botToken, chatId, "Menyu uchun /start bosing yoki quyidagi tugmalardan foydalaning.");
    }
};

module.exports = { run };
