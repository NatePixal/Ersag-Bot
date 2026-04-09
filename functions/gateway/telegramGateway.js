const { db } = require('../config/db');
const admin = require('firebase-admin');
const { sendMessage } = require('../utils/telegramApi');
const env = require('../config/env');
const aiService = require('../agents/aiService');

async function handleTelegramUpdate(req, res) {

    console.log("🚨 CUSTOMER BOT RECEIVED:", JSON.stringify(req.body));

    try {
        const { message } = req.body;
        if (!message || !message.from)
            return res.sendStatus(200);

        const tgId = message.from.id.toString();
        const firstName = message.from.first_name || "User";
        const botToken = req.params.botToken;
        const text = message.text || "";

        /* ADMIN PANEL */
        if (tgId === env.ADMIN_TELEGRAM_ID && text === '/admin') {
            const adminText =
                "🛠 Admin Control Center\n\n" +
                "/sync_products\n/stats";

            await sendMessage(botToken, tgId, adminText);
            return res.sendStatus(200);
        }

        /* USER REGISTRATION */
        const userRef = db.collection('users').doc(tgId);
        let userDoc = await userRef.get();

        if (!userDoc.exists) {
            let assignedLeader = "5422685";

            if (text.startsWith('/start ')) {
                const param = text.split(' ')[1];
                if (param)
                    assignedLeader = param.replace(/^[A-Za-z]+/, '');
            }

            await userRef.set({
                firstName,
                telegram_id: tgId,
                leaderId: assignedLeader,
                createdAt: new Date()
            });

            userDoc = await userRef.get();
        }

        const userData = userDoc.data();
        if (!userData?.leaderId)
            return res.sendStatus(200);

        const leaderRef = db.collection('leaders')
            .doc(userData.leaderId);

        const leaderDoc = await leaderRef.get();
        const leaderData = leaderDoc.data() || {};

        const keyboard = {
            reply_markup: {
                inline_keyboard: [[{
                    text: "🛍 Katalog",
                    web_app: {
                        url:
                          `https://ersag-ai-bot.web.app/index.html?sponsor=${userData.leaderId}`
                    }
                }]]
            }
        };

        if (text.startsWith('/start')) {
            await sendMessage(
                botToken,
                tgId,
                "Salom! Men sizning Ersağ yordamchingizman.",
                keyboard
            );
            return res.sendStatus(200);
        }

        /* AI RESPONSE */
        let aiReply;

        if (leaderData.account_status === 'active'
            && leaderData.tokens > 0) {

            try {
                // Here we call aiService to generate an answer
                // Currently, `aiService.js` expects 3 arguments, but we'll adapt to how the new spec requests it
                // or just pass what's there.
                // aiService.generateResponse(userText, language, leaderId)
                aiReply = await aiService.generateResponse(text, leaderData.language || 'uz', userData.leaderId);
            } catch (err) {
                console.error("AI Failure:", err);
                aiReply = "⚠️ AI temporarily unavailable.";
            }

            leaderRef.update({
                tokens: admin.firestore.FieldValue.increment(-1)
            }).catch(console.error);

        } else {
            aiReply =
                "🤖 AI consultant is resting. Use catalog below.";
        }

        await sendMessage(botToken, tgId, aiReply, keyboard);

    } catch (error) {
        console.error("Gateway Error:", error);
    }

    res.sendStatus(200);
}

module.exports = { handleTelegramUpdate };