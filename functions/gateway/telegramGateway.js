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

        // Handle VIP group join requests first (chat_join_request events)
        if (update.chat_join_request) {
            const vipService = require('../services/vipService');
            await vipService.handleJoinRequest(update, botToken);
            return res.status(200).send('OK');
        }

        // Await router so Firebase doesn't kill the function asynchronously before LLM resolves
        await router.routeUpdate(update, botToken).catch(err => logger.error('Router execution error:', err));

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
