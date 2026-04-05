const botRepo = require('../repositories/botRepository');
const logger = require('../utils/logger');
const crypto = require('crypto');

const registerBot = async (botToken, leaderId) => {
    logger.info(`Registering new bot for leader: ${leaderId}`);
    
    // Validate uniqueness
    const existingBot = await botRepo.findBotByToken(botToken);
    if (existingBot) {
        logger.warn('Attempted to register an already existing bot token', { leaderId });
        throw new Error('Bot token is already registered');
    }

    const webhookUuid = crypto.randomUUID();
    
    const botData = {
        bot_token: botToken,
        leader_id: leaderId,
        status: 'active',
        webhook_uuid: webhookUuid,
        created_at: new Date().toISOString()
    };
    
    return await botRepo.createBot(botData);
};

const getBotOwner = async (botToken) => {
    const bot = await botRepo.findBotByToken(botToken);
    if (!bot) return null;
    return bot.leader_id;
};

const isActiveBot = async (botToken) => {
    const bot = await botRepo.findBotByToken(botToken);
    return bot !== null && bot.status === 'active';
};

const getBotByTenantId = async (tenantId) => {
    return await botRepo.findBotByUuid(tenantId);
};

module.exports = {
    registerBot,
    getBotOwner,
    isActiveBot,
    getBotByTenantId
};
