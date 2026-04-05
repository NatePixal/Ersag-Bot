require('dotenv').config();

const env = {
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL || '',
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID || '',
    // Additional config loaded here
};

module.exports = env;
