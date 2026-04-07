const express = require('express');
const customerService = require('../../services/customerService');
const sheetsService = require('../../services/sheetsService');
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

// Catalog — pulls from Google Sheets with 15-min cache, falls back to hardcoded
router.get('/catalog', async (req, res) => {
    try {
        const sheetProducts = await sheetsService.getCatalog();
        
        if (sheetProducts && sheetProducts.length > 0) {
            return res.json(sheetProducts);
        }
        
        // Fallback to hardcoded
        res.json([
            { code: 'ERG-101', name: 'Immune Boost', price: '85,000 UZS', category: "Sog'liq", description: 'Immunitetni kuchaytirish' },
            { code: 'ERG-201', name: 'Bio Shampun', price: '65,000 UZS', category: "Go'zallik", description: 'Soch to\'kilishiga qarshi' },
            { code: 'ERG-301', name: 'Kollagen Krem', price: '95,000 UZS', category: "Go'zallik", description: 'Terini mustahkamlash' },
            { code: 'ERG-401', name: 'SlimTea', price: '55,000 UZS', category: "Sog'liq", description: 'Vazn nazorati' },
            { code: 'ERG-501', name: 'Eco Clean', price: '45,000 UZS', category: 'Uy tozalash', description: 'Kimyosiz tozalovchi' }
        ]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch catalog' });
    }
});

module.exports = router;

