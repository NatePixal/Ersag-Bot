const logger = require('../utils/logger');

const run = async (update, botToken) => {
    logger.info('Running supportAgent (Help/FAQ)');
    return 'Support agent is checking the FAQ...';
};

module.exports = { run };
