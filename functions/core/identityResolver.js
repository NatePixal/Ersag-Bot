// functions/core/identityResolver.js
const env = require('../config/env');
const { db } = require('../config/db');

/**
 * Determines the role of the user and which bot context they are in.
 */
async function resolveIdentity(telegramUserId, botToken) {
    const isMasterBot = (botToken === env.MASTER_BOT_TOKEN);
    const userId = String(telegramUserId);

    // 1. Check if user is the MASTER ADMIN
    if (userId === env.ADMIN_TELEGRAM_ID) {
        return { role: 'admin', botType: isMasterBot ? 'master' : 'customer' };
    }

    // 2. Check if user is a REGISTERED LEADER
    const leaderDoc = await db.collection('leaders').doc(userId).get();
    if (leaderDoc.exists) {
        const leaderData = leaderDoc.data();
        
        // If they are a leader talking to their OWN bot, or the Master Bot
        return { 
            role: 'leader', 
            status: leaderData.account_status || 'active',
            data: leaderData 
        };
    }

    // 3. Default to CUSTOMER
    // We also find which leader owns this specific bot
    const botDoc = await db.collection('bots').where('token', '==', botToken).limit(1).get();
    let ownerId = env.ADMIN_TELEGRAM_ID; // Default to you if bot is unknown
    
    if (!botDoc.empty) {
        ownerId = botDoc.docs[0].data().ownerId;
    }

    return { 
        role: 'customer', 
        ownerId: ownerId 
    };
}

module.exports = { resolveIdentity };