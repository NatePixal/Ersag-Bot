const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require('../config/db');
const { activateSubscription } = require('../services/subscriptionService');
const logger = require('../utils/logger');

/**
 * Scheduled job: runs every hour to expire leader subscriptions
 * and send 3-day renewal warnings.
 */
exports.checkSubscriptions = onSchedule('every 24 hours', async (event) => {
        logger.info('[SubscriptionJob] Running subscription expiry checks...');
        const now = new Date();
        
        try {
            const leadersSnap = await db.collection('leaders').get();
            
            for (const doc of leadersSnap.docs) {
                const data = doc.data();
                const leaderId = doc.id;
                
                if (!data.subscription_expiry) continue;
                
                const expiry = new Date(data.subscription_expiry);
                const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
                
                // 3-day warning
                if (daysUntilExpiry === 3) {
                    logger.info(`[SubscriptionJob] 3-day warning for leader ${leaderId}`);
                    await db.collection('leader_notifications').add({
                        leader_id: leaderId,
                        type: 'expiry_warning_3d',
                        sent_at: now.toISOString()
                    });
                    // TODO: Send Telegram message to leader via MASTER_BOT
                }
                
                // Mark expired (beyond grace period of 3 days)
                const graceEnded = new Date(expiry);
                graceEnded.setDate(graceEnded.getDate() + 3);
                
                if (now > graceEnded && data.subscription_active !== false) {
                    await doc.ref.update({ subscription_active: false });
                    logger.info(`[SubscriptionJob] Expired leader ${leaderId}`);
                }
            }
            
            logger.info('[SubscriptionJob] Completed.');
        } catch (err) {
            logger.error('[SubscriptionJob] Error:', err);
        }
    });
