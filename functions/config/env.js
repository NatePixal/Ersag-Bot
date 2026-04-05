require('dotenv').config();

const env = {
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL || '',
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID || '',
    ADMIN_GROUP_ID: process.env.ADMIN_GROUP_ID || '-1003600813056',
    MASTER_BOT_TOKEN: process.env.MASTER_BOT_TOKEN || '',
    GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID || '',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
    // Additional config loaded here
};

module.exports = env;
