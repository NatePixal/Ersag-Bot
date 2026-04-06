const logger = require('../utils/logger');
const identityResolver = require('./identityResolver');
const quotaService = require('../services/quotaService');
const botRegistry = require('../services/botRegistryService');
const telegramApi = require('../utils/telegramApi');
const MENUS = require('./menus');

const routeUpdate = async (update, botToken) => {
    try {
        const message = update.message;
        const callbackQuery = update.callback_query;
        
        if (!message && !callbackQuery) return;

        const telegramUserId = String(message ? message.from.id : callbackQuery.from.id);
        const text = message ? (message.text || '').trim() : '';
        const rawText = message ? message.text || '' : '';
        const cbData = callbackQuery ? callbackQuery.data : null;

        // 1. Explicitly intercept the Master/Hub Bot
        const env = require('../config/env');
        if (env.MASTER_BOT_TOKEN && botToken === env.MASTER_BOT_TOKEN) {
            logger.info(`[Route: MasterBot] Intercepting traffic and mapping to Leader Hub for user ${telegramUserId}`);
            // Check if admin commands first
            if (env.ADMIN_CHAT_ID && telegramUserId === env.ADMIN_CHAT_ID && text.startsWith('/')) {
                return require('../agents/adminAgent').run(update, botToken);
            }
            return require('../bots/leaderHubBot').run(update, botToken);
        }

        // 2. Resolve user identity for Standard Tenant Bots
        const role = await identityResolver.resolveRole(telegramUserId, botToken); // will be 'customer'
        const botOwnerId = await botRegistry.getBotOwner(botToken);
        const lang = identityResolver.resolveLang(message ? message.from : callbackQuery.from);
        const M = lang === 'ru' ? MENUS.CUSTOMER_RU : MENUS.CUSTOMER_UZ;
        
        logger.info(`[Bot resolved: ${botOwnerId ? botOwnerId : 'unknown'}]`);
        logger.info(`[Identity: ${role}, Lang: ${lang}]`);

        // ── Step 3: Global /start command ────────────────────────────────────
        if (text.startsWith('/start')) {
            const parts = text.split(' ');
            if (parts.length > 1) {
                const referral = parts[1];
                logger.info(`[Referral Catch] User ${telegramUserId} used referral ${referral}`);
                try {
                    const { db } = require('../config/db');
                    await db.collection('customer_referrals').doc(telegramUserId).set({
                        referral_code: referral,
                        bot_token: botToken,
                        joined_at: new Date().toISOString()
                    }, { merge: true });
                } catch (e) { logger.error('Failed to store referral', e); }
            }
            
            const botType = await botRegistry.getBotType(botToken);
            if (botType === 'billing') {
                return require('../agents/billingAgent').run(update, botToken);
            } else if (botType === 'support') {
                return require('../agents/supportAgent').run(update, botToken);
            } else {
                return require('../agents/leadAgent').run(update, botToken); // Includes lang prompt
            }
        }

        // ── Quota Check (Tenant bots only) ──────────────────────────────────
        let hasQuota = true;
        if (botOwnerId) {
            const subscriptionService = require('../services/subscriptionService');
            const subscriptionState = await subscriptionService.checkLeaderAccess(botOwnerId);
            
            if (!subscriptionState.active) {
                logger.warn(`[Subscription EXPIRED] Leader ${botOwnerId} — AI blocked`);
                return telegramApi.sendMessage(botToken, telegramUserId,
                    "⚠️ Bu konsultant hozircha vaqtincha mavjud emas.\n" +
                    "This consultant is temporarily unavailable."
                );
            }
            hasQuota = await quotaService.checkQuota(botOwnerId);
            if (hasQuota) {
                await quotaService.incrementUsage(botOwnerId);
            }
        }

        // Callback data routing (for inline buttons)
        if (callbackQuery) {
            const botType = await botRegistry.getBotType(botToken);
            if (botType === 'billing') return require('../agents/billingAgent').run(update, botToken);
            if (botType === 'support') return require('../agents/supportAgent').run(update, botToken);
            
            // Standard callbacks
            if (cbData.startsWith('lang_')) return require('../agents/leadAgent').run(update, botToken);
            if (cbData.startsWith('consult_') || cbData === 'cancel_consult') return require('../agents/doctorAgent').run(update, botToken);
            
            return telegramApi.answerCallbackQuery(botToken, callbackQuery.id);
        }

        // ── Routing by botType ───────────────────────────────────────────────
        const botType = await botRegistry.getBotType(botToken);
        if (botType === 'billing') {
            return require('../agents/billingAgent').run(update, botToken);
        }
        if (botType === 'support') {
            return require('../agents/supportAgent').run(update, botToken);
        }

        // ── Sales Agent Menus & Fallbacks (Exact Match Routing) ──────────────
        
        // Exact Button Matches
        switch (text) {
            case M.PORTAL:
            case M.CATALOG:
            case M.VIP:
            case M.REGISTER:
            case M.ADMIN:
            case M.HEALTH:
            case M.BEAUTY:
            case M.CLEANING:
                // Handled natively by leadAgent's static logic
                return require('../agents/leadAgent').run(update, botToken);
            
            case M.POST:
            case M.CONSULT:
            case M.DOCTOR:
                return require('../agents/doctorAgent').run(update, botToken);
                
            case M.PRODUCT_CODE:
                return telegramApi.sendMessage(botToken, telegramUserId, "Mahsulot kodini kiriting (Masalan, ERG-201):");
        }

        // No quota for free text → Fallback lead conversion
        if (!hasQuota && text) {
            const leadService = require('../services/leadService');
            const name = message ? message.from.first_name : 'Mijoz';
            await leadService.captureLead(botToken, telegramUserId, { name, phone: 'Limiti tugagan' });
            return telegramApi.sendMessage(botToken, telegramUserId, "Rahmat! Operatorlarimiz tez orada siz bilan bog'lanishadi.");
        }

        // Handlers via Regex/Code Match
        if (require('../agents/productLookupAgent').isProductQuery(text)) {
            return require('../agents/productLookupAgent').run(update, botToken);
        }

        if (message.contact || message.photo) {
            return require('../agents/leadAgent').run(update, botToken);
        }

        // Free text falls through to Sales AI
        logger.info(`[Route: AI Sales] Free text from user ${telegramUserId} passing to AI`);
        
        // New integration using customer.prompt.js
        const { buildCustomerPrompt } = require('../prompts/customer.prompt.js');
        const aiService = require('../agents/aiService');
        const systemPrompt = buildCustomerPrompt(lang);
        const messagesArr = [{ role: 'user', content: text }];
        
        const aiResponse = await aiService.callLLM(messagesArr, systemPrompt);
        await telegramApi.sendMessage(botToken, telegramUserId, aiResponse);
        
    } catch (error) {
        logger.error('Error in routeUpdate:', error);
    }
};

module.exports = { routeUpdate };
