const { db } = require('../config/db');
const logger = require('../utils/logger');

const GRACE_PERIOD_DAYS = 3;

/**
 * Returns { active: true/false, status: 'active'|'grace'|'expired' }
 * for any given leaderId (bot owner).
 */
const checkLeaderAccess = async (leaderId) => {
    if (!leaderId) return { active: false, status: 'expired' };
    
    try {
        const leaderDoc = await db.collection('leaders').doc(String(leaderId)).get();
        
        // If leader hasn't set up a paid profile yet, check if they're the platform owner
        if (!leaderDoc.exists) {
            logger.warn(`[Subscription] No leader profile for ${leaderId}. Defaulting to active for initial setup.`);
            return { active: true, status: 'active' }; // Allow during onboarding
        }
        
        const data = leaderDoc.data();
        
        // Never-expiring admin override
        if (data.is_admin === true) return { active: true, status: 'active' };
        
        const now = new Date();
        const expiry = data.subscription_expiry ? new Date(data.subscription_expiry) : null;
        
        if (!expiry) {
            // Treat new leaders as active until first expiry is set
            return { active: true, status: 'active' };
        }
        
        if (now <= expiry) {
            return { active: true, status: 'active' };
        }
        
        // Grace period: 3 days after expiry
        const graceUntil = new Date(expiry);
        graceUntil.setDate(graceUntil.getDate() + GRACE_PERIOD_DAYS);
        
        if (now <= graceUntil) {
            return { active: true, status: 'grace' };
        }
        
        return { active: false, status: 'expired' };
    } catch (err) {
        logger.error(`[Subscription] Check failed for ${leaderId}:`, err);
        return { active: true, status: 'active' }; // Fail open to avoid blocking on DB errors
    }
};

/**
 * Activates or extends a leader's subscription by 30 days.
 */
const activateSubscription = async (leaderId, planName = 'monthly') => {
    const leaderRef = db.collection('leaders').doc(String(leaderId));
    const leaderDoc = await leaderRef.get();
    
    const now = new Date();
    let newExpiry = new Date(now);
    
    if (leaderDoc.exists) {
        const currentExpiry = leaderDoc.data().subscription_expiry
            ? new Date(leaderDoc.data().subscription_expiry)
            : now;
        
        // Extend from existing expiry if still active, else from today
        const base = currentExpiry > now ? currentExpiry : now;
        newExpiry = new Date(base);
        newExpiry.setDate(newExpiry.getDate() + 30);
    } else {
        newExpiry.setDate(newExpiry.getDate() + 30);
    }
    
    await leaderRef.set({
        subscription_active: true,
        subscription_expiry: newExpiry.toISOString(),
        plan: planName,
        updated_at: now.toISOString()
    }, { merge: true });
    
    logger.info(`[Subscription] Leader ${leaderId} activated until ${newExpiry.toISOString()}`);
    return newExpiry;
};

module.exports = { checkLeaderAccess, activateSubscription };
