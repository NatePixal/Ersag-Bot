const express = require('express');
const quotaService = require('../../services/quotaService');
const leadService = require('../../services/leadService');
const subscriptionService = require('../../services/subscriptionService');
const sheetsService = require('../../services/sheetsService');
const { db } = require('../../config/db');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
    const leaderId = req.bot.leader_id; 
    try {
        const hasQuota = await quotaService.checkQuota(leaderId);
        const leads = await leadService.getPendingLeads(leaderId);
        const subscription = await subscriptionService.checkLeaderAccess(leaderId);
        
        // Load leader profile for extra info
        const leaderDoc = await db.collection('leaders').doc(String(leaderId)).get();
        const leaderData = leaderDoc.exists ? leaderDoc.data() : {};
        
        res.json({ 
            status: 'success',
            hasQuota,
            pending_lead_count: leads.length,
            subscription_status: subscription.status,
            subscription_expiry: leaderData.subscription_expiry || null,
            leader_name: leaderData.name || '',
            sponsor_id: leaderData.sponsor_id || '',
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get dashboard metrics' });
    }
});

/**
 * Full analytics for the leader dashboard.
 * Returns: total leads, leads today, by status breakdown, user count.
 */
router.get('/analytics', async (req, res) => {
    const leaderId = req.bot.leader_id;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const leadsSnap = await db.collection('leads')
            .where('leader_id', '==', leaderId)
            .orderBy('created_at', 'desc')
            .limit(200)
            .get();
        
        const allLeads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const leadsToday = allLeads.filter(l => new Date(l.created_at) >= today);
        
        // Status breakdown
        const byStatus = allLeads.reduce((acc, lead) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1;
            return acc;
        }, {});
        
        // User count
        const usersSnap = await db.collection('customer_referrals')
            .where('referral_code', '==', String(leaderId))
            .get();
        
        res.json({
            status: 'success',
            total_leads: allLeads.length,
            leads_today: leadsToday.length,
            by_status: byStatus,
            total_users: usersSnap.size,
            recent_leads: allLeads.slice(0, 10) // Last 10 for dashboard preview
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get analytics: ' + err.message });
    }
});

router.get('/leads', async (req, res) => {
    const leaderId = req.bot.leader_id;
    try {
        const leadsSnap = await db.collection('leads')
            .where('leader_id', '==', leaderId)
            .orderBy('created_at', 'desc')
            .limit(100)
            .get();
        const leads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ status: 'success', leads });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

/**
 * PATCH /leads/:leadId/status — Leader marks lead as contacted/converted/etc
 */
router.patch('/leads/:leadId/status', async (req, res) => {
    const leaderId = req.bot.leader_id;
    const { leadId } = req.params;
    const { status } = req.body;
    
    const VALID_STATUSES = ['new', 'contacted', 'registered', 'converted', 'inactive'];
    if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` });
    }
    
    try {
        const leadRef = db.collection('leads').doc(leadId);
        const leadDoc = await leadRef.get();
        
        if (!leadDoc.exists || leadDoc.data().leader_id !== leaderId) {
            return res.status(403).json({ error: 'Lead not found or access denied' });
        }
        
        await leadRef.update({ status, updated_at: new Date().toISOString() });
        res.json({ status: 'success', lead_id: leadId, new_status: status });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update lead status' });
    }
});

router.post('/flush', async (req, res) => {
    const leaderId = req.bot.leader_id;
    const flushId = req.body.flushId; 
    
    if (!flushId) {
        return res.status(400).json({ error: 'Missing required flushId for idempotent transaction.' });
    }

    try {
        await leadService.flushPendingLeads(leaderId, flushId);
        res.json({ status: 'success', message: 'Leads unlocked and delivered safely.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to flush leads securely' });
    }
});

/**
 * POST /cache/clear — Admin can clear Sheets cache (for immediate content refresh)
 */
router.post('/cache/clear', async (req, res) => {
    sheetsService.clearCache();
    res.json({ status: 'success', message: 'Sheets cache cleared. Next request will fetch fresh data.' });
});

module.exports = router;

