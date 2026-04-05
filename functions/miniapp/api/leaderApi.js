const express = require('express');
const quotaService = require('../../services/quotaService');
const leadService = require('../../services/leadService');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
    // Only reachable if leaderAuth passed securely
    const leaderId = req.bot.leader_id; 

    try {
        const hasQuota = await quotaService.checkQuota(leaderId);
        const leads = await leadService.getPendingLeads(leaderId);
        
        res.json({ 
            status: 'success',
            hasQuota,
            pending_lead_count: leads.length
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get dashboard metrics' });
    }
});

router.get('/leads', async (req, res) => {
    const leaderId = req.bot.leader_id;
    try {
        const leads = await leadService.getPendingLeads(leaderId);
        res.json({ status: 'success', leads });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

router.post('/flush', async (req, res) => {
    const leaderId = req.bot.leader_id;
    // Expected from the client side generated on click (UUIDv4)
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

module.exports = router;
