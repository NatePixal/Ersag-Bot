const axios = require('axios');

async function sendMessage(token, chatId, text, extra = {}) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: chatId,
            text: text,
            // Notice: parse_mode is GONE. This is the fix.
            ...extra
        });
    } catch (error) {
        console.error("Telegram Send Error:", error.response?.data || error.message);
    }
}

async function sendPhoto(token, chatId, photoId, caption) {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    try {
        await axios.post(url, {
            chat_id: chatId,
            photo: photoId,
            caption: caption
        });
    } catch (error) {
        console.error("Telegram Photo Error:", error.response?.data || error.message);
    }
}

module.exports = { sendMessage, sendPhoto };