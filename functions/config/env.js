// functions/config/env.js
let initialized = false;

function initEnv() {
  if (initialized) return;

  // These are the bare minimum secrets needed.
  // Add any other core secrets to this list if required.
  required("ADMIN_TELEGRAM_ID");
  required("MASTER_BOT_TOKEN");
  required("GROQ_API_KEY");

  initialized = true;
  console.log("✅ ENV initialized");
}

function required(name) {
  if (!process.env[name]) {
    throw new Error(`Missing ENV: ${name}`);
  }
}

module.exports = {
  initEnv,
  get MASTER_BOT_TOKEN() {
    return process.env.MASTER_BOT_TOKEN;
  },
  get ADMIN_TELEGRAM_ID() {
    return process.env.ADMIN_TELEGRAM_ID;
  },
  get GROQ_API_KEY() {
    return process.env.GROQ_API_KEY;
  },
  get GOOGLE_SHEETS_ID() {
    // Note: The previous ID was hardcoded. We provide it as a fallback or read from env.
    return process.env.GOOGLE_SHEETS_ID || "13vVUizWwWowU3Q26v7G_20fk3Iott9TTIWdcE_93U6s";
  },
  get ADMIN_GROUP_ID() {
    return process.env.ADMIN_GROUP_ID || "-1003600813056";
  },
  get NODE_ENV() {
    return process.env.NODE_ENV || 'production';
  }
};