const express = require('express');
const router = express.Router();
const { db } = require('../../config/db');

// 1. GET /api/getCatalog - Matches HTML 'CATALOG_API'
router.get('/getCatalog', async (req, res) => {
    try {
        const snapshot = await db.collection('knowledge_base').get();
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. GET /api/getLeaderConfig - Matches HTML 'LEADER_CONFIG_API'
router.get('/getLeaderConfig', async (req, res) => {
    const sponsorParam = req.query.sponsor || 'admin';
    try {
        const leaderDoc = await db.collection('leaders').doc(String(sponsorParam)).get();
        if (leaderDoc.exists) {
            return res.json({ sponsor_id: leaderDoc.data().sponsor_id });
        }
        res.json({ sponsor_id: "5422685" }); // Default Fallback
    } catch (e) {
        res.json({ sponsor_id: "5422685" });
    }
});

// 3. GET /api/leads - Matches HTML 'PENDING_LEADS_API'
router.get('/leads', async (req, res) => {
    const { leader_id, admin_secret } = req.query;
    
    // Replace 'SUPER_SECRET_123' with your actual chosen secret
    if (admin_secret !== "SUPER_SECRET_123") {
        return res.status(403).json({ error: "Unauthorized" });
    }

    try {
        const snapshot = await db.collection('leads')
            .where('leaderId', '==', String(leader_id))
            .orderBy('createdAt', 'desc')
            .get();

        const leads = snapshot.docs.map(doc => doc.data());
        res.json({ leads });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;