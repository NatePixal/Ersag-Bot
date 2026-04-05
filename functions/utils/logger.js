const { logger: firebaseLogger } = require('firebase-functions');

const logger = {
    info: (msg, data = {}) => {
        firebaseLogger.info(msg, data);
        if (process.env.NODE_ENV === 'development') console.log(`[INFO] ${msg}`, data);
    },
    error: (msg, err) => {
        firebaseLogger.error(msg, err);
        if (process.env.NODE_ENV === 'development') console.error(`[ERROR] ${msg}`, err);
    },
    warn: (msg, data = {}) => {
        firebaseLogger.warn(msg, data);
        if (process.env.NODE_ENV === 'development') console.warn(`[WARN] ${msg}`, data);
    }
};

module.exports = logger;
