const { db } = require('../config/db');
const logger = require('../utils/logger');

const auditLog = async (req, res, next) => {
    // Only capture securely resolved variables from leaderAuth/tenantResolver
    const leaderId = req.telegramUser?.id;
    const tenantId = req.bot?.webhook_uuid;
    const action = `${req.method} ${req.originalUrl}`;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (leaderId && tenantId) {
        try {
            // Asychronously fire the audit log so it does not delay the primary request response
            db.collection('audit_logs').add({
                leader_id: leaderId,
                tenant_id: tenantId,
                action: action,
                ip: ip,
                timestamp: new Date().toISOString()
            }).catch(err => {
                logger.error('Failed strict audit write', err);
            });
        } catch (err) {
            logger.error('Failed to trigger audit log', err);
        }
    }
    
    next();
};

module.exports = auditLog;
