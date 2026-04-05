const express = require('express');
const cors = require('cors');

const tenantResolver = require('../../middlewares/tenantResolver');
const telegramAuth = require('../../middlewares/telegramAuth');
const leaderAuth = require('../../middlewares/leaderAuth');
const rateLimit = require('../../middlewares/rateLimiter');
const auditLogger = require('../../middlewares/auditLogger');

const customerApi = require('./customerApi');
const leaderApi = require('./leaderApi');

const router = express.Router();

// CORS for Web Views relying on Auth headers instead of cookies.
router.use(cors({ origin: true }));

// Apply basic protective rate limiting
router.use(rateLimit({ windowMs: 60000, max: 30 })); // max 30 hits per minute

// Apply required security middlewares globally for /api
router.use(tenantResolver);
router.use(telegramAuth);

// Mount the two distinct apps
router.use('/customer', customerApi);

// Mount the strictly verified leader endpoints, adding strict Audit Logging
router.use('/leader', leaderAuth, auditLogger, leaderApi);

module.exports = router;
