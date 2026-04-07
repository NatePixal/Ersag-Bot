// functions/bots/leaderHubBot.js
const telegramApi = require('../utils/telegramApi');
const { db } = require('../config/db');
const env = require('../config/env');

async function handleUpdate(update, botToken) {
    const message = update.message;
    const userId = String(message.from.id);
    const text = message.text;

    // Check State
    const leaderDoc = await db.collection('leaders').doc(userId).get();
    const state = leaderDoc.exists ? leaderDoc.data().onboarding_step : 'START';

    if (text === '/start') {
        await db.collection('leaders').doc(userId).set({ onboarding_step: 'AWAITING_TOKEN' }, { merge: true });
        return telegramApi.sendMessage(botToken, userId, "Welcome Leader! Please send your **Bot Token** from @BotFather:");
    }

    if (state === 'AWAITING_TOKEN') {
        await db.collection('leaders').doc(userId).update({ botToken: text, onboarding_step: 'COMPLETED' });
        return telegramApi.sendMessage(botToken, userId, "Token Saved! Now open the Mini App to choose your package.");
    }

    // Handle Screenshot for Top-up
    if (message.photo) {
        const photoId = message.photo[message.photo.length - 1].file_id;
        await db.collection('payments').add({
            leaderId: userId,
            photoId: photoId,
            status: 'pending',
            createdAt: new Date()
        });
        
        // Notify YOU in the Admin Bot
        await telegramApi.sendMessage(env.MASTER_BOT_TOKEN, env.ADMIN_TELEGRAM_ID, `💰 New Payment from ${userId}. Check Admin Panel.`);
        return telegramApi.sendMessage(botToken, userId, "Screenshot sent! Wait for Admin approval.");
    }
}

module.exports = { handleUpdate };