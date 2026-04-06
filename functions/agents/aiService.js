const env = require('../config/env');
const logger = require('../utils/logger');

const callLLM = async (messages, systemPrompt) => {
    if (!env.GROQ_API_KEY) {
        logger.warn('GROQ_API_KEY is missing. Using stub response.');
        return "I am an AI assistant. Please configure GROQ_API_KEY to enable chat.";
    }

    try {
        // 1. Ensure systemPrompt is never falsy
        const safeSystemPrompt = systemPrompt || 'You are a helpful assistant.';

        // 2. Filter out messages with empty/null/undefined content
        const safeMessages = (Array.isArray(messages) ? messages : [])
            .filter(m => m && typeof m.content === 'string' && m.content.trim() !== '');

        const payload = {
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: safeSystemPrompt },
                ...safeMessages
            ]
        };

        // 3. Log full payload before sending so we can debug Bad Request errors
        logger.info('[AI called] Sending request to Groq LLC. Payload: ' + JSON.stringify(payload));
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
