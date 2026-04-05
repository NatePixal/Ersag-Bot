const aiService = require('./aiService');
const telegramApi = require('../utils/telegramApi');
const { db } = require('../config/db');
const sheetsService = require('../services/sheetsService');
const logger = require('../utils/logger');

/**
 * Doctor Ersag — Symptom-based Wellness Consultation Agent
 * 
 * Flow:
 * 1. Get user's current session state from Firestore
 * 2. Ask structured questions (step by step)
 * 3. After 3 answers → AI gives product recommendation
 * 4. Offer registration link with leader's sponsor ID
 */

const DOCTOR_SYSTEM_PROMPT = `Siz "Doctor Ersag" — ERSAG kompaniyasining sun'iy intellekt sog'liq maslahatchisisiz.

Maqsadingiz:
1. Avval foydalanuvchining muammosini tushunish (qisqa, empatik)
2. Savol berish: qachondan beri? Qanday simptomlar?
3. Hayot tarziga oid 1 savol (ovqatlanish, stres, uyqu)
4. Natijada ANIQ ERSAG mahsulotlarini tavsiya qilish (faqat ularni)
5. Ro'yxatdan o'tishni taklif qilish

MUHIM QOIDALAR:
- Tibbiy tashxis qo'ymang
- "Bu kasallik emas, bu holatni qo'llab-quvvatlash uchun..." degan tarzda gapiring
- Har javobni 2-4 jumladan qisqa qiling
- Savol bilan tugating

Agar foydalanuvchi RUS tilida yozsа, RUS tilida javob bering.
Agar UZBEK tilida, UZBEK tilida javob bering.`;

const PRODUCTS_KNOWLEDGE = `
Ersag mahsulotlari bo'yicha bilim:

SOG'LIQ:
- Immune Boost (ERG-101): Immunitetni mustahkamlash, kuniga 1 kapsula
- OmegaPlus (ERG-102): Yurak sog'ligi, miya faoliyati, kuniga 2 kapsula
- Magniy B6 (ERG-103): Stres, uyqusizlik, mushaklarni tinchlantirish

GO'ZALLIK VA SOCh:
- Bio Shampun (ERG-201): Soch to'kilishi, skalpni parvarish qilish
- Argan Oil Serum (ERG-202): Quruq va shikastlangan soch uchun
- Kollagen Krem (ERG-301): Terini tortish, wrinkle kamaytirish

OG'IRLIK:
- SlimTea (ERG-401): Metabolizmni tezlashtirish, kuniga 2 piyola
- DetoxPlus (ERG-402): Toksинlarni tozalash, oshqozon uchun

UY TOZALASH:
- Eco Clean (ERG-501): Barcha yuzalar uchun, kimyosiz
`;

const run = async (update, botToken, leaderContext = {}) => {
    logger.info('[DoctorAgent] Running');
    const message = update.message;
    const callbackQuery = update.callback_query;
    
    if (!message && !callbackQuery) return;
    
    const chatId = message ? message.chat.id : callbackQuery.message.chat.id;
    const userId = message ? message.from.id : callbackQuery.from.id;
    const text = message ? (message.text || '') : '';
    
    // Handle symptom selection buttons
    if (callbackQuery && callbackQuery.data.startsWith('symptom_')) {
        const symptom = callbackQuery.data.replace('symptom_', '');
        await telegramApi.answerCallbackQuery(botToken, callbackQuery.id);
        await startConsultation(botToken, chatId, userId, symptom, leaderContext);
        return;
    }
    
    // Entry point — show symptom selector
    if (text.includes('Doctor Ersag') || text.includes('doktor') || text.includes('консультация') || text.includes('konsultatsiya')) {
        await showSymptomSelector(botToken, chatId);
        return;
    }
    
    // Continue ongoing consultation
    const session = await getDoctorSession(userId);
    if (session && session.mode === 'doctor' && session.step < 4) {
        await continueConsultation(botToken, chatId, userId, text, session, leaderContext);
        return;
    }
    
    // Default entry if called directly
    await showSymptomSelector(botToken, chatId);
};

const showSymptomSelector = async (botToken, chatId) => {
    const markup = {
        inline_keyboard: [
            [{ text: '🦱 Soch to\'kilishi', callback_data: 'symptom_hair' }, { text: '⚖️ Ortiqcha vazn', callback_data: 'symptom_weight' }],
            [{ text: '😴 Uyqusizlik / Stres', callback_data: 'symptom_stress' }, { text: '💪 Immunitet', callback_data: 'symptom_immune' }],
            [{ text: '✨ Teri muammolari', callback_data: 'symptom_skin' }, { text: '🔴 Boshqa muammo', callback_data: 'symptom_other' }]
        ]
    };
    
    await telegramApi.sendMessage(botToken, chatId,
        "👨‍⚕️ *Doctor Ersag* | Bepul Konsultatsiya\n\n" +
        "Qaysi sohada yordam kerak?\n" +
        "_Tanlang — men sizga eng mos yechimni topaman._",
        markup
    );
};

