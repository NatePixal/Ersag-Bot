const aiService = require('./aiService');
const telegramApi = require('../utils/telegramApi');
const logger = require('../utils/logger');

const run = async (update, botToken) => {
    logger.info('Running salesAgent for hesitant customer');
    const chatId = update.message.chat.id;
    const text = update.message.text;
    
    const messages = [{ role: "user", content: text }];
    const systemPrompt = "You are an expert sales assistant for ERSAG. Reassure the customer about the quality, highlight the 100% organic nature of the products and the halal certificate, and encourage them to register for a 20% discount. Keep replies short and friendly. Reply in the same language the user wrote in.";
    const response = await aiService.callLLM(messages, systemPrompt);
    
    // BUG FIX: Actually send the response back to the user
    await telegramApi.sendMessage(botToken, chatId, response);
    logger.info(`SalesAgent sent response to ${chatId}`);
};

module.exports = { run };
