// functions/config/env.js
require('dotenv').config();

module.exports = {
    // These are pulled from your Firebase Secrets
    MASTER_BOT_TOKEN: process.env.MASTER_BOT_TOKEN || "",
    ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID || "",
    GROQ_API_KEY: process.env.GROQ_API_KEY || "",
    
    // Google Sheets Config
    GOOGLE_SHEETS_ID: "13vVUizWwWowU3Q26v7G_20fk3Iott9TTIWdcE_93U6s", // <--- Added this!

    // Static configs
    ADMIN_GROUP_ID: process.env.ADMIN_GROUP_ID || "-1003600813056",
    NODE_ENV: process.env.NODE_ENV || 'production'
};