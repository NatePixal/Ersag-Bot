const express = require('express');
const { PubSub } = require('@google-cloud/pubsub');
const logger = require('../utils/logger');
const telegramApi = require('../utils/telegramApi');
const botRegistry = require('../services/botRegistryService');
const env = require('../config/env');
const MENUS = require('../core/menus');
const { db } = require('../config/db');
const leadService = require('../services/leadService');

const app = express();
app.use(express.json());

const PUBSUB_TOPIC = "process-ai-message";
const pubsub = new PubSub();

/**
 * Ensures user exists globally and returns their saved properties
 */
async function getOrCreateUser(telegramId, botToken) {
    const userRef = db.collection('users').doc(String(telegramId));
    const userSnap = await userRef.get();
    if (userSnap.exists) {
        return userSnap.data();
    }
    const newUser = {
        telegram_id: telegramId,
        bot_token: botToken,
        lang: 'uz', // Default safe language
        joined_at: new Date().toISOString()
    };
    await userRef.set(newUser);
    return newUser;
}

// Customer Webhook catches all bots except Master Bot
app.post('/', async (req, res) => {
    // 1. Acknowledge Telegram immediately to prevent retries
    res.status(200).send("OK");
    
    try {
        const body = req.body;
        const message = body.message;
        const callbackQuery = body.callback_query;

        if (!message && !callbackQuery) return;

        const webhookUuid = req.query.id;
        let botToken = env.TELEGRAM_TOKEN; 

        // Resolve token from Webhook UUID (Tenant isolated routing)
        if (webhookUuid) {
            const resolvedToken = await botRegistry.resolveTokenFromUuid(webhookUuid);
            if (resolvedToken) botToken = resolvedToken;
            else {
                logger.warn(`customerWebhook: Unregistered webhook hit with ID ${webhookUuid}`);
                return;
            }
        }

        const telegramUserId = message ? message.from.id : callbackQuery.from.id;
        const chatId = message ? message.chat.id : callbackQuery.message.chat.id;

        // Ensure user is registered and fetch specific language
        const userDoc = await getOrCreateUser(telegramUserId, botToken);
        const resolvedLang = userDoc.lang || 'uz';
        const M = resolvedLang === 'ru' ? MENUS.CUSTOMER_RU : MENUS.CUSTOMER_UZ;

        const ownerId = await botRegistry.getBotOwner(botToken);

        // --- CALLBACK QUERY HANDLING (Language selection) ---
        if (callbackQuery) {
            const data = callbackQuery.data;
            if (data === 'lang_uz' || data === 'lang_ru') {
                const newLang = data.replace('lang_', '');
                await db.collection('users').doc(String(telegramUserId)).update({ lang: newLang });
                
                // Immediately answer the query and send the translated main menu!
                await telegramApi.answerCallbackQuery(botToken, callbackQuery.id);
                
                const UpdatedM = newLang === 'ru' ? MENUS.CUSTOMER_RU : MENUS.CUSTOMER_UZ;
                const keyboard = {
                    keyboard: [
                        [{ text: UpdatedM.PORTAL }],
                        [{ text: UpdatedM.CATALOG }, { text: UpdatedM.HEALTH }],
                        [{ text: UpdatedM.BEAUTY }, { text: UpdatedM.CLEANING }],
                        [{ text: UpdatedM.CONSULT }],
                        [{ text: UpdatedM.VIP }, { text: UpdatedM.REGISTER }],
                        [{ text: UpdatedM.ADMIN }]
                    ],
                    resize_keyboard: true
                };
                const welcomeMsg = newLang === 'ru' ? "Добро пожаловать в органический мир Ersag 🌿👇" : "Salom! Ersag organik olamiga xush kelibsiz 🌿👇";
                await telegramApi.sendMessage(botToken, chatId, welcomeMsg, keyboard);
            }
            return;
        }

        // --- THE SILENT LEAD DAM (Contact sharing) ---
        if (message.contact || message.photo) {
            const phone = message.contact ? message.contact.phone_number : 'Rasm yuborildi';
            const name = message.from.first_name || "Mijoz";
            
            await leadService.captureLead(botToken, telegramUserId, { name, phone });
            const replyMsg = resolvedLang === 'ru' 
                ? `✅ Спасибо, ${name}! Наши специалисты скоро свяжутся с вами 🙏`
                : `✅ Rahmat, ${name}! Mutaxassislarimiz tez orada siz bilan bog'lanishadi 🙏`;
            await telegramApi.sendMessage(botToken, chatId, replyMsg);
            return;
        }

        const text = message.text ? message.text.trim() : '';
        if (!text) return;
        
        // --- EXACT MENU ROUTING ---
        if (text.startsWith('/start')) {
            const parts = text.split(' ');
            if (parts.length > 1) {
                const referral = parts[1];
                await db.collection("customer_referrals").doc(String(telegramUserId)).set({
                    referral_code: referral,
                    bot_token: botToken,
                    joined_at: new Date().toISOString()
                }, { merge: true });
            }
            
            // Ask for language preference first!
            const inlineKeyboard = {
                inline_keyboard: [
                    [{ text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" }, { text: "🇷🇺 Русский", callback_data: "lang_ru" }]
                ]
            };
            return telegramApi.sendMessage(botToken, chatId, "Assalomu alaykum! / Здравствуйте!\n\nTilni tanlang / Выберите язык:", inlineKeyboard);
        }

        // Exact Match Static Responses (Translated automatically since M is dynamically resolved!)
        switch (text) {
            case M.CATALOG:
                const catMsg = resolvedLang === 'ru' ? "🛍️ Откройте *Портал Ersag* → раздел *«Каталог»* — все товары с фото и ценами!" : "🛍️ *Ersag Portal*ni oching → *«Katalog»* bo'limi — barcha mahsulotlar rasmlari va narxlari bilan!";
                return telegramApi.sendMessage(botToken, chatId, catMsg);
            case M.HEALTH:
                const healthMsg = resolvedLang === 'ru' ? "💊 *Здоровье*\nНапишите вашу проблему (Например: 'У меня слабый иммунитет')" : "💊 *Sog'liq mahsulotlari*\n\nQaysi muammo borligini yozing (Masalan: 'Immunitetim past', 'Uyqum yaxshi emas'...)";
                return telegramApi.sendMessage(botToken, chatId, healthMsg);
            case M.BEAUTY:
                const beautyMsg = resolvedLang === 'ru' ? "💄 *Красота*\nЧто вас беспокоит? Напишите ниже!" : "💄 *Go'zallik va Parvarish*\n\nNima bezovta qilyapti? Quyida yozib qoldiring! 👇";
                return telegramApi.sendMessage(botToken, chatId, beautyMsg);
            case M.CLEANING:
                const cleanMsg = resolvedLang === 'ru' ? "🏠 *Уборка*\nЧто нужно почистить? Напишите ниже!" : "🏠 *Uy tozalash vositalari*\n\nNimani tozalash kerak? Batafsil yozing! 👇";
                return telegramApi.sendMessage(botToken, chatId, cleanMsg);
            case M.REGISTER:
                const leaderDoc = ownerId ? await db.collection("leaders").doc(String(ownerId)).get() : null;
                const sponsorId = leaderDoc && leaderDoc.exists ? leaderDoc.data().sponsor_id : '5422685';
                const regLink = `https://www.ersagglobal.uz/account.asp?mod=myaccount&sub=edit&action=register&p=1&red=&sponsor=${sponsorId}`;
                const regMsg = resolvedLang === 'ru' ? `🎉 Станьте участником Ersag!\n\n✅ *Скидка 20%*\n🆔 *ID спонсора:* \`${sponsorId}\`` : `🎉 Ersag a'zosi bo'ling!\n\n✅ *20% chegirma*\n🆔 *Sponsor ID:* \`${sponsorId}\``;
                const regBtn = resolvedLang === 'ru' ? "Регистрация" : "Ro'yxatdan o'tish";
                return telegramApi.sendMessage(botToken, chatId, regMsg, { 
                    inline_keyboard: [[{ text: `✅ ${regBtn}`, url: regLink }]] 
                });
            case M.ADMIN:
                const adminMsg = resolvedLang === 'ru' ? "📞 Чтобы связаться с администраторами, оставьте свой номер (Например: с помощью кнопки Бесплатная Консультация)." : "📞 Adminlarimiz orqali bog'lanish uchun raqamingizni qoldiring (Masalan: Bepul Konsultatsiya tugmasi orqali).";
                return telegramApi.sendMessage(botToken, chatId, adminMsg);
            case M.CONSULT:
                const btnConsult = resolvedLang === 'ru' ? "📲 Отправить номер" : "📲 Raqamni yuborish";
                const consultKeyboard = {
                    keyboard: [[{ text: btnConsult, request_contact: true }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                };
                const consultMsg = resolvedLang === 'ru' ? "Совет по личному вопросу.\nНажмите кнопку ниже и отправьте свой номер:" : "Shaxsiy muammoni hal qilish bo'yicha maslahat.\nIltimos, pastdagi tugmani bosib, raqamingizni yuboring:";
                return telegramApi.sendMessage(botToken, chatId, consultMsg, consultKeyboard);
            case M.PORTAL:
                return; 
        }

        // --- FREE TEXT -> PUBSUB AI OFFLOAD ---
        logger.info(`Sending message from ${telegramUserId} to Pub/Sub AI Worker...`);
        const payload = JSON.stringify({ 
            chatId, 
            userText: text, 
            lang: resolvedLang, 
            token: botToken, 
            ownerId 
        });
        
        await pubsub.topic(PUBSUB_TOPIC).publishMessage({ data: Buffer.from(payload) });

    } catch (e) {
        logger.error("customerWebhook execution error:", e);
    }
});

module.exports = app;
