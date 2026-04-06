const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const logger = require("../utils/logger");
const telegramApi = require("../utils/telegramApi");
const aiService = require("../agents/aiService");
const { buildCustomerPrompt } = require("../prompts/customer.prompt");

const PUBSUB_TOPIC = "process-ai-message";

/**
 * 🧠 PILLAR 1: AI WORKER (Background Processor)
 * 
 * This background worker is the core engine for all LLM text processing.
 * By completely decoupling AI generation from the Webhook:
 * 1. Telegram API limits (15s timeouts) will never cause duplicate replies.
 * 2. Heavy processing does not tie up webhook HTTP connections.
 * 3. We can retry logic natively across GCP Pub/Sub.
 */
exports.processAiMessage = onMessagePublished({ 
    topic: PUBSUB_TOPIC,
    secrets: ["GROQ_API_KEY"] 
}, async (event) => {
    try {
        const payloadStr = Buffer.from(event.data.message.data, "base64").toString("utf8");
        const payload = JSON.parse(payloadStr);

        const { chatId, userText, lang, token, ownerId, action } = payload;
        
        logger.info(`[AI Worker] Processing message for chatId: ${chatId}. Action: ${action || 'chat'}`);

        let systemPrompt;
        if (action === 'generate_post') {
            systemPrompt = `Sen professional SMM mutaxassis va kopiraytersan. ERSAG kompaniyasining quyidagi mahsuloti haqida Instagram uchun chiroyli, mijozlarni o'ziga tortadigan, sotishga undovchi va emojilarga boy post yozib ber. Post oxirida har doim "Batafsil ma'lumot va buyurtma uchun Direct'ga yozing!" deb qo'sh. Foydalanuvchi yozgan narsa:`;
        } else {
            // Generate the personality prompt based on the language
            systemPrompt = buildCustomerPrompt(lang);
        }

        // Package exactly as standard OpenAI format array
        const messagesArr = [{ role: 'user', content: userText }];

        // Call the Groq LLM (Via our isolated aiService to ensure model versions stay consistent)
        const reply = await aiService.callLLM(messagesArr, systemPrompt);

        // Send the AI's response asynchronously directly back to the client!
        if (reply) {
            await telegramApi.sendMessage(token, chatId, reply, { parse_mode: "Markdown" });
        }

    } catch (e) {
        logger.error("[AI Worker] Processing Failed:", e);
    }
});
