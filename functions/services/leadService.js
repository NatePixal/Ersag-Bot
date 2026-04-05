const { db } = require('../config/db');
const botRegistry = require('./botRegistryService');
const quotaService = require('./quotaService');
const logger = require('../utils/logger');

// Store captured leads
const captureLead = async (botToken, telegramUserId, leadData) => {
    const leaderId = await botRegistry.getBotOwner(botToken);
    if (!leaderId) throw new Error('Unknown leader');

    const hasQuota = await quotaService.checkQuota(leaderId);
    
    const leadRecord = {
        name: leadData.name,
        phone: leadData.phone,
        leader_id: leaderId,
        telegram_user_id: telegramUserId,
        status: hasQuota ? 'delivered' : 'pending',
        created_at: new Date().toISOString()
    };
    
    const docRef = await db.collection('leads').add(leadRecord);
    
    if (hasQuota) {
        logger.info(`Sending lead ${leadData.name} to leader ${leaderId}`);
    } else {
        logger.info(`Lead locked for leader ${leaderId} due to quota`);
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

const flushPendingLeads = async (leaderId) => {
    const pendingLeads = await getPendingLeads(leaderId);
    if (pendingLeads.length === 0) return;

    logger.info(`Flushing ${pendingLeads.length} leads for leader ${leaderId}`);
    const batch = db.batch();
    pendingLeads.forEach(lead => {
        batch.update(db.collection('leads').doc(lead.id), { status: 'delivered' });
    });
    await batch.commit();
};

module.exports = { captureLead, getPendingLeads, flushPendingLeads };
