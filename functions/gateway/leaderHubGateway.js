const { sendMessage } = require('../utils/telegramApi');

async function handleLeaderHubUpdate(req, res) {
    const { message, callback_query } = req.body;
    if (!message && !callback_query) return res.sendStatus(200);

    const botToken = req.params.botToken; 
    const from = message ? message.from : callback_query.from;
    const leaderTgId = from.id.toString();
    const leaderDocId = "L" + leaderTgId; 

    // The Magic Link for their customers
    const magicLink = `https://t.me/ersag_ai_bot?start=${leaderDocId}`;

    // 1. Handle /start - Show the Main Menu
    if (message && message.text === '/start') {
        const keyboard = {
            reply_markup: {
                keyboard: [
                    [{ text: "🔗 Mening Linkim" }, { text: "📊 Statistika" }],
                    [{ text: "💳 To'lov" }, { text: "👨‍💻 Admin bilan bog'lanish" }], // Added Support Button
                    [{ text: "⚙️ Sozlamalar" }]
                ],
                resize_keyboard: true
            }
        };
        await sendMessage(botToken, leaderTgId, "Leader Hub-ga xush kelibsiz! Kerakli bo'limni tanlang:", keyboard);
    }

    // 2. Handle "Mening Linkim"
    if (message && message.text === "🔗 Mening Linkim") {
        const text = `Mana sizning shaxsiy havolangiz. Buni mijozlarga ulashing:\n\n\`${magicLink}\`\n\nUshbu link orqali kirgan har bir mijoz sizga biriktiriladi.`;
        await sendMessage(botToken, leaderTgId, text, { parse_mode: 'MarkdownV2' });
    }

    // 3. Handle "Admin bilan bog'lanish" (Support)
    if (message && message.text === "👨‍💻 Admin bilan bog'lanish") {
        const supportText = "Savollaringiz yoki to'lov bo'yicha muammolar bormi? Quyidagi tugmani bosib biz bilan bog'laning:";
        
        const supportKeyboard = {
            reply_markup: {
                inline_keyboard: [[
                    { 
                        text: "📩 Admin bilan gaplashish", 
                        url: "https://t.me/MSU_Berdibekov" // Your Username
                    }
                ]]
            }
        };
        await sendMessage(botToken, leaderTgId, supportText, supportKeyboard);
    }

    res.sendStatus(200);
}

module.exports = { handleLeaderHubUpdate };