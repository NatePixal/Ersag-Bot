/**
 * Ensures the cleanly authenticated Telegram User is explicitly the owner of the Tenant Bot. 
 * Requires `telegramAuth` and `tenantResolver` to be executed first.
 */
const requireLeader = (req, res, next) => {
    if (!req.telegramUser) {
        return res.status(401).json({ error: 'Unauthorized: User not resolved' });
    }
    
    if (!req.bot || !req.bot.leader_id) {
        return res.status(500).json({ error: 'Tenant configuration error' });
    }

    if (String(req.telegramUser.id) !== String(req.bot.leader_id)) {
        return res.status(403).json({ error: 'Forbidden: You are not the leader of this bot' });
    }

    next();
};

module.exports = requireLeader;
