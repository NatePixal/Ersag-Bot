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

// Customer Webhook catches all bots except Master Bot
app.post('/', async (req, res) => {
    // 1. Acknowledge Telegram immediately to prevent retries
    res.status(200).send("OK");
    
    try {
        const body = req.body;
        if (!body.message) return;

        const webhookUuid = req.query.id;
        let botToken = env.TELEGRAM_TOKEN; // Default fallback if needed

        // Resolve token from Webhook UUID (Tenant isolated routing!)
        if (webhookUuid) {
            const resolvedToken = await botRegistry.resolveTokenFromUuid(webhookUuid);
            if (resolvedToken) botToken = resolvedToken;
            else {
                logger.warn(`customerWebhook: Unregistered webhook hit with ID ${webhookUuid}`);
                return;
            }
        }

        const message = body.message;
        const chatId = message.chat.id;
        const telegramUserId = message.from.id;
        
        // --- THE SILENT LEAD DAM (Contact sharing) ---
        if (message.contact || message.photo) {
            const phone = message.contact ? message.contact.phone_number : 'Rasm yuborildi';
            const name = message.from.first_name || "Mijoz";
            
            // Re-use our existing flawless lead capture architecture!
            await leadService.captureLead(botToken, telegramUserId, { name, phone });
            await telegramApi.sendMessage(botToken, chatId, `✅ Rahmat, ${name}! Mutaxassislarimiz tez orada siz bilan bog'lanishadi 🙏`);
            return;
        }

        const text = message.text ? message.text.trim() : '';
        if (!text) return;
        
        const lang = /[а-яА-ЯёЁ]/.test(text) ? "ru" : "uz";
        const M = lang === 'ru' ? MENUS.CUSTOMER_RU : MENUS.CUSTOMER_UZ;
        const ownerId = await botRegistry.getBotOwner(botToken);

        // --- EXACT MENU ROUTING ---
        if (text.startsWith('/start')) {
            const parts = text.split(' ');
            if (parts.length > 1) {
                // Tracking referral logic
                const referral = parts[1];
                await db.collection("customer_referrals").doc(String(telegramUserId)).set({
                    referral_code: referral,
                    bot_token: botToken,
                    joined_at: new Date().toISOString()
                }, { merge: true });
            }
            // Standard Customer Main Menu
            const keyboard = {
                keyboard: [
                    [{ text: M.PORTAL }],
                    [{ text: M.CATALOG }, { text: M.HEALTH }],
                    [{ text: M.BEAUTY }, { text: M.CLEANING }],
                    [{ text: M.CONSULT }],
                    [{ text: M.VIP }, { text: M.REGISTER }],
                    [{ text: M.ADMIN }]
                ],
                resize_keyboard: true
            };
            return telegramApi.sendMessage(botToken, chatId, "Salom! Ersag organik olamiga xush kelibsiz 🌿👇", keyboard);
        }

        // Exact Match Static Responses
        switch (text) {
            case M.CATALOG:
                return telegramApi.sendMessage(botToken, chatId, "🛍️ *Ersag Portal*ni oching → *«Katalog»* bo'limi — barcha mahsulotlar rasmlari va narxlari bilan!");
            case M.HEALTH:
                return telegramApi.sendMessage(botToken, chatId, "💊 *Sog'liq mahsulotlari*\n\nQaysi muammo borligini yozing (Masalan: 'Immunitetim past', 'Uyqum yaxshi emas'...)");
            case M.BEAUTY:
                return telegramApi.sendMessage(botToken, chatId, "💄 *Go'zallik va Parvarish*\n\nNima bezovta qilyapti? Quyida yozib qoldiring! 👇");
            case M.CLEANING:
                return telegramApi.sendMessage(botToken, chatId, "🏠 *Uy tozalash vositalari*\n\nNimani tozalash kerak? Batafsil yozing! 👇");
            case M.REGISTER:
                const leaderDoc = ownerId ? await db.collection("leaders").doc(String(ownerId)).get() : null;
                const sponsorId = leaderDoc && leaderDoc.exists ? leaderDoc.data().sponsor_id : '5422685';
                const regLink = `https://www.ersagglobal.uz/account.asp?mod=myaccount&sub=edit&action=register&p=1&red=&sponsor=${sponsorId}`;
                return telegramApi.sendMessage(botToken, chatId, `🎉 Ersag a'zosi bo'ling!\n\n✅ *20% chegirma*\n🆔 *Sponsor ID:* \`${sponsorId}\``, { 
                    inline_keyboard: [[{ text: "✅ Ro'yxatdan o'tish", url: regLink }]] 
                });
            case M.ADMIN:
                return telegramApi.sendMessage(botToken, chatId, "📞 Adminlarimiz orqali bog'lanish uchun raqamingizni qoldiring (Masalan: Bepul Konsultatsiya tugmasi orqali).");
            case M.CONSULT:
                const consultKeyboard = {
                    keyboard: [[{ text: "📲 Raqamni yuborish", request_contact: true }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                };
                return telegramApi.sendMessage(botToken, chatId, "Shaxsiy muammoni hal qilish bo'yicha maslahat.\nIltimos, pastdagi tugmani bosib, raqamingizni yuboring:", consultKeyboard);
            case M.PORTAL:
                // Provided dynamically via Web App in the start menu
                return; 
        }

        // --- FREE TEXT -> PUBSUB AI OFFLOAD (The Enterprise Upgrade) ---
        // Offloading to PubSub completely guarantees Telegram will not encounter a HTTP 504 Timeout 
        // due to slow external LLM API calls, permanently stopping duplicate automated replies!
        logger.info(`Sending message from ${telegramUserId} to Pub/Sub AI Worker...`);
        const payload = JSON.stringify({ 
            chatId, 
            userText: text, 
            lang, 
            token: botToken, 
            ownerId 
        });
        
        await pubsub.topic(PUBSUB_TOPIC).publishMessage({ data: Buffer.from(payload) });

    } catch (e) {
        logger.error("customerWebhook execution error:", e);
    }
});

module.exports = app;
