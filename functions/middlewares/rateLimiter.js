const requestCounts = new Map();

// A simple but effective in-memory rate limiter per Firebase instance.
const rateLimit = (options = {}) => {
    const windowMs = options.windowMs || 60000;
    const max = options.max || 30;

    return (req, res, next) => {
        // Resolve keys uniquely using both Tenant ID and User (or fallback to IP)
        const tenantId = req.bot?.webhook_uuid || 'anonymous_tenant';
        const userId = req.telegramUser?.id || req.ip;
        const key = `${tenantId}_${userId}`;

        const now = Date.now();

        if (!requestCounts.has(key)) {
            requestCounts.set(key, { count: 1, startTime: now });
        } else {
            const record = requestCounts.get(key);
            if (now - record.startTime > windowMs) {
                // Reset window
                record.count = 1;
                record.startTime = now;
            } else {
                record.count++;
                if (record.count > max) {
                    return res.status(429).json({ error: 'Too many requests, please try again later.' });
                }
            }
        }
        next();
    };
};

module.exports = rateLimit;
