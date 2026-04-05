const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Validates the WebApp initData payload securely against the botToken.
 * Because req.bot was resolved by tenantResolver, we have secure access to the token.
 */
const validateTelegramWebAppData = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('tma ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Telegram auth header' });
    }

    const initData = authHeader.substring(4); // Remove 'tma '

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        
        // Sorting keys algebraically per Telegram Spec
        const keys = Array.from(urlParams.keys()).sort();
        const dataCheckString = keys.map(k => `${k}=${urlParams.get(k)}`).join('\n');
        
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(req.bot.bot_token).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        
        if (calculatedHash !== hash && process.env.NODE_ENV !== 'development') {
            // Provide a bypass for local dev testing without real TMA, but strictly enforce otherwise
            if (process.env.DEV_BYPASS_AUTH !== 'true') {
                logger.warn('Failed Telegram Web App signature validation', { tenantId: req.bot.webhook_uuid });
                return res.status(403).json({ error: 'Forbidden: Invalid signature' });
            }
        }

        // Parse user data specifically from the verified initData payload
        const userJson = urlParams.get('user');
        if (!userJson) {
            return res.status(400).json({ error: 'No user data in payload' });
        }
        
        const user = JSON.parse(userJson);
        req.telegramUser = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            language_code: user.language_code
        };

        next();
    } catch (err) {
        logger.error('Error parsing Telegram auth data:', err);
        return res.status(401).json({ error: 'Unauthorized: Malformed payload' });
    }
};

module.exports = validateTelegramWebAppData;
