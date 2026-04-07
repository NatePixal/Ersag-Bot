// functions/core/router.js
const adminBot = require('../bots/adminBot');
const leaderHubBot = require('../bots/leaderHubBot');
const customerBot = require('../bots/customerBot');

async function route(update, identity, botToken) {
    const { role, status } = identity;

    // A. GLOBAL BLOCK: If you suspended a leader, their bot stops immediately.
    if (role === 'leader' && status === 'suspended') {
        // Send a polite 'Deactivated' message
        return; 
    }

    // B. ROUTING LOGIC
    if (role === 'admin') {
        // You have total power. You see payment approvals, etc.
        return adminBot.handleUpdate(update, botToken);
    }

    if (role === 'leader') {
        // Leaders see their dashboard and onboarding
        return leaderHubBot.handleUpdate(update, botToken);
    }

    // Default: Everyone else is a Customer
    return customerBot.handleUpdate(update, botToken, identity.ownerId);
}

module.exports = { route };