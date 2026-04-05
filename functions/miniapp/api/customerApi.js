const express = require('express');
const customerService = require('../../services/customerService');
const { db } = require('../../config/db');

const router = express.Router();

// Fetch state for the storefront (e.g. lead status to unlock catalog)
router.get('/state', async (req, res) => {
    try {
        const botToken = req.bot.bot_token;
        const telegramId = req.telegramUser.id;
        
        const customer = await customerService.getCustomer(botToken, telegramId);
        
        res.json({
            status: 'success',
            customer: customer || { 
                language: req.telegramUser.language_code || 'uz', 
                is_lead_captured: false 
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch customer profile' });
    }
});

/**
 * GET /api/customer/context
 * Returns the dynamic leader context for this customer's assigned leader.
 * This replaces ALL hardcoded sponsor_id / registration_link values in the frontend.
 */
router.get('/context', async (req, res) => {
    try {
        const telegramId = String(req.telegramUser.id);
        
        // 1. Find what leader this customer belongs to
        const referralDoc = await db.collection('customer_referrals').doc(telegramId).get();
        const leaderCode = referralDoc.exists ? referralDoc.data().referral_code : null;
        
        // 2. Load that leader's profile
        let leaderData = null;
        if (leaderCode) {
            const leaderDoc = await db.collection('leaders').doc(leaderCode).get();
            if (leaderDoc.exists) leaderData = leaderDoc.data();
        }
        
        // 3. If no leader assigned, fall back to the platform default (you)
        const DEFAULT_SPONSOR_ID = '5422685';
        const DEFAULT_REGISTRATION_LINK = `https://www.ersagglobal.uz/account.asp?mod=myaccount&sub=edit&action=register&p=1&sponsor=${DEFAULT_SPONSOR_ID}`;

        res.json({
            sponsor_id: leaderData?.sponsor_id || DEFAULT_SPONSOR_ID,
            ersag_registration_link: leaderData?.ersag_registration_link || DEFAULT_REGISTRATION_LINK,
            vip_group_link: leaderData?.vip_group || null,
            leader_name: leaderData?.name || 'Ersag',
            assigned_to_leader: !!leaderData
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load context' });
    }
});

// A dummy catalog response (to be connected to a real DB later)
router.get('/catalog', (req, res) => {
    res.json({
        status: 'success',
        products: [
            { id: 1, name: 'Eco Clean', price: '120,000 UZS', category: 'Uy tozalash' },
            { id: 2, name: 'Aloe Vera Extract', price: '80,000 UZS', category: 'Go\'zallik' },
            { id: 3, name: 'Immune Boost', price: '150,000 UZS', category: 'Sog\'liq' }
        ]
    });
});

module.exports = router;

