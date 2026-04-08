// functions/bots/customerBot.js
const aiService = require('../agents/aiService');
const telegramApi = require('../utils/telegramApi');
const { db, admin } = require('../config/db');

async function handleUpdate(update, botToken, ownerId) {
    const message = update.message;
    const userId = String(message.from.id);
    const text = message.text;

    // 1. Check Leader Balance
    const leader = (await db.collection('leaders').doc(ownerId).get()).data();
    
    if (!leader || leader.tokens <= 0) {
        return telegramApi.sendMessage(botToken, userId, "The AI Consultant is currently resting. You can still browse the Catalog below!");
    }

    // 2. AI Consultation
    if (text && !text.startsWith('/')) {
        const answer = await aiService.generateResponse(text, leader.language || 'uz', ownerId);
        
        // Deduct 1 token
        await db.collection('leaders').doc(ownerId).update({
            tokens: admin.firestore.FieldValue.increment(-1)
        });

        return telegramApi.sendMessage(botToken, userId, answer);
    }
    
    // 3. Main Menu (Start)
    return telegramApi.sendMessage(botToken, userId, "Welcome to Ersag! How can I help you today?", {
        keyboard: [[{ text: "🛍 Catalog" }, { text: "💬 Ask AI" }]]
    });
}

module.exports = { handleUpdate };