const startConsultation = async (botToken, chatId, userId, symptom, leaderContext) => {
    const questions = {
        hair: "Soch to'kilishi bilan qanchalik vaqtdan beri kurashyapsiz va kuniga taxminan qancha soch tushadi?",
        weight: "Ortiqcha vazningiz qachondan paydo bo'ldi va avval parhez yoki sport qilganmisiz?",
        stress: "Uyqusizlik yoki stres qachondan boshlandi? Kuniga neча soat uxlaysiz?",
        immune: "Tez-tez kasal bo'lasizmi? Oxirgi 6 oyda necha marta shamollagan bo'lsangiz?",
        skin: "Qanday teri muammosi bor (quruqlik, akne, yorilish, dog'lar)?",
        other: "Qanday muammo sizni tashvishlantiryapti? Batafsil aytib bering."
    };
    
    // Save session
    await saveDoctorSession(userId, { mode: 'doctor', symptom, step: 1, leaderContext });
    
    await telegramApi.sendMessage(botToken, chatId,
        `👨‍⚕️ Tushunarli. ${questions[symptom]}`
    );
};

const continueConsultation = async (botToken, chatId, userId, userText, session, leaderContext) => {
    const newStep = session.step + 1;
    await saveDoctorSession(userId, { ...session, step: newStep, [`answer${session.step}`]: userText });
    
    if (newStep === 2) {
        await telegramApi.sendMessage(botToken, chatId,
            "Tushundim. Oziqlanishingiz haqida: kuniga suv qancha ichasiz va asosan qanday ovqatlanasiz?"
        );
        return;
    }
    
    if (newStep === 3) {
        await telegramApi.sendMessage(botToken, chatId, "⏳ Tahlil qilyapman...");
    }
    
    if (newStep >= 3) {
        // Build final recommendation
        const updatedSession = { ...session, step: newStep, [`answer${session.step}`]: userText };
        await giveRecommendation(botToken, chatId, userId, updatedSession, leaderContext);
    }
};

const giveRecommendation = async (botToken, chatId, userId, session, leaderContext) => {
    const conversationSummary = `
Muammo: ${session.symptom}
Javob 1: ${session.answer1 || ''}
Javob 2: ${session.answer2 || ''}
Javob 3: ${session.answer3 || ''}
    `.trim();
    
    // Use live Doctor_Baza from Google Sheets if available, else fall back to local
    let dynamicKnowledge = '';
    try {
        const baza = await sheetsService.getDoctorBaza();
        if (baza && baza.length > 0) {
            dynamicKnowledge = '\n\nJONLI BILIM BAZASI (Google Sheets):\n' +
                baza.map(b => `- ${b.symptom}: ${b.product_codes.join(', ')} | ${b.howToUse}`).join('\n');
            logger.info(`[DoctorAgent] Using ${baza.length} Sheets entries`);
        }
    } catch (e) {
        logger.warn('[DoctorAgent] Sheets not available, using local knowledge');
    }
    
    const messages = [{ role: 'user', content: conversationSummary }];
    const fullPrompt = DOCTOR_SYSTEM_PROMPT + '\n\n' + PRODUCTS_KNOWLEDGE +
        (dynamicKnowledge ? '\n' + dynamicKnowledge : '');
    
    const recommendation = await aiService.callLLM(messages, fullPrompt);
    await telegramApi.sendMessage(botToken, chatId, recommendation);
    
    // Registration CTA with dynamic sponsor
    const sponsorId = leaderContext.sponsor_id || '5422685';
    const regLink = leaderContext.ersag_registration_link ||
        `https://www.ersagglobal.uz/account.asp?mod=myaccount&sub=edit&action=register&p=1&sponsor=${sponsorId}`;
    
    const ctaMarkup = {
        inline_keyboard: [
            [{ text: "✅ Ro'yxatdan o'tish (20% chegirma)", url: regLink }],
            [{ text: "🔄 Yangi konsultatsiya", callback_data: "symptom_other" }]
        ]
    };
    
    await telegramApi.sendMessage(botToken, chatId,
        `\n📌 *Shifokorning eslatmasi:* Bu mahsulotlar tibbiy davo emas, sog'likni qo'llab-quvvatlash uchun.\n\nRo'yxatdan o'tib, sponsor orqali *20% chegirma* oling! 👇`,
        ctaMarkup
    );
    
    // Clear session
    await saveDoctorSession(userId, null);
};

// ─── Session helpers ───
const getDoctorSession = async (userId) => {
    const doc = await db.collection('doctor_sessions').doc(String(userId)).get();
    return doc.exists ? doc.data() : null;
};

const saveDoctorSession = async (userId, data) => {
    const ref = db.collection('doctor_sessions').doc(String(userId));
    if (data === null) {
        await ref.delete();
    } else {
        await ref.set({ ...data, updated_at: new Date().toISOString() });
    }
};

module.exports = { run, showSymptomSelector };
