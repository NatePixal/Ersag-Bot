// functions/utils/logger.js
const { logger } = require("firebase-functions");

module.exports = {
    info: (...args) => logger.info(...args),
    error: (...args) => logger.error(...args),
    warn: (...args) => logger.warn(...args)
};