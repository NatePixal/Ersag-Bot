// functions/agents/aiService.js
const { Groq } = require('groq-sdk');
const env = require('../config/env');
const { db } = require('../config/db');

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

async function generateResponse(userText, language, leaderId) {
    // 1. Search for relevant product info in Firestore
    const snapshot = await db.collection('knowledge_base')
        .where('searchKeywords', '>=', userText.toLowerCase().split(' ')[0])
        .limit(3).get();

    let context = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        context += `Product: ${data.name}. Info: ${data.description}. Usage: ${data.usage}
`;
    });

    // 2. Call Groq AI
    const completion = await groq.chat.completions.create({
        messages: [
            {
                role: "system",
                content: `You are an expert Ersag Consultant. Use this context: ${context}. 
                Answer ONLY in ${language === 'uz' ? 'Uzbek' : 'Russian'}. 
                Always encourage registration with Sponsor ID.`
            },
            { role: "user", content: userText }
        ],
        model: "llama3-8b-8192",
    });

    return completion.choices[0].message.content;
}

module.exports = { generateResponse };