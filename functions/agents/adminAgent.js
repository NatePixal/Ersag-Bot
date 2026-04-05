const logger = require('../utils/logger');

const run = async (update, botToken) => {
    logger.info('Running adminAgent (Admin Control Bot logic)');
    return 'Admin control panel accessed.';
};

module.exports = { run };
