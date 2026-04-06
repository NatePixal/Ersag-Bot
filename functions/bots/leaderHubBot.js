const telegramApi = require('../utils/telegramApi');
const MENUS = require('../core/menus');
const { db } = require('../config/db');
const logger = require('../utils/logger');
const env = require('../config/env');

// Link to the real mini app for leaders
const WEB_APP_URL = env.TELEGRAM_WEBHOOK_URL ? `${env.TELEGRAM_WEBHOOK_URL}/leader.html` : "https://ersag-ai-bot.web.app/leader.html";

const run = async (update, botToken) => {
    const message = update.message;
    if (!message) return;
    
    const chatId = message.chat.id;
    const text = message.text || '';
    const leaderId = String(message.from.id);

    // /start command
    if (text === '/start') {
        const replyMarkup = {
            keyboard: [
                [{ text: MENUS.LEADER.DASHBOARD }, { text: MENUS.LEADER.LEADS }],
                [{ text: MENUS.LEADER.AI_TOOLS }, { text: MENUS.LEADER.POST_GEN }, { text: MENUS.LEADER.KNOWLEDGE }],
                [{ text: MENUS.LEADER.ACADEMY }, { text: MENUS.LEADER.SUBSCRIPTION }, { text: MENUS.LEADER.SETTINGS }],
                [{ text: MENUS.LEADER.SUPPORT }]
            ],
            resize_keyboard: true
        };
        await telegramApi.sendMessage(botToken, chatId, 
            "👋 *Sotuvchi Boshqaruv Paneliga xush kelibsiz!*\n\n" +
            "Quyidagi menyu orqali biznesingizni boshqaring:", 
            replyMarkup
        );
        return;
    }

    // Process exactly matched LEADER buttons
    switch (text) {
        case MENUS.LEADER.DASHBOARD:
            return handleDashboard(botToken, chatId, leaderId);
            
        case MENUS.LEADER.LEADS:
            return handleLeads(botToken, chatId);
            
        case MENUS.LEADER.SETTINGS:
        case MENUS.LEADER.SUBSCRIPTION:
        case MENUS.LEADER.ACADEMY:
            return handleMiniAppLaunch(botToken, chatId);
            
        case MENUS.LEADER.AI_TOOLS:
        case MENUS.LEADER.POST_GEN:
        case MENUS.LEADER.KNOWLEDGE:
            return handleAITools(botToken, chatId);
            
        case MENUS.LEADER.SUPPORT:
            return telegramApi.sendMessage(botToken, chatId, "📞 Admin @MSU_Berdibekov bilan bog'laning.");
    }

    // Default fallback if a leader types random text
    await telegramApi.sendMessage(botToken, chatId, "❌ Noto'g'ri buyruq. Iltimos, pastdagi klaviaturadan foydalaning.");
};

/**
 * Renders the dashboard with REAL Firestore data
 */
const handleDashboard = async (botToken, chatId, leaderId) => {
    // Send a loading message first
    const loadingMsg = await telegramApi.sendMessage(botToken, chatId, "⏳ Ma'lumotlar yuklanmoqda...");
    
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Quota
        const limitsDoc = await db.collection('quotas').doc(leaderId).get();
        const limitData = limitsDoc.exists ? limitsDoc.data() : { used: 0, limit: 0 };
        
        // 2. Leads (Delivered vs Pending)
        const leadsSnap = await db.collection('leads').where('leader_id', '==', leaderId).get();
        let totalLeads = 0;
        let pendingLeads = 0;
        leadsSnap.docs.forEach(doc => {
            totalLeads++;
            if (doc.data().status === 'pending') pendingLeads++;
        });

        // 3. Active Bots
        const botsSnap = await db.collection('bots').where('leader_id', '==', leaderId).get();
        const botCount = botsSnap.size;

        // 4. Subscription info
        const leaderDoc = await db.collection('leaders').doc(leaderId).get();
        const subExpiry = leaderDoc.exists && leaderDoc.data().subscription_expiry 
            ? new Date(leaderDoc.data().subscription_expiry).toLocaleDateString('uz-UZ') 
            : 'Obuna yo\'q';

        // Format message
        const dashboardText = 
            `📊 *Sizning Statistikangiz:*\n\n` +
            `🤖 *Ulangan botlar:* ${botCount} ta\n\n` +
            `📥 *Jami Leadlar:* ${totalLeads} ta\n` +
            `🔒 *Qulflangan ("Dam"):* ${pendingLeads} ta\n\n` +
            `🔋 *AI xabarlari (Bugun):* ${limitData.used} / ${limitData.limit}\n\n` +
            `📅 *Obuna holati:* ${subExpiry}\n\n` +
            `👉 Batafsil tahlil uchun *Mini App* ga kiring.`;

        // Send dashboard with Web App button attached directly
        const inlineKeyboard = {
            inline_keyboard: [[{ text: "🖥️ Control Panel (Oymaqni ochish)", web_app: { url: WEB_APP_URL } }]]
        };
        
        await telegramApi.sendMessage(botToken, chatId, dashboardText, inlineKeyboard);

    } catch (err) {
        logger.error('Dashboard build error:', err);
        await telegramApi.sendMessage(botToken, chatId, "❌ Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.");
    }
};

const handleLeads = async (botToken, chatId) => {
    const inlineKeyboard = {
        inline_keyboard: [[{ text: "👥 Barcha Mijozlar", web_app: { url: WEB_APP_URL } }]]
    };
    await telegramApi.sendMessage(botToken, chatId, 
        "Sizning mijozlaringiz bilan ishlash tizimi (CRM) *Control Panel* ichiga joylashgan.\n\nTugmani bosib mijozlarni ko'ring:", 
        inlineKeyboard
    );
};

const handleMiniAppLaunch = async (botToken, chatId) => {
    const inlineKeyboard = {
        inline_keyboard: [[{ text: "⚡ Control Panel (Mini App)", web_app: { url: WEB_APP_URL } }]]
    };
    await telegramApi.sendMessage(botToken, chatId, 
        "Sozlamalar, Akademik darslar va to'lovlarni boshqarish uchun Mini App'ni oching:", 
        inlineKeyboard
    );
};

const handleAITools = async (botToken, chatId) => {
    await telegramApi.sendMessage(botToken, chatId, 
        "🤖 *AI Vositalari tez kunda ishga tushadi!*\n\n" +
        "Biz siz uchun avtomatik post yozuvchi va savdolarni yopuvchi yordamchini tayyorlayapmiz."
    );
};

module.exports = { run };
