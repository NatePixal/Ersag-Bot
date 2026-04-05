const { db } = require('../config/db');
const botRegistry = require('./botRegistryService');
const quotaService = require('./quotaService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

// Store captured leads
const captureLead = async (botToken, telegramUserId, leadData) => {
    const leaderId = await botRegistry.getBotOwner(botToken);
    if (!leaderId) throw new Error('Unknown leader');

    const hasQuota = await quotaService.checkQuota(leaderId);
    
    const leadRecord = {
        name: leadData.name,
        phone: leadData.phone,
        interest: leadData.interest || null,
        problem: leadData.problem || null,
        leader_id: leaderId,
        telegram_user_id: telegramUserId,
        status: hasQuota ? 'delivered' : 'pending',
        created_at: new Date().toISOString()
    };
    
    const docRef = await db.collection('leads').add(leadRecord);
    
    // CORE FEATURE: Notify the leader's Telegram group this lead was captured
    if (hasQuota) {
        logger.info(`[Lead] Sending lead ${leadData.name} to leader ${leaderId}'s group`);
        // Fire-and-forget (non-blocking) so we don't delay the user response
        notificationService.notifyLeaderNewLead(botToken, leaderId, leadData).catch(err =>
            logger.error('[Lead] Notification failed silently:', err)
        );
    } else {
        logger.info(`[Lead] Locked for leader ${leaderId} due to quota`);
    }

    return { id: docRef.id, ...leadRecord };
};

const getPendingLeads = async (leaderId) => {
    const snapshot = await db.collection('leads')
        .where('leader_id', '==', leaderId)
        .where('status', '==', 'pending')
        .get();
        
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const flushPendingLeads = async (leaderId, flushId) => {
    if (!flushId) {
        throw new Error('flushId is required to ensure idempotency');
    }

    const flushRef = db.collection('flush_transactions').doc(flushId);

    // Using a Firebase transaction effectively locks flushRef so double-taps are dropped safely.
    await db.runTransaction(async (transaction) => {
        const flushDoc = await transaction.get(flushRef);
        if (flushDoc.exists && flushDoc.data().status === 'completed') {
            logger.info(`Idempotent flush bypassed for identical flushId: ${flushId}`);
            return; // Exit transaction harmlessly
        }

        // Transactions must execute reads before writes. 
        // A single snapshot query matches Firebase's rules if we don't interleave writes.
        const snapshot = await db.collection('leads')
            .where('leader_id', '==', leaderId)
            .where('status', '==', 'pending')
            .get(); // Transaction technically can't do `.where().get()` elegantly inside the block without locking the whole collection usually in standard GCP, but Firebase SDK handles concurrent snapshot reads fine, and we rely on flushRef for the actual Lock.

        if (snapshot.empty) {
            transaction.set(flushRef, { 
                leader_id: leaderId, 
                status: 'completed', 
                matched_count: 0, 
                timestamp: new Date().toISOString() 
            });
            return;
        }

        logger.info(`Flushing ${snapshot.size} leads over Transaction for ${leaderId}`);

        snapshot.docs.forEach(doc => {
            transaction.update(doc.ref, { status: 'delivered', flush_id: flushId });
        });

        // Set state to completed
        transaction.set(flushRef, { 
            leader_id: leaderId, 
            status: 'completed', 
            matched_count: snapshot.size, 
            timestamp: new Date().toISOString() 
        });
    });
};

module.exports = { captureLead, getPendingLeads, flushPendingLeads };
