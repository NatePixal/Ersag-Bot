const express = require('express');
const { PubSub } = require('@google-cloud/pubsub');
const logger = require('../utils/logger');
const telegramApi = require('../utils/telegramApi');
const MENUS = require('../core/menus');
const env = require('../config/env');
const { db } = require('../config/db');

const app = express();
app.use(express.json());

const PUBSUB_TOPIC = "process-ai-message";
const pubsub = new PubSub();
const WEB_APP_URL = env.TELEGRAM_WEBHOOK_URL ? `${env.TELEGRAM_WEBHOOK_URL}/leader.html` : "https://ersag-ai-bot.web.app/leader.html";

// Leader Webhook catches ONLY the Master Bot
app.post('/', async (req, res) => {
    res.status(200).send("OK");

    try {
        const body = req.body;
        if (!body.message) return;

        const message = body.message;
        const chatId = message.chat.id;
        const telegramUserId = String(message.from.id);
        const text = message.text ? message.text.trim() : '';

        // Only the dedicated leader bot token works here
        const botToken = env.MASTER_BOT_TOKEN;

        // --- 1. AUTHENTICATE LEADER ---
        // Only registered leaders are allowed to use this bot
        const leaderDoc = await db.collection("leaders").doc(telegramUserId).get();
        if (!leaderDoc.exists) {
            return telegramApi.sendMessage(botToken, chatId, "❌ Kechirasiz, siz tizimda Leader sifatida ro'yxatdan o'tmagansiz. Administratorga murojaat qiling.");
        }
        const leader = leaderDoc.data();

        const leaderMenu = {
            keyboard: [
                [{ text: MENUS.LEADER.DASHBOARD }, { text: MENUS.LEADER.LEADS }],
                [{ text: MENUS.LEADER.AI_TOOLS }, { text: MENUS.LEADER.POST_GEN }, { text: MENUS.LEADER.KNOWLEDGE }],
                [{ text: MENUS.LEADER.ACADEMY }, { text: MENUS.LEADER.SUBSCRIPTION }, { text: MENUS.LEADER.SETTINGS }],
                [{ text: MENUS.LEADER.SUPPORT }]
            ],
            resize_keyboard: true
        };

        // --- 2. HANDLE PAYMENTS (Screenshots) ---
        if (message.photo) {
            const fileId = message.photo[message.photo.length - 1].file_id;
            
            const paymentRef = await db.collection("payments").add({
                leader_id: telegramUserId,
                telegram_id: chatId,
                file_id: fileId,
                status: "pending",
                timestamp: new Date().toISOString()
            });

            const paymentId = paymentRef.id;

            // Forward the photo to the Admin
            const adminToken = env.ADMIN_BOT_TOKEN || env.MASTER_BOT_TOKEN;
            const adminChatId = env.MASTER_ADMIN_CHAT_ID || env.ADMIN_CHAT_ID;
            
            if (adminChatId) {
                const caption = `🆕 <b>Yangi To'lov!</b>\n\n👤 Kimdan: Leader (ID: <code>${telegramUserId}</code>)\n📝 Ismi: ${leader.name || 'Noma\'lum'}`;
                const inlineKeyboard = {
                    inline_keyboard: [[
                        { text: "✅ Tasdiqlash", callback_data: `approve_${paymentId}` },
                        { text: "❌ Rad etish", callback_data: `reject_${paymentId}` }
                    ]]
                };
                await telegramApi.sendPhoto(adminToken, adminChatId, fileId, caption, inlineKeyboard);
            }

            return telegramApi.sendMessage(botToken, chatId, "✅ To'lov cheki qabul qilindi! Administrator tasdiqlashini kuting.", { reply_markup: leaderMenu });
        }

        // --- 3. STATE BASED ROUTING (For AI post generation) ---
        if (leader.state === "waiting_for_post_topic" && text && text !== "/start" && !Object.values(MENUS.LEADER).includes(text)) {
            // Reset state so it doesn't loop
            await leaderDoc.ref.update({ state: "idle" });
            
            await telegramApi.sendMessage(botToken, chatId, "⏳ Instagram posti tayyorlanmoqda... Iltimos kuting.");
            
            // Send to Pub/Sub with action="generate_post"
            const payload = JSON.stringify({ 
                chatId, 
                userText: text, 
                lang: "uz", // Posts default to UZ usually
                token: botToken, 
                ownerId: telegramUserId,
                action: "generate_post"
            });
            await pubsub.topic(PUBSUB_TOPIC).publishMessage({ data: Buffer.from(payload) });
            return;
        }

        // Reset state automatically if they click a button or type /start
        if (leader.state === "waiting_for_post_topic") {
            await leaderDoc.ref.update({ state: "idle" });
        }

        // --- 4. EXACT MATCH ROUTING ---
        if (text === "/start") {
            return telegramApi.sendMessage(botToken, chatId, `Xush kelibsiz, Leader *${leader.name || "Hamkor"}*! 👑\n\nBoshqaruv paneliga marhamat:`, { reply_markup: leaderMenu });
        }

        switch (text) {
            // WEB APP ROUTINGS
            case MENUS.LEADER.DASHBOARD:
            case MENUS.LEADER.LEADS:
            case MENUS.LEADER.ACADEMY:
            case MENUS.LEADER.SETTINGS:
                const inlineKeyboard = {
                    inline_keyboard: [[{ text: "🖥️ Control Panel'ni ochish", web_app: { url: WEB_APP_URL } }]]
                };
                return telegramApi.sendMessage(botToken, chatId, "Batafsil ma'lumotni Mini App boshqaruv panelidan ko'rishingiz mumkin:", inlineKeyboard);
            
            // MANUAL SUBSCRIPTION INFO
            case MENUS.LEADER.SUBSCRIPTION:
                return telegramApi.sendMessage(botToken, chatId, "💳 *To'lov va Obuna*\n\nOylik to'lovni amalga oshirish ostidagi karta raqamiga pul o'tkazing:\n\n💳 `8600 0000 0000 0000` (Ersag AI)\n\nTo'lov qilganingizdan so'ng, *skrinshotni shu botga yuboring!* 📸", { parse_mode: 'Markdown' });

            // AI TEXT GENERATION TRIGGER
            case MENUS.LEADER.POST_GEN:
                await leaderDoc.ref.update({ state: "waiting_for_post_topic" });
                return telegramApi.sendMessage(botToken, chatId, "📸 *Instagram Post Yozish*\n\nQaysi mahsulot haqida post yozamiz? Mahsulot nomini yoki qisqacha ma'lumotni yuboring:");

            // STUBS
            case MENUS.LEADER.AI_TOOLS:
            case MENUS.LEADER.KNOWLEDGE:
                return telegramApi.sendMessage(botToken, chatId, "🤖 AI asbob-uskunalar tizimi yangilanmoqda. Tez kunda ishga tushadi!");

            case MENUS.LEADER.SUPPORT:
                return telegramApi.sendMessage(botToken, chatId, "📞 Qo'llab quvvatlash xizmati:\nAdmin: @MSU_Berdibekov");
        }

        return telegramApi.sendMessage(botToken, chatId, "❌ Noto'g'ri buyruq. Iltimos, pastdagi klaviaturadan foydalaning.");
    } catch (e) {
        logger.error("leaderWebhook execution error:", e);
    }
});

module.exports = app;
