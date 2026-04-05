const { db } = require('../config/db');

const botsCollection = db.collection('bots');

const findBotByToken = async (botToken) => {
    const snapshot = await botsCollection.where('bot_token', '==', botToken).limit(1).get();
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
};

const findBotByUuid = async (uuid) => {
    const snapshot = await botsCollection.where('webhook_uuid', '==', uuid).limit(1).get();
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
};

const createBot = async (botData) => {
    const docRef = await botsCollection.add(botData);
    return { id: docRef.id, ...botData };
};

const updateBotStatus = async (botId, status) => {
    await botsCollection.doc(botId).update({ status });
};

module.exports = {
    findBotByToken,
    findBotByUuid,
    createBot,
    updateBotStatus
};
