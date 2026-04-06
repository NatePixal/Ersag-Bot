/**
 * billingAgent.js — 100% Rule-Based Billing Brain
 *
 * Responsibilities:
 *   1. Show billing menu (Balance, Plans, Top Up)
 *   2. Display hardcoded plan cards with payment card number
 *   3. Receive payment screenshots → forward to MASTER_ADMIN_CHAT_ID with
 *      inline [✅ Approve] [❌ Decline] buttons
 *   4. Reply to user confirming receipt submission
 *
 *  ⚠️  NO calls to aiService.js or Groq anywhere in this file.
 */

const telegramApi = require('../utils/telegramApi');
const logger = require('../utils/logger');
const env = require('../config/env');

// ─── Hardcoded plan catalog ────────────────────────────────────────────────
const PLANS = [
    {
        name: 'Starter',
        price: '49,000 UZS / oy',
        features: ['500 AI xabar / oy', 'CRM kirish', '1 ta bot'],
    },
    {
        name: 'Pro',
        price: '99,000 UZS / oy',
        features: ['Cheksiz AI xabar', 'CRM + Lead boshqaruvi', '3 ta bot', 'VIP guruh kirish'],
    },
    {
        name: 'Business',
        price: '199,000 UZS / oy',
        features: ['Hamma Pro imkoniyatlari', 'Maxsus AI branding', 'Sonsiz botlar', 'Ustuvor qo\'llab-quvvatlash'],
    },
];

// Dummy payment card shown to users
const PAYMENT_CARD = '8600 3300 0790 6762';
const PAYMENT_RECIPIENT = "Berdibekov M. S.";

// ─── Main entry point ──────────────────────────────────────────────────────

const run = async (update, botToken) => {
    logger.info('[BillingAgent] Running — rule-based, no LLM');

    const message = update.message;
    const callbackQuery = update.callback_query;

    // Handle text messages
    if (message) {
        const chatId = message.chat.id;
        const userId = String(message.from.id);
        const firstName = message.from.first_name || 'Foydalanuvchi';
        const text = (message.text || '').trim();

        // /start or menu request → send billing menu
        if (text.startsWith('/start') || text.toLowerCase() === 'menyu') {
            await sendBillingMenu(botToken, chatId, firstName);
            return;
        }

        // User sent a payment receipt photo
        if (message.photo) {
            await handleReceiptPhoto(botToken, chatId, userId, message);
            return;
        }

        // Menu button dispatching
        const textLower = text.toLowerCase();

        if (textLower.includes('balansni ko') || textLower.includes('check balance') || textLower.includes('balans ko')) {
            await handleCheckBalance(botToken, chatId, userId);
            return;
        }

        if (textLower.includes('tarif') || textLower.includes('plan')) {
            await handleShowPlans(botToken, chatId);
            return;
        }

        if (textLower.includes('to\'ldirish') || textLower.includes('top up') || textLower.includes('to`ldirish')) {
            await handleTopUp(botToken, chatId);
            return;
        }

        if (textLower.includes('admin')) {
            await telegramApi.sendMessage(botToken, chatId, '📞 Admin: @MSU_Berdibekov');
            return;
        }

        // Fallback — re-show menu
        await sendBillingMenu(botToken, chatId, firstName);
        return;
    }

    // Handle inline button callbacks from the billing menu (if any)
    if (callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data || '';
        await telegramApi.answerCallbackQuery(botToken, callbackQuery.id);

        if (data === 'billing_plans') {
            await handleShowPlans(botToken, chatId);
        } else if (data === 'billing_topup') {
            await handleTopUp(botToken, chatId);
        } else if (data === 'billing_balance') {
            await handleCheckBalance(botToken, chatId, String(callbackQuery.from.id));
        }
    }
};

// ─── Sub-handlers ──────────────────────────────────────────────────────────

/**
 * Send the main billing keyboard menu.
 */
const sendBillingMenu = async (botToken, chatId, firstName = '') => {
    const replyMarkup = {
        keyboard: [
            [{ text: "💳 Balansni ko'rish" }, { text: '🛒 Tariflar' }],
            [{ text: "💰 Balans to'ldirish" }],
            [{ text: "📞 Admin bilan bog'lanish" }],
        ],
        resize_keyboard: true,
    };

    const greeting = firstName ? `Salom, <b>${firstName}</b>! ` : '';
    await telegramApi.sendMessage(
        botToken,
        chatId,
        `${greeting}💳 <b>Billing Panel</b>\n\nQuyidagi variantlardan birini tanlang:`,
        replyMarkup
    );
};

/**
 * Show the user's current quota/balance from Firestore.
 */
