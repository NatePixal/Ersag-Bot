const billingBot = require('./billingBot');
const logger = require('../utils/logger');

const handleAdminCommand = async (update) => {
    logger.info('Handling admin bot command');
    const text = update.message.text || '';
    
    if (text.startsWith('/approve')) {
        const leaderId = text.split(' ')[1];
        if(leaderId) {
            await billingBot.approvePayment(leaderId);
            return `Payment approved and leads flushed for ${leaderId}.`;
        }
    }
    
    return 'Admin Control Panel Options.';
};

module.exports = { handleAdminCommand };
