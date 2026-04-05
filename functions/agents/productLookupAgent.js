const telegramApi = require('../utils/telegramApi');
const { db } = require('../config/db');
const aiService = require('./aiService');
const logger = require('../utils/logger');

// Static product knowledge base (will later come from Google Sheets)
const PRODUCT_KNOWLEDGE = {
    'ERG-101': {
        name: 'Immune Boost',
        purpose: 'Immunitetni kuchaytirish, yuqumli kasalliklarga qarshi himoya',
        howToUse: 'Kuniga 1 kapsula ovqat bilan, ertalab',
        suitableFor: 'Tez-tez kasal bo\'ladiganlar, mavsumiy infektsiyalar paytida',
        warnings: 'Homilador ayollar shifokor bilan maslahatlashin',
        related: ['ERG-103', 'ERG-102'],
    },
    'ERG-102': {
        name: 'OmegaPlus',
        purpose: 'Yurak-qon tomir sog\'ligi, miya faoliyatini yaxshilash',
        howToUse: 'Kuniga 2 kapsula, ovqat bilan',
        suitableFor: '35+ yoshli foydalanuvchilar, aqliy ish bilan band bo\'lganlar',
        warnings: 'Qon suyultiruvchi dorilar qabul qilayotganlar ehtiyot bo\'lsin',
        related: ['ERG-101'],
    },
    'ERG-103': {
        name: 'Magniy B6',
        purpose: 'Stres, uyqusizlik, mushaklarni tinchlantirish',
        howToUse: 'Kuniga 1-2 kapsula, kechqurun ovqat bilan',
        suitableFor: 'Stressli hayot kechirayotganlar, uyqudan qiyin uxladiganlar',
        warnings: 'Buyrak kasalligi borlar shifokor bilan maslahatlashin',
        related: ['ERG-101'],
    },
    'ERG-201': {
        name: 'Bio Shampun',
        purpose: 'Soch to\'kilishini kamaytirish, skalpni parvarish qilish',
        howToUse: 'Haftasiga 3-4 marta, 2-3 daqiqа skalp massaji bilan',
        suitableFor: 'Soch to\'kilishi, zaif va yupqa sochlar',
        warnings: 'Bolalarda 3 yoshdan boshlab ishlatish mumkin',
        related: ['ERG-202'],
    },
    'ERG-202': {
        name: 'Argan Oil Serum',
        purpose: 'Quruq va shikastlangan sochlarni tiklash',
        howToUse: 'Yuvilgan sochga bir necha tomchi, uchlariga ishqalash',
        suitableFor: 'Quruq, mo\'rt, ranglangan sochlar',
        warnings: 'Juda yog\'li sochlar uchun kam miqdorda ishlating',
        related: ['ERG-201'],
    },
    'ERG-301': {
        name: 'Kollagen Krem',
        purpose: 'Terini mustahkamlash, ajinlarni kamaytirish',
        howToUse: 'Kecha va kunduz yuzga kichik miqdorda surtish',
        suitableFor: '30+ yoshli ayollar, quruq teri',
        warnings: 'Ko\'z atrofida ehtiyotkorlik bilan ishlating',
        related: [],
    },
    'ERG-401': {
        name: 'SlimTea',
        purpose: 'Metabolizmni tezlashtirish, vazn nazorati',
        howToUse: 'Kuniga 2 piyola, ovqatdan 30 daqiqa oldin',
        suitableFor: 'Vazn kamaytirmoqchi bo\'lganlar, sekin metabolizm',
        warnings: 'Kofein mavjud. Homilador ayollar uchun tavsiya etilmaydi',
        related: ['ERG-402'],
    },
    'ERG-402': {
        name: 'DetoxPlus',
        purpose: 'Organizmni tozalash, oshqozon-ichak traktini yaxshilash',
        howToUse: 'Kuniga 1 kapsula, ertalab osh suvi bilan',
        suitableFor: 'Oziqlanish muammolari, ichkamarlik, toksiklik',
        warnings: 'Og\'ir oshqozon kasalliklarida shifokor bilan maslahatlashin',
        related: ['ERG-401'],
    },
    'ERG-501': {
        name: 'Eco Clean',
        purpose: 'Kimyosiz barcha yuzalar uchun tozalovchi',
        howToUse: 'Bevosita yuza yoki shpritsel bilan purkaladi, sochiq bilan artiladi',
        suitableFor: 'Uy, ofis, bolalar xonasi uchun xavfsiz',
        warnings: 'Ko\'z yoki og\'iz bilan aloqa bo\'lmasin',
        related: [],
    }
};

const run = async (update, botToken) => {
    logger.info('[ProductLookupAgent] Running');
    const message = update.message;
    if (!message || !message.text) return;
    
    const chatId = message.chat.id;
    const text = message.text.trim().toUpperCase();
    
    // Extract product code — e.g. "ERG-201" or "erg201" or just "201"
    const codeMatch = text.match(/ERG[-\s]?(\d{3})/);
    if (!codeMatch) {
        await telegramApi.sendMessage(botToken, chatId,
            "Mahsulot kodi noto'g'ri. Format: ERG-101 (masalan: ERG-201, ERG-401)\n\n" +
            "Mavjud kategoriyalar:\n" +
            "🛡️ Sog'liq: ERG-101, ERG-102, ERG-103\n" +
            "💆 Soch: ERG-201, ERG-202\n" +
            "✨ Teri: ERG-301\n" +
            "⚖️ Vazn: ERG-401, ERG-402\n" +
            "🏠 Uy: ERG-501"
        );
        return;
    }
    
    const fullCode = `ERG-${codeMatch[1]}`;
    const product = PRODUCT_KNOWLEDGE[fullCode];
    
    if (!product) {
        await telegramApi.sendMessage(botToken, chatId,
            `❌ *${fullCode}* kodi topilmadi.\n\nBoshqa kod kiriting yoki kataloqga qarang.`
        );
        return;
    }
    
    const related = product.related.length > 0
        ? `\n📎 *Mos mahsulotlar:* ${product.related.join(', ')}`
        : '';
    
    const responseText =
        `📦 *${product.name}* — \`${fullCode}\`\n\n` +
        `🎯 *Maqsad:* ${product.purpose}\n\n` +
        `💊 *Qanday ishlatiladi:* ${product.howToUse}\n\n` +
        `👥 *Kim uchun:* ${product.suitableFor}\n\n` +
        `⚠️ *Ehtiyotkorlik:* ${product.warnings}` +
        related;
    
    await telegramApi.sendMessage(botToken, chatId, responseText);
};

// Check if a message looks like a product lookup request
const isProductQuery = (text) => {
    return /ERG[-\s]?\d{3}/i.test(text) || 
           /mahsulot.*kod/i.test(text) ||
           /код.*продукта/i.test(text);
};

module.exports = { run, isProductQuery, PRODUCT_KNOWLEDGE };
