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
    const leaderId = String(message.from.id);

    if (text === '🎛️ Boshqaruv Paneli' || text === '/start') {
        const replyMarkup = {
            inline_keyboard: [[{text: "⚡ Control Panel (Web)", web_app: {url: "https://ersag-ai-bot.web.app/leader.html"}}]]
        };
        await telegramApi.sendMessage(botToken, chatId, "Sotuvchi boshqaruv paneliga xush kelibsiz. Tugmani bosing:", replyMarkup);
    } else if (text === 'Admin bilan boglanish') {
        await telegramApi.sendMessage(botToken, chatId, "Admin: @MSU_Berdibekov");
    } else {
        const replyMarkup = {
            keyboard: [
                [{text: "🎛️ Boshqaruv Paneli"}],
                [{text: "Admin bilan boglanish"}]
            ],
            resize_keyboard: true
        };
        await telegramApi.sendMessage(botToken, chatId, "Platformaga kiring:", replyMarkup);
    }
};

module.exports = { run };
