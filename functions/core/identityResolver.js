const botRegistryService = require('../services/botRegistryService');
const env = require('../config/env');
const logger = require('../utils/logger');

const resolveRole = async (telegramUserId, botToken) => {
    logger.info(`Resolving role for user ${telegramUserId}`);

    // 1. Check Admin
    if (env.ADMIN_CHAT_ID && String(telegramUserId) === String(env.ADMIN_CHAT_ID)) {
        return 'admin';
    }

    // 2. Check if the user is the Leader (owner of the bot they are messaging)
    const botOwnerId = await botRegistryService.getBotOwner(botToken);
    if (botOwnerId && String(telegramUserId) === String(botOwnerId)) {
        return 'leader';
    }

    // 3. Default to Customer
    return 'customer';
};

module.exports = {
    resolveRole
};
