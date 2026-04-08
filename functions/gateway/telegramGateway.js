const { db } = require('../config/db');
const { sendMessage } = require('../utils/telegramApi');
const env = require('../config/env');
const customerBot = require('../bots/customerBot');

async function handleTelegramUpdate(req, res) {
    try {
        const { message } = req.body;
        if (!message || !message.from) return res.sendStatus(200);

        const tgId = message.from.id.toString();
        const firstName = message.from.first_name || "User";
        const botToken = req.params.botToken;

        // --- INSERT ADMIN TOGGLE HERE ---
        // If you are the admin, but you DON'T type /admin,
        // the code will skip this and let you use the AI like a normal user.
        if (tgId === env.ADMIN_TELEGRAM_ID) {
            if (message.text === '/admin') {
                const adminText = "🛠 **Admin Control Center**\n\n/sync_products - Update AI Knowledge\n/stats - View system usage";
                // We use 'return' so the bot stops here and doesn't send the AI response too.
                await sendMessage(botToken, tgId, adminText);
                return res.sendStatus(200);
            }
        }

        // 1. AUTO-REGISTRATION LOGIC
        let userRef = db.collection('users').doc(tgId);
        let userDoc = await userRef.get();

        if (!userDoc.exists) {
            let assignedLeader = "L5422685";
            if (message.text && message.text.startsWith('/start ')) {
                const startParam = message.text.split(' ')[1];
                if (startParam) assignedLeader = startParam;
            }

            await userRef.set({
                firstName,
                telegram_id: tgId,
                leaderId: assignedLeader,
                createdAt: new Date()
            });
        }

        // 2. FETCH DATA FOR KEYBOARD AND AI
        const userData = (await userRef.get()).data();

        if (!userData || !userData.leaderId) {
            console.error("Missing leader data for:", tgId);
            return res.sendStatus(200);
        }

        const leaderDoc = await db.collection('leaders').doc(userData.leaderId).get();
        const leaderData = leaderDoc.data() || {};

        const keyboard = {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: "🛍 Katalog",
                        web_app: {
                            url: `https://ersag-ai-bot.web.app/index.html?sponsor=${userData.leaderId}`
                        }
                    }
                ]]
            }
        };

        // 3. AI RESPONSE LOGIC
        if (leaderData.account_status === 'active' && leaderData.tokens > 0) {
            // Forward actual messages to the AI
            await customerBot.handleUpdate(req.body, botToken, userData.leaderId);
        } else {
            await sendMessage(botToken, tgId, "🤖 AI consultant is currently resting. You can still browse the Catalog below.", keyboard);
        }

    } catch (error) {
        console.error("GATEWAY CRASH PREVENTED:", error.message);
    }

    res.sendStatus(200);
}

module.exports = { handleTelegramUpdate };