const handleCheckBalance = async (botToken, chatId, userId) => {
    try {
        const { db } = require('../config/db');
        const doc = await db.collection('quotas').doc(String(userId)).get();
        if (doc.exists) {
            const d = doc.data();
            const used = d.used || 0;
            const limit = d.limit || 0;
            const remaining = Math.max(0, limit - used);
            await telegramApi.sendMessage(
                botToken, chatId,
                `💳 <b>Sizning balansingiz:</b>\n\n` +
                `📊 Umumiy limit: <b>${limit}</b> xabar\n` +
                `✅ Ishlatilgan: <b>${used}</b>\n` +
                `🔋 Qolgan: <b>${remaining}</b> xabar\n\n` +
                `Balansni to'ldirish uchun 👉 <b>💰 Balans to'ldirish</b>`
            );
        } else {
            await telegramApi.sendMessage(
                botToken, chatId,
                `💳 <b>Balansingiz:</b> Hali hech qanday obuna yoq.\n\nBoshlash uchun 👉 <b>🛒 Tariflar</b>`
            );
        }
    } catch (err) {
        logger.error('[BillingAgent] handleCheckBalance error:', err);
        await telegramApi.sendMessage(botToken, chatId, 'Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
    }
};

/**
 * Display the hardcoded plan cards.
 */
const handleShowPlans = async (botToken, chatId) => {
    let msg = '🛒 <b>Mavjud Tariflar:</b>\n\n';
    PLANS.forEach((plan, i) => {
        msg += `${['1️⃣','2️⃣','3️⃣'][i]} <b>${plan.name}</b> — ${plan.price}\n`;
        plan.features.forEach(f => { msg += `  • ${f}\n`; });
        msg += '\n';
    });

    msg +=
        `──────────────────\n` +
        `💰 To'lov qilish uchun <b>Balans to'ldirish</b> tugmasini bosing.`;

    await telegramApi.sendMessage(botToken, chatId, msg);
};

/**
 * Show the top-up instructions: card number + ask for photo.
 */
const handleTopUp = async (botToken, chatId) => {
    await telegramApi.sendMessage(
        botToken,
        chatId,
        `💰 <b>Balansni To'ldirish</b>\n\n` +
        `Quyidagi karta raqamiga pul o'tkazing:\n\n` +
        `🏦 Karta: <code>${PAYMENT_CARD}</code>\n` +
        `👤 Egasi: <b>${PAYMENT_RECIPIENT}</b>\n\n` +
        `To'lov summasi: tarif narxiga qarab tanlang (🛒 Tariflar)\n\n` +
        `✅ To'lov qilganingizdan so'ng <b>chek rasmini (screenshot)</b> shu chatga yuboring.\n` +
        `Admin 24 soat ichida tasdiqlaydi va balansingiz yangilanadi.`
    );
};

/**
 * Receive a payment screenshot from the user, forward it to MASTER_ADMIN_CHAT_ID
 * with inline Approve / Decline buttons, and acknowledge the user.
 */
const handleReceiptPhoto = async (botToken, chatId, userId, message) => {
    logger.info(`[BillingAgent] Received receipt photo from user ${userId}`);

    // 1. Acknowledge the user immediately
    await telegramApi.sendMessage(
        botToken,
        chatId,
        `✅ Chek qabul qilindi!\n\nAdminga yuborildi — <b>24 soat</b> ichida ko'rib chiqiladi.\n` +
        `Savollar bo'lsa: @MSU_Berdibekov`
    );

    // 2. Forward photo to MASTER_ADMIN_CHAT_ID via MASTER_BOT_TOKEN
    const adminChatId = env.MASTER_ADMIN_CHAT_ID;
    const masterToken = env.MASTER_BOT_TOKEN;

    if (!adminChatId || !masterToken) {
        logger.warn('[BillingAgent] MASTER_ADMIN_CHAT_ID or MASTER_BOT_TOKEN not set — cannot forward receipt');
        return;
    }

    const fileId = message.photo[message.photo.length - 1].file_id;
    const firstName = message.from.first_name || '?';
    const lastName = message.from.last_name || '';
    const timestamp = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });

    const caption =
        `📥 <b>Yangi to'lov cheki!</b>\n\n` +
        `👤 User ID: <code>${userId}</code>\n` +
        `📛 Ismi: ${firstName} ${lastName}\n` +
        `🤖 Bot token: <code>${botToken.substring(0, 12)}...</code>\n` +
        `⏰ ${timestamp}`;

    const adminMarkup = {
        inline_keyboard: [[
            { text: '✅ Approve', callback_data: `approve_pay_${userId}` },
            { text: '❌ Decline', callback_data: `decline_pay_${userId}` },
        ]],
    };

    await telegramApi.sendPhoto(masterToken, adminChatId, fileId, caption, adminMarkup);
    logger.info(`[BillingAgent] Forwarded receipt to admin chat ${adminChatId}`);
};

module.exports = { run, sendBillingMenu };
