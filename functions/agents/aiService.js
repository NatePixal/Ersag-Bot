const env = require('../config/env');
const logger = require('../utils/logger');

const callLLM = async (messages, systemPrompt) => {
    if (!env.GROQ_API_KEY) {
        logger.warn('GROQ_API_KEY is missing. Using stub response.');
        return "I am an AI assistant. Please configure GROQ_API_KEY to enable chat.";
    }

    try {
        const payload = {
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ]
        };

        logger.info('[AI called] Sending request to Groq LLC...');
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`Groq API Error: ${res.statusText}`);
        }

        const data = await res.json();
        logger.info('[Reply sent] AI responded successfully.');
        return data.choices[0].message.content;
    } catch (error) {
        logger.error('Error calling AI service', error);
        return "Uzr, xatolik yuz berdi. Iltimos, qayta urinib ko'ring.";
    }
};

module.exports = { callLLM };
