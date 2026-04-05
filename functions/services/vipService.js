const telegramApi = require('../utils/telegramApi');
const { db } = require('../config/db');
const botRegistry = require('../services/botRegistryService');
const logger = require('../utils/logger');

/**
 * VIP Auto-Invite Service
 * 
 * When a customer has been verified (lead captured + subscription active),
 * send them a direct invite link to their assigned leader's VIP group.
 * 
 * Telegram does NOT allow bots to add people to private groups directly.
 * The correct approach: bot generates and sends the invite LINK.
 * Leader must have the group's invite link with "approve_join_request" or
 * an open invite link stored during their onboarding.
 */

/**
 * Send VIP invite to a user based on their assigned leader.
 * Call this after a payment success or when admin manually triggers.
 */
const sendVipInvite = async (botToken, chatId, telegramUserId) => {
    try {
        const leaderId = await botRegistry.getBotOwner(botToken);
        if (!leaderId) {
            logger.warn(`[VIP] No leader found for bot — skipping VIP invite for user ${telegramUserId}`);
            return;
        }
        
        const leaderDoc = await db.collection('leaders').doc(String(leaderId)).get();
        if (!leaderDoc.exists) {
            logger.warn(`[VIP] Leader ${leaderId} has no profile — skipping VIP invite`);
            return;
        }
        
        const leaderData = leaderDoc.data();
        const vipLink = leaderData.vip_group;
        
        if (!vipLink) {
            logger.warn(`[VIP] Leader ${leaderId} has no vip_group configured`);
            await telegramApi.sendMessage(botToken, chatId,
                "✅ Siz muvaffaqiyatli tasdiqlangiz! VIP guruh tez orada ulashiladi."
            );
            return;
        }
        
        const markup = {
            inline_keyboard: [[
                { text: "🌟 VIP Guruhga Qo'shilish", url: vipLink }
            ]]
        };
        
        await telegramApi.sendMessage(botToken, chatId,
            "🎉 *Tabriklaymiz!*\n\n" +
            "Siz endi VIP a'zosiz!\n\n" +
            "Quyidagi tugma orqali *maxsus yopiq guruhga* kiring — " +
            "bu yerda maxsus treninglar, chegirmalar va jamoa bilan muloqot mavjud:", 
            markup
        );
        
        logger.info(`[VIP] Sent VIP invite to user ${telegramUserId} via leader ${leaderId}`);
        
        // Mark in user record
        await db.collection('customer_referrals').doc(String(telegramUserId)).set({
            vip_invited: true,
            vip_invited_at: new Date().toISOString()
        }, { merge: true });
        
    } catch (err) {
        logger.error('[VIP] Failed to send invite:', err);
    }
};

/**
 * Handle chat_join_request events.
 * When a user requests to join the VIP group, auto-approve them.
 * Requires bot to be admin of the group.
 */
const handleJoinRequest = async (update, botToken) => {
    const joinRequest = update.chat_join_request;
    if (!joinRequest) return;
    
    const chatId = joinRequest.chat.id;
    const userId = joinRequest.from.id;
    const firstName = joinRequest.from.first_name || 'Foydalanuvchi';
    
    try {
        // Auto-approve the join request
        await telegramApi.approveChatJoinRequest(botToken, chatId, userId);
        
        // Send welcome DM to the new member
        const welcomeMsg = `🌿 Xush kelibsiz, *${firstName}*!\n\nSiz ERSAG VIP jamoasiga qo'shildingiz.\n\nBu yerda siz:\n✅ Maxsus chegirmalar\n✅ Treninglar va videodarslar\n✅ Jamoa a'zolari bilan muloqot\n\ndan foydalanishingiz mumkin. Muvaffaqiyatlar! 🚀`;
        
        await telegramApi.sendMessage(botToken, userId, welcomeMsg);
        logger.info(`[VIP] Auto-approved and welcomed user ${userId} to group ${chatId}`);
        
    } catch (err) {
        logger.error(`[VIP] Failed to approve join request for user ${userId}:`, err);
    }
};

module.exports = { sendVipInvite, handleJoinRequest };
