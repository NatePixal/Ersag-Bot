const logger = require('./logger');

const sendMessage = async (botToken, chatId, text, replyMarkup = null) => {
    const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (replyMarkup) {
        payload.reply_markup = replyMarkup;
    }
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errText = await response.text();
            logger.error(`Telegram API error: ${errText}`);
        }
    } catch (error) {
        logger.error(`Error sending message to Telegram: ${error.message}`);
    }
};

const sendDocument = async (botToken, chatId, csvString, filename) => {
    // Send a CSV file using Telegram API
    try {
        const formData = new FormData();
        formData.append('chat_id', chatId);
        
        const blob = new Blob([csvString], { type: 'text/csv' });
        formData.append('document', blob, filename);
        
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errText = await response.text();
            logger.error(`Telegram API doc error: ${errText}`);
        }
    } catch (error) {
        logger.error(`Error sending documentation to Telegram: ${error.message}`);
    }
};

module.exports = { sendMessage, sendDocument };
