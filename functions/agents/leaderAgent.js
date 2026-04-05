const logger = require('../utils/logger');
const leaderHubBot = require('../bots/leaderHubBot');

const run = async (update, botToken) => {
    logger.info('Running leaderAgent (Leader Hub Bot logic)');
    await leaderHubBot.run(update, botToken);
};

module.exports = { run };
