const aiService = require('./aiService');
const logger = require('../utils/logger');

const run = async (update, botToken) => {
    logger.info('Running salesAgent for hesitant customer');
    const messages = [{ role: "user", content: update.message.text }];
    const systemPrompt = "You are an expert sales assistant for ERSAG. Reassure the customer about the quality, highlight the 100% organic nature of the products and the halal certificate, and encourage them to register for a 20% discount.";
    const response = await aiService.callLLM(messages, systemPrompt);
    
    logger.info(`SalesAgent Response: ${response}`);
    return response;
};

module.exports = { run };
