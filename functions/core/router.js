const logger = require('../utils/logger');
const identityResolver = require('./identityResolver');
const quotaService = require('../services/quotaService');
const botRegistry = require('../services/botRegistryService');
const telegramApi = require('../utils/telegramApi');

const routeUpdate = async (update, botToken) => {
    try {
        const message = update.message;
        const callbackQuery = update.callback_query;
        
        if (!message && !callbackQuery) return;

        const telegramUserId = message ? message.from.id : callbackQuery.from.id;
        const text = message ? (message.text || '').toLowerCase() : '';
        const rawText = message ? message.text || '' : '';
        const cbData = callbackQuery ? callbackQuery.data : null;

        // 1. Explicitly intercept the Master/Hub Bot
        const env = require('../config/env');
        if (env.MASTER_BOT_TOKEN && botToken === env.MASTER_BOT_TOKEN) {
            logger.info(`[Route: MasterBot] Intercepting traffic and mapping to Leader Hub for user ${telegramUserId}`);
            return require('../bots/leaderHubBot').run(update, botToken);
        }

        // 2. Resolve user identity for Standard Tenant Bots
        const role = await identityResolver.resolveRole(telegramUserId, botToken);
        const botOwnerId = await botRegistry.getBotOwner(botToken);
        
        logger.info(`[Bot resolved: ${botOwnerId ? botOwnerId : 'unknown'}]`);
        logger.info(`[Identity: ${role}]`);

        // Intercept Language and /start global commands
        if (rawText.startsWith('/start')) {
            const parts = rawText.split(' ');
            if (parts.length > 1) {
                const referral = parts[1]; // e.g. L5422685
                logger.info(`[Referral Catch] User ${telegramUserId} used referral ${referral}`);
                // Store the referral so we can track which leader brought this customer
                try {
                    const { db } = require('../config/db');
                    await db.collection('customer_referrals').doc(String(telegramUserId)).set({
                        referral_code: referral,
                        bot_token: botToken,
                        joined_at: new Date().toISOString()
                    }, { merge: true });
                } catch (e) { logger.error('Failed to store referral', e); }
            }
            
            // Send language selection
            const langMarkup = {
                inline_keyboard: [
                    [{ text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" }, { text: "🇷🇺 Русский", callback_data: "lang_ru" }]
                ]
            };
            await telegramApi.sendMessage(botToken, telegramUserId, "Assalomu alaykum! / Здравствуйте!\n\nTilni tanlang: / Выберите язык:", langMarkup);
            logger.info(`[Route: System] Requested language choice from ${telegramUserId}`);
            return;
        }

        // Intercept billing keywords
        if (rawText === 'Top up balance' || rawText === '/billing') {
            return require('../bots/billingBot').run(update, botToken);
        }

        // Quota check
        let hasQuota = true;
        if (botOwnerId && role === 'customer') {
            // Phase 3: Subscription enforcement — check leader subscription FIRST
            const subscriptionService = require('../services/subscriptionService');
            const subscriptionState = await subscriptionService.checkLeaderAccess(botOwnerId);
            
            if (!subscriptionState.active) {
                // Leader subscription expired — block AI, show graceful message
                logger.warn(`[Subscription EXPIRED] Leader ${botOwnerId} — blocking AI for user ${telegramUserId}`);
                await telegramApi.sendMessage(botToken, telegramUserId,
                    "⚠️ Bu konsultant hozircha vaqtincha mavjud emas. Iltimos, keyinroq urinib ko'ring.\n\n" +
                    "This consultant is temporarily unavailable. Please try again later."
                );
                return;
            }
            
            if (subscriptionState.status === 'grace') {
                logger.warn(`[Subscription GRACE] Leader ${botOwnerId} is in grace period`);
                // Still works — leader just gets a gentle warning via the leader bot separately
            }
            
            hasQuota = await quotaService.checkQuota(botOwnerId);
            if (!hasQuota) {
                logger.warn(`[Quota EXCEEDED] Leader ${botOwnerId} has no quota left.`);
            } else {
                logger.info(`[Quota OK] Leader ${botOwnerId} has available quota.`);
                await quotaService.incrementUsage(botOwnerId);
            }
        }

        // Basic Intent Classification
        let intent = role; 
        if (role === 'customer') {
            if (!hasQuota) {
                intent = 'fallback'; // Bypass AI entirely
            } else if (text.includes('qimmat') || text.includes('qanaqa') || text.includes('дорого') || text.includes('expensive')) {
                intent = 'hesitant';
            } else if (text.includes('yordam') || text.includes('savol') || text.includes('помощь') || text.includes('вопрос') || text.includes('narx') || text.includes('цена') || text.includes('dostavka') || text.includes('доставка')) {
                intent = 'help';
            }
        }

        // Routing Execution
        logger.info(`[Route: ${intent}Agent] Routing update from user ${telegramUserId}`);

        switch(intent) {
            case 'fallback':
                const leadService = require('../services/leadService');
                const name = message ? message.from.first_name : 'Mijoz';
                await leadService.captureLead(botToken, telegramUserId, { name, phone: 'No quota' });
                await telegramApi.sendMessage(botToken, telegramUserId, "Rahmat! Operatorlarimiz tez orada siz bilan bog'lanishadi.");
                logger.info('[Reply sent] Fallback response for out-of-quota customer.');
                return;
            case 'admin':
                return require('../agents/adminAgent').run(update, botToken);
            case 'leader':
                return require('../agents/leaderAgent').run(update, botToken);
            case 'hesitant':
                return require('../agents/salesAgent').run(update, botToken);
            case 'help':
                return require('../agents/supportAgent').run(update, botToken);
            case 'customer':
            default:
                return require('../agents/leadAgent').run(update, botToken);
        }
    } catch (error) {
        logger.error('Error in routeUpdate:', error);
    }
};

module.exports = { routeUpdate };
