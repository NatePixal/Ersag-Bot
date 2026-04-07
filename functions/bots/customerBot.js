const logger = require('../utils/logger');
const telegramApi = require('../utils/telegramApi');
const MENUS = require('../core/menus');
const { db } = require('../config/db');
const leadService = require('../services/leadService');

/**
 * Handles all customer-facing interactions (Sales Workforce)
 * Based on Pillar 1 of the Architecture Blueprint.
 */
const handleUpdate = async (body, botDoc, botToken) => {
    try {
        const message = body.message;
        const callbackQuery = body.callback_query;

        if (!message && !callbackQuery) return;

        const telegramUserId = message ? message.from.id : callbackQuery.from.id;
        const chatId = message ? message.chat.id : callbackQuery.message.chat.id;
        const leadCode = botDoc.leader_id || botDoc.leader_code;

        // 1. Get/Create User Profile (Language focus)
        const userRef = db.collection('users').doc(String(telegramUserId));
        const userSnap = await userRef.get();
        let userData = userSnap.exists ? userSnap.data() : { lang: 'uz' };
        
        if (!userSnap.exists) {
            userData = {
                telegram_id: telegramUserId,
                bot_token: botToken,
                lang: 'uz',
                joined_at: new Date().toISOString()
            };
            await userRef.set(userData);
        }

        const resolvedLang = userData.lang || 'uz';
        const M = resolvedLang === 'ru' ? MENUS.CUSTOMER_RU : MENUS.CUSTOMER_UZ;

        // 2. Handle Language Callbacks
        if (callbackQuery) {
            const data = callbackQuery.data;
            if (data === 'lang_uz' || data === 'lang_ru') {
                const newLang = data.replace('lang_', '');
                await userRef.update({ lang: newLang });
                await telegramApi.answerCallbackQuery(botToken, callbackQuery.id);
                
                const updatedM = newLang === 'ru' ? MENUS.CUSTOMER_RU : MENUS.CUSTOMER_UZ;
                const keyboard = {
                    keyboard: [
                        [{ text: updatedM.PORTAL }],
                        [{ text: updatedM.CATALOG }, { text: updatedM.HEALTH }],
                        [{ text: updatedM.BEAUTY }, { text: updatedM.CLEANING }],
                        [{ text: updatedM.CONSULT }],
                        [{ text: updatedM.VIP }, { text: updatedM.REGISTER }],
                        [{ text: updatedM.ADMIN }]
                    ],
                    resize_keyboard: true
                };
                const welcomeMsg = newLang === 'ru' 
                    ? "Добро пожаловать в органический мир Ersag 🌿👇" 
                    : "Salom! Ersag organik olamiga xush kelibsiz 🌿👇";
                await telegramApi.sendMessage(botToken, chatId, welcomeMsg, keyboard);
            }
            return;
        }

        // 3. The Silent Lead Dam (Contact / Photo sharing)
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

        const text = (message.text || '').trim();
        if (!text) return;

        // 4. Start command (Referral tracking)
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
            
            const inlineKeyboard = {
                inline_keyboard: [[{ text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" }, { text: "🇷🇺 Русский", callback_data: "lang_ru" }]]
            };
            return telegramApi.sendMessage(botToken, chatId, "Assalomu alaykum! / Здравствуйте!\n\nTilni tanlang / Выберите язык:", inlineKeyboard);
        }

        // 5. Exact String Matching (The Emoji superpower)
        switch (text) {
            case M.CATALOG:
                const catMsg = resolvedLang === 'ru' ? "🛍️ Откройте *Портал Ersag* → раздел *«Каталог»* — все товары с фото и ценами!" : "🛍️ *Ersag Portal*ni oching → *«Katalog»* bo'limi — barcha mahsulotlar rasmlari va narxlari bilan!";
                return telegramApi.sendMessage(botToken, chatId, catMsg);
            
            case M.HEALTH:
                const healthMsg = resolvedLang === 'ru' ? "💊 *Здоровье*\nНапишите вашу проблему" : "💊 *Sog'liq mahsulotlari*\n\nQaysi muammo borligini yozing";
                return telegramApi.sendMessage(botToken, chatId, healthMsg);
            
            case M.BEAUTY:
                const beautyMsg = resolvedLang === 'ru' ? "💄 *Красота*\nЧто вас беспокоит?" : "💄 *Go'zallik va Parvarish*\n\nNima bezovta qilyapti? Quyida yozib qoldiring! 👇";
                return telegramApi.sendMessage(botToken, chatId, beautyMsg);
            
            case M.CLEANING:
                const cleanMsg = resolvedLang === 'ru' ? "🏠 *Уборка*\nЧто нужно почистить?" : "🏠 *Uy tozalash vositalari*\n\nNimani tozalash kerak? Batafsil yozing! 👇";
                return telegramApi.sendMessage(botToken, chatId, cleanMsg);
            
            case M.REGISTER:
                const leaderDoc = leadCode ? await db.collection("leaders").doc(String(leadCode)).get() : null;
                const sponsorId = (leaderDoc && leaderDoc.exists) ? leaderDoc.data().sponsor_id : '5422685';
                const regLink = `https://www.ersagglobal.uz/account.asp?mod=myaccount&sub=edit&action=register&p=1&red=&sponsor=${sponsorId}`;
                const regMsg = resolvedLang === 'ru' 
                    ? `🎉 Станьте участником Ersag!\n\n✅ *Скидка 20%*\n🆔 *ID спонсора:* \`${sponsorId}\`` 
                    : `🎉 Ersag a'zosi bo'ling!\n\n✅ *20% chegirma*\n🆔 *Sponsor ID:* \`${sponsorId}\``;
                return telegramApi.sendMessage(botToken, chatId, regMsg, { inline_keyboard: [[{ text: "Ro'yxatdan o'tish", url: regLink }]] });
            
            case M.ADMIN:
                const adminMsg = resolvedLang === 'ru' ? "📞 Чтобы связаться с администраторами, оставьте свой номер." : "📞 Adminlarimiz orqali bog'lanish uchun raqamingizni qoldiring.";
                return telegramApi.sendMessage(botToken, chatId, adminMsg);
            
            case M.CONSULT:
                const btnConsult = resolvedLang === 'ru' ? "📲 Отправить номер" : "📲 Raqamni yuborish";
                const consultKeyboard = {
                    keyboard: [[{ text: btnConsult, request_contact: true }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                };
                const consultMsg = resolvedLang === 'ru' ? "Нажмите кнопку ниже и отправьте свой номер:" : "Iltimos, pastdagi tugmani bosib, raqamingizni yuboring:";
                return telegramApi.sendMessage(botToken, chatId, consultMsg, consultKeyboard);
            
            case M.PORTAL:
                // Typically handled by opening a Mini App button from persistent keyboard
                return;
        }

        // 6. Free text -> AI Worker
        const { PubSub } = require('@google-cloud/pubsub');
        const pubsub = new PubSub();
        const payload = JSON.stringify({ chatId, userText: text, lang: resolvedLang, token: botToken, ownerId: leadCode });
        await pubsub.topic("process-ai-message").publishMessage({ data: Buffer.from(payload) });

    } catch (err) {
        logger.error('CustomerBot execution error:', err);
    }
};

module.exports = { handleUpdate };
