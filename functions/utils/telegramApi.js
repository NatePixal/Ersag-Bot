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

const answerCallbackQuery = async (botToken, callbackQueryId, text = '') => {
    try {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text })
        });
    } catch (error) {
        logger.error(`Error answering callback: ${error.message}`);
    }
};

const approveChatJoinRequest = async (botToken, chatId, userId) => {
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/approveChatJoinRequest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, user_id: userId })
        });
        if (!response.ok) {
            const errText = await response.text();
            logger.error(`VIP approve error: ${errText}`);
        }
    } catch (error) {
        logger.error(`Error approving join request: ${error.message}`);
    }
};

/**
 * Forward a photo (by file_id) to a chat with an optional caption and inline keyboard.
 * Used to send payment receipts to the master admin.
 */
const sendPhoto = async (botToken, chatId, fileId, caption, replyMarkup = null) => {
    const payload = {
        chat_id: chatId,
        photo: fileId,
        caption,
        parse_mode: 'HTML'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errText = await response.text();
            logger.error(`Telegram sendPhoto error: ${errText}`);
        }
        return response.ok ? await response.json() : null;
    } catch (error) {
        logger.error(`Error sending photo: ${error.message}`);
        return null;
    }
};

/**
 * Edit a previously sent message text (used to replace approve/decline buttons
 * with a status line once the admin has acted).
 */
const editMessageText = async (botToken, chatId, messageId, text) => {
    try {
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text,
                parse_mode: 'HTML'
            })
        });
    } catch (error) {
        logger.error(`Error editing message: ${error.message}`);
    }
};

module.exports = { sendMessage, sendDocument, answerCallbackQuery, approveChatJoinRequest, sendPhoto, editMessageText };
