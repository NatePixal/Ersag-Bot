// functions/agents/aiService.js
const { Groq } = require('groq-sdk');
const env = require('../config/env');
const { db } = require('../config/db');

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

async function generateResponse(userText, language, leaderId) {
    // 1. Search for relevant product info in Firestore
    // We fetch all products (assuming catalog is small) to provide as context
    // or filter down using JavaScript string matching
    const snapshot = await db.collection('knowledge_base').get();

    let context = "";
    let matchedProducts = 0;
    const lowerUserText = userText.toLowerCase();

    snapshot.forEach(doc => {
        const data = doc.data();
        // Basic filtering: see if any of the UZ or RU text contains words from userText
        const searchString = `${data.name_uz} ${data.name_ru} ${data.desc_uz} ${data.desc_ru} ${data.category}`.toLowerCase();

        // Very basic matching rule: limit context to 5 relevant items
        if (matchedProducts < 5 && lowerUserText.split(' ').some(word => word.length > 3 && searchString.includes(word))) {
            context += `Product (UZ): ${data.name_uz || ''}. Info: ${data.desc_uz || ''}. Usage: ${data.usage_uz || ''}. Price: ${data.price || ''}\n`;
            context += `Product (RU): ${data.name_ru || ''}. Info: ${data.desc_ru || ''}. Usage: ${data.usage_ru || ''}. Price: ${data.price || ''}\n`;
            matchedProducts++;
        }
    });

    // If no specific product matched, just pass the first 3 products as general context so AI has some info
    if (matchedProducts === 0) {
        let i = 0;
        snapshot.forEach(doc => {
            if (i < 3) {
                const data = doc.data();
                context += `Product (UZ): ${data.name_uz || ''}. Info: ${data.desc_uz || ''}. Usage: ${data.usage_uz || ''}. Price: ${data.price || ''}\n`;
                context += `Product (RU): ${data.name_ru || ''}. Info: ${data.desc_ru || ''}. Usage: ${data.usage_ru || ''}. Price: ${data.price || ''}\n`;
                i++;
            }
        });
    }

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