const { db } = require('../config/db');

const getCustomer = async (botToken, telegramUserId) => {
    // Generate a unique ID for this customer in this bot's context
    const customerId = `${botToken}_${telegramUserId}`;
    
    const docRef = db.collection('customers').doc(customerId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
        return null;
    }
    
    return doc.data();
};

const upsertCustomer = async (botToken, telegramUserId, updateData) => {
    const customerId = `${botToken}_${telegramUserId}`;
    
    const docRef = db.collection('customers').doc(customerId);
    
    await docRef.set({
        botToken,
        telegramUserId,
        ...updateData,
        last_updated: new Date().toISOString()
    }, { merge: true });
};

module.exports = {
    getCustomer,
    upsertCustomer
};
