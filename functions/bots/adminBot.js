// functions/bots/adminBot.js
const telegramApi = require('../utils/telegramApi');
const { syncProductsFromSheets } = require('../services/sheetsService');
const env = require('../config/env');

async function handleUpdate(update, botToken) {
    const message = update.message;
    const userId = message ? message.from.id : update.callback_query.from.id;

    // 1. Handle "Approve/Reject" Buttons
    if (update.callback_query) {
        // ... (Payment logic we wrote before)
        return;
    }

    const text = message.text || "";

    // 2. Admin Commands
    if (text === '/sync_products') {
        await telegramApi.sendMessage(botToken, userId, "⏳ Syncing with Google Sheets...");
        try {
            const count = await syncProductsFromSheets(env.GOOGLE_SHEETS_ID);
            return telegramApi.sendMessage(botToken, userId, `✅ Success! ${count} products updated in the AI brain.`);
        } catch (err) {
            return telegramApi.sendMessage(botToken, userId, `❌ Sync Failed: ${err.message}`);
        }
    }

    if (text === '/stats') {
        // We can add logic here to count leaders/tokens
        return telegramApi.sendMessage(botToken, userId, "📊 System Stats:\n- Active Bots: 1\n- AI Calls Today: 0");
    }

    // 3. Default Admin Menu
    const adminMenu = {
        inline_keyboard: [
            [{ text: "🌐 Open Admin Panel", web_app: { url: "https://ersag-ai-bot.web.app/admin.html" } }],
            [{ text: "🔄 Sync Products", callback_data: "sync_now" }]
        ]
    };

    return telegramApi.sendMessage(botToken, userId, 
        "🛠 **Admin Control Center**\n\nYour identity is verified. Use the menu below or commands:\n/sync_products - Update AI Knowledge\n/stats - View system usage", 
        adminMenu
    );
}

module.exports = { handleUpdate };