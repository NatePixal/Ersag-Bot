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

    if (text === 'Dashboard') {
        const replyMarkup = {
            inline_keyboard: [[{text: "Open CRM Dashboard", web_app: {url: "https://your-firebase-project.web.app/"}}]]
        };
        await telegramApi.sendMessage(botToken, chatId, "Access your CRM Dashboard mini app:", replyMarkup);

    } else if (text === 'Mening leadlarim') {
        const pendingLeads = await leadService.getPendingLeads(leaderId);
        if (pendingLeads.length > 0) {
            const csvData = buildLeadsCsv(pendingLeads);
            await telegramApi.sendDocument(botToken, chatId, csvData, `leads_${leaderId}.csv`);
        } else {
            await telegramApi.sendMessage(botToken, chatId, "Hozircha yangi leadlar yo'q.");
        }

    } else if (text === 'Admin bilan boglanish') {
        await telegramApi.sendMessage(botToken, chatId, "Admin: @MSU_Berdibekov");

    } else if (text === 'AI Helper' || text === 'Post yozish' || text === 'Lessons / Obunam') {
        // These can be extended later or trigger the AI
        await telegramApi.sendMessage(botToken, chatId, `Tanlangan menyu: ${text}. Tejz kunda ishga tushadi.`);
    } else {
        const replyMarkup = {
            keyboard: [
                [{text: "Dashboard"}, {text: "Mening leadlarim"}],
                [{text: "AI Helper"}, {text: "Post yozish"}],
                [{text: "Lessons / Obunam"}, {text: "Admin bilan boglanish"}]
            ],
            resize_keyboard: true
        };
        await telegramApi.sendMessage(botToken, chatId, "Asosiy menyuga xush kelibsiz. Tanlang:", replyMarkup);
    }
};

module.exports = { run };
