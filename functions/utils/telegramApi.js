const axios = require('axios');

async function sendMessage(token, chatId, text, extra = {}) {
    try { await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text: text, ...extra }); }
    catch (error) { console.error("Send Error:", error.response ? error.response.data : error.message); }
}

async function sendPhoto(token, chatId, photo, caption, extra = {}) {
    try { await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, { chat_id: chatId, photo: photo, caption: caption, ...extra }); }
    catch (error) { console.error("Photo Error:", error.response ? error.response.data : error.message); }
}

// NEW: Stops the loading circle on Telegram buttons
async function answerCallbackQuery(token, callbackQueryId, text = "") {
    try { await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { callback_query_id: callbackQueryId, text: text }); }
    catch (error) { console.error("Answer CB Error:", error.response ? error.response.data : error.message); }
}

// NEW: Removes the Approve/Reject buttons after you click them
async function editMessageReplyMarkup(token, chatId, messageId) {
    try { await axios.post(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, { chat_id: chatId, message_id: messageId, reply_markup: null }); }
    catch (error) { console.error("Edit Markup Error:", error.response ? error.response.data : error.message); }
}

module.exports = { sendMessage, sendPhoto, answerCallbackQuery, editMessageReplyMarkup };