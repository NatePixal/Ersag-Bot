const express = require('express');
const customerService = require('../../services/customerService');

const router = express.Router();

// Fetch state for the storefront (e.g. lead status to unlock catalog)
router.get('/state', async (req, res) => {
    try {
        // req.bot and req.telegramUser are securely injected
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

// A dummy catalog response (to be connected to a real DB if needed)
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
