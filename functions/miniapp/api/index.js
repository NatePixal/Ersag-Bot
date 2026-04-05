const express = require('express');
const router = express.Router();
const leadService = require('../../services/leadService');

router.get('/getCatalog', async (req, res) => {
    res.json([
        { category: "Sog'liq", name_uz: "Omega 3", price: "240000", image: "" },
        { category: "Go'zallik", name_uz: "Atirgul yuzi kremi", price: "180000", image: "" }
    ]);
});

router.get('/getLeaderConfig', async (req, res) => {
    const sponsor = req.query.sponsor || 'L5422685';
    res.json({ sponsor_id: sponsor });
});

router.get('/leads', async (req, res) => {
    const leaderId = req.query.leader_id;
    const adminSecret = req.query.admin_secret;
    
    if (!adminSecret) return res.status(403).json({ error: 'Ruxsat yoq. Secret noto\'g\'ri' });

    try {
        const leads = await leadService.getPendingLeads(leaderId);
        res.json({ leads });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
