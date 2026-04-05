const telegramApi = require('../utils/telegramApi');
const { db } = require('../config/db');
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * Sends a formatted lead notification to the leader's private group.
 * Also mirrors a copy to the Admin Group so the platform owner sees everything.
 */
const notifyLeaderNewLead = async (botToken, leaderId, leadData) => {
    try {
        // Load leader profile to get the lead_group_id
        const leaderDoc = await db.collection('leaders').doc(String(leaderId)).get();
        
        const message = formatLeadMessage(leadData, leaderDoc.data());
        
        // 1. Send to Leader's private lead group
        if (leaderDoc.exists && leaderDoc.data().lead_group_id) {
            const leadGroupId = leaderDoc.data().lead_group_id;
            await telegramApi.sendMessage(botToken, leadGroupId, message);
            logger.info(`[Lead Notified] Sent lead to leader group ${leadGroupId} for leader ${leaderId}`);
        } else {
            logger.warn(`[Lead Notified] Leader ${leaderId} has no lead_group_id configured. Lead stored silently.`);
        }
        
        // 2. Mirror to Admin Group (You always see everything)
        if (env.ADMIN_GROUP_ID) {
            const adminMsg = `📡 *ADMIN MIRROR*\nLeader: \`${leaderId}\`\n\n${message}`;
            await telegramApi.sendMessage(botToken, env.ADMIN_GROUP_ID, adminMsg);
        }
    } catch (err) {
        logger.error(`[Lead Notified] Failed to notify leader ${leaderId}:`, err);
    }
};

const formatLeadMessage = (leadData, leaderConfig) => {
    const leaderName = leaderConfig?.name || 'Sizning botingiz';
    return (
        `🔥 *YANGI LEAD*\n` +
        `──────────────\n` +
        `👤 *Ism:* ${leadData.name}\n` +
        `📞 *Telefon:* ${leadData.phone}\n` +
        (leadData.interest ? `❤️ *Qiziqish:* ${leadData.interest}\n` : '') +
        (leadData.problem ? `💬 *Muammo:* ${leadData.problem}\n` : '') +
        `──────────────\n` +
        `🤖 Vositachi: ${leaderName}\n` +
        `🕐 ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`
    );
};

module.exports = { notifyLeaderNewLead };
