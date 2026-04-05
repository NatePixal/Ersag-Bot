const botRegistry = require('../services/botRegistryService');
const logger = require('../utils/logger');

const resolveTenant = async (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
        logger.warn('API request missing x-tenant-id');
        return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    try {
        const bot = await botRegistry.getBotByTenantId(tenantId);
        if (!bot) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        // Attach the completely resolved bot info, preventing client from needing the botToken entirely
        req.bot = bot;
        next();
    } catch (error) {
        logger.error('Error resolving tenant:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = resolveTenant;
