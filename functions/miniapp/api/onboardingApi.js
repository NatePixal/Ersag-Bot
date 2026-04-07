const express = require('express');
const router = express.Router();
const botRegistryService = require('../../services/botRegistryService');
const { db } = require('../../config/db');

router.get('/profile', async (req, res) => {
    // telegramAuth provides req.telegramUser guaranteeing cryptographically sealed Telegram WebApp Data
    if (!req.telegramUser) return res.status(401).json({ error: 'Auth failed' });
    const leaderId = String(req.telegramUser.id);
    
    try {
        const botQuery = await db.collection('bots')
            .where('leader_id', '==', leaderId)
            .limit(1)
            .get();
        
        if (botQuery.empty) {
            return res.json({ registered: false });
        }
        
        const leaderConfigDoc = await db.collection('leaders').doc(leaderId).get();
        let config = {};
        if (leaderConfigDoc.exists) config = leaderConfigDoc.data();
        
        const botData = botQuery.docs[0].data();
        
        res.json({
            registered: true,
            bot_token: botData.bot_token,
            bot_type: botData.bot_type || 'sales',
            tenant_id: botData.webhook_uuid,
            status: botData.status,
            sponsor_id: config.sponsor_id || '',
            vip_group: config.vip_group || '',
            phone: config.phone || ''
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

router.post('/onboard', async (req, res) => {
    if (!req.telegramUser) return res.status(401).json({ error: 'Auth failed' });
    const leaderId = String(req.telegramUser.id);
    
    const { botToken, sponsorId, vipGroup, phone, leadGroupId, leaderName, botType } = req.body;
    
    const VALID_BOT_TYPES = ['sales', 'billing', 'support'];
    const resolvedBotType = VALID_BOT_TYPES.includes(botType) ? botType : 'sales';
    
    if (!botToken || !sponsorId) return res.status(400).json({ error: 'Missing req fields' });
    
    // Safety token formatting strip
    const tokenParts = botToken.split(':');
    if (tokenParts.length !== 2) return res.status(400).json({ error: 'Xato Bot Token formati! Masalan: 1234:ABCDEF... bo\'lishi shart' });
    
    try {
        // Registers and binds native webhooks identically
        await botRegistryService.registerBot(botToken, leaderId, resolvedBotType);
        
        await db.collection('leaders').doc(leaderId).set({
            name: leaderName || '',
            sponsor_id: sponsorId,
            ersag_registration_link: `https://www.ersagglobal.uz/account.asp?mod=myaccount&sub=edit&action=register&p=1&sponsor=${encodeURIComponent(sponsorId)}`,
            vip_group: vipGroup || '',
            phone: phone || '',
            lead_group_id: leadGroupId || '',
            updated_at: new Date().toISOString()
        }, { merge: true });
        
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
