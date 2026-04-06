const botRegistryService = require('../services/botRegistryService');
const env = require('../config/env');
const logger = require('../utils/logger');

const resolveRole = async (telegramUserId, botToken) => {
    logger.info(`Resolving role for user ${telegramUserId} on bot ${botToken.substring(0, 8)}...`);

    const isMasterBot = (botToken === env.MASTER_BOT_TOKEN);

    // 1. Check Admin (Only valid on the Master Bot)
    if (isMasterBot && env.ADMIN_CHAT_ID && String(telegramUserId) === String(env.ADMIN_CHAT_ID)) {
        return 'admin';
    }

    // 2. Check Leader (Only valid on the Master Bot)
    if (isMasterBot) {
        const { db } = require('../config/db');
        const leaderDoc = await db.collection('leaders').doc(String(telegramUserId)).get();
        if (leaderDoc.exists) {
            return 'leader';
        }
    }

    // 3. Default to Customer (All traffic on Tenant bots defaults to customer)
    return 'customer';
};

const resolveLang = (telegramUser) => {
    // Currently relying mostly on user selection or tg language_code
    return telegramUser?.language_code === 'ru' ? 'ru' : 'uz';
};

module.exports = {
    resolveRole,
    resolveLang
};
