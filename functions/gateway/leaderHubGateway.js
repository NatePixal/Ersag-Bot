const { db } = require('../config/db');
const { sendMessage, sendPhoto, answerCallbackQuery, editMessageReplyMarkup } = require('../utils/telegramApi');
const env = require('../config/env');

async function handleLeaderHubUpdate(req, res) {
    const botToken = req.params.botToken;

    // ==========================================
    // 1. ADMIN LOGIC (You clicking the buttons)
    // ==========================================
    if (req.body.callback_query) {
        const cb = req.body.callback_query;
        const action = cb.data;

        // Stop the loading spinner on the button immediately!
        await answerCallbackQuery(botToken, cb.id);

        if (cb.from.id.toString() === env.ADMIN_TELEGRAM_ID) {
            const targetLeaderId = action.split('_')[1]; // Gets "L12345"
            const rawTgId = targetLeaderId.replace('L', ''); // Gets "12345"

            if (action.startsWith('approve_')) {
                // 1. Update Database
                await db.collection('leaders').doc(targetLeaderId).set({
                    account_status: 'active',
                    tokens: 100,
                    updatedAt: new Date()
                }, { merge: true });

                // 2. Notify Admin & Leader
                await sendMessage(botToken, env.ADMIN_TELEGRAM_ID, `✅ Lider ${targetLeaderId} faollashtirildi!`);
                await sendMessage(botToken, rawTgId, "🎉 Tabriklaymiz! To'lovingiz tasdiqlandi. Hisobingiz faol va sizga 100 ta AI token berildi.");
            }

            if (action.startsWith('reject_')) {
                await sendMessage(botToken, env.ADMIN_TELEGRAM_ID, `❌ Lider ${targetLeaderId} rad etildi.`);
                await sendMessage(botToken, rawTgId, "❌ Kechirasiz, to'lovingiz rad etildi. Iltimos, admin bilan bog'laning.");
            }

            // Remove the buttons from the photo so you don't double-click
            if (cb.message) {
                await editMessageReplyMarkup(botToken, cb.message.chat.id, cb.message.message_id);
            }
        }
        return res.sendStatus(200);
    }

    // ==========================================
    // 2. LEADER LOGIC (Sending texts/photos)
    // ==========================================
    const { message } = req.body;
    if (!message) return res.sendStatus(200);

    const leaderTgId = message.from.id.toString();
    const leaderDocId = "L" + leaderTgId; 

    // If Leader sends a Payment Receipt (Photo)
    if (message.photo) {
        const photoId = message.photo[message.photo.length - 1].file_id;
        const caption = `💰 **Yangi To'lov!**\n\nLider: ${leaderDocId}\nIsm: ${message.from.first_name || "Lider"}`;

        const adminKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Tasdiqlash", callback_data: `approve_${leaderDocId}` }],
                    [{ text: "❌ Rad etish", callback_data: `reject_${leaderDocId}` }]
                ]
            }
        };

        // Send photo to Admin
        await sendPhoto(botToken, env.ADMIN_TELEGRAM_ID, photoId, caption, adminKeyboard);
        // Reply to Leader
        await sendMessage(botToken, leaderTgId, "✅ Chek qabul qilindi. Admin tasdiqlashi kutilmoqda...");
        return res.sendStatus(200);
    }

    // Normal Menus
    if (message.text === '/start') {
        const keyboard = {
            reply_markup: {
                keyboard: [
                    [{ text: "🔗 Mening Linkim" }, { text: "💳 To'lov" }],
                    [{ text: "👨‍💻 Admin bilan bog'lanish" }]
                ], resize_keyboard: true
            }
        };
        await sendMessage(botToken, leaderTgId, "Leader Hub-ga xush kelibsiz! Kerakli bo'limni tanlang:", keyboard);
    }

    if (message.text === "🔗 Mening Linkim") {
        await sendMessage(botToken, leaderTgId, `Mana sizning shaxsiy havolangiz:\n\n<code>https://t.me/ersag_ai_bot?start=${leaderDocId}</code>\n\nUshbu link orqali kirgan mijozlar sizga biriktiriladi.`, { parse_mode: 'HTML' });
    }

    if (message.text === "💳 To'lov") {
        await sendMessage(botToken, leaderTgId, "💳 Tarifni faollashtirish uchun to'lov qiling va chekni (skrinshot) shu yerga yuboring.");
    }

    if (message.text === "👨‍💻 Admin bilan bog'lanish") {
        await sendMessage(botToken, leaderTgId, "Savollaringiz bormi?", { reply_markup: { inline_keyboard: [[{ text: "📩 Admin bilan gaplashish", url: "https://t.me/MSU_Berdibekov" }]] } });
    }

    res.sendStatus(200);
}

module.exports = { handleLeaderHubUpdate };