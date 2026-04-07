const botRepo = require('../repositories/botRepository');
const logger = require('../utils/logger');
const crypto = require('crypto');

const registerBot = async (botToken, leaderId, botType = 'sales') => {
    logger.info(`Registering new bot (type: ${botType}) for leader: ${leaderId}`);
    
    // Validate uniqueness
    const existingBot = await botRepo.findBotByToken(botToken);
    if (existingBot) {
        logger.warn('Attempted to register an already existing bot token', { leaderId });
        throw new Error('Bot token is already registered');
    }

    const webhookUuid = crypto.randomUUID();
    
    // Pillar 1: Multi-tenant webhook binding
    const env = require('../config/env');
    const project = process.env.GCLOUD_PROJECT || 'ersag-ai-bot';
    const region = 'us-central1'; // Default Firebase Functions region
    const functionsUrl = env.TELEGRAM_WEBHOOK_URL || `https://${region}-${project}.cloudfunctions.net`;
    const cleanUrl = functionsUrl.endsWith('/') ? functionsUrl.slice(0, -1) : functionsUrl;
    
    const webhookUrl = `${cleanUrl}/telegramGateway?id=${webhookUuid}`;
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
        if (!response.ok) {
            logger.error(`SetWebhook Failed: ${botToken}`);
        }
    } catch (err) {
        logger.error(`Error setting webhook`, err);
    }
    
    const botData = {
        bot_token: botToken,
        leader_id: leaderId,
        bot_type: botType, // sales, billing, support
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

const getBotType = async (botToken) => {
    const bot = await botRepo.findBotByToken(botToken);
    if (!bot) return 'sales'; // sensible default
    return bot.bot_type || 'sales';
};

module.exports = {
    registerBot,
    getBotOwner,
    getBotType,
    isActiveBot,
    getBotByTenantId
};
