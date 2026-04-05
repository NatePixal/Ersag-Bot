const logger = require('../utils/logger');
const router = require('../core/router');

const handleTelegramUpdate = async (req, res) => {
    try {
        const botToken = req.params.botToken || req.query.token;
        const update = req.body;

        if (!botToken) {
            logger.warn('Received update without bot token');
            return res.status(400).send('Missing bot token');
        }

        if (!update) {
            logger.warn('Received empty update');
            return res.status(400).send('Empty update');
        }

        logger.info(`[Gateway OK] Received Telegram update for bot: ${botToken.substring(0, 10)}...`);

        // Forward to router - Note: Router now handles sending telegram API responses directly asynchronously
        router.routeUpdate(update, botToken).catch(err => logger.error('Router execution error:', err));

        // Acknowledge receipt to Telegram instantly to prevent retries
        res.status(200).send('OK');
    } catch (error) {
        logger.error('Error in telegram gateway:', error);
        res.status(200).send('OK'); // Prevent infinite retries from Telegram
    }
};

module.exports = {
    handleTelegramUpdate
};
