const telegramApi = require('../utils/telegramApi');
const leadService = require('../services/leadService');
const subscriptionService = require('../services/subscriptionService');
const sheetsService = require('../services/sheetsService');
const logger = require('../utils/logger');
const env = require('../config/env');
const { db } = require('../config/db');

const run = async (update, botToken) => {
    logger.info('Running adminAgent');
    const message = update.message;
    if (!message) return;

    const chatId = message.chat.id;
    const text = (message.text || '').trim();

    // Security double-check — only the admin can use this
    if (String(chatId) !== String(env.ADMIN_CHAT_ID)) {
        await telegramApi.sendMessage(botToken, chatId, "⛔ Ruxsat yo'q.");
        return;
    }

    const parts = text.split(' ');
    const cmd = parts[0];
    const arg1 = parts[1] || '';

    // ─── /approve <leader_telegram_id> ───────────────────────────────
    if (cmd === '/approve') {
        if (!arg1) {
            await telegramApi.sendMessage(botToken, chatId, "⚠️ Format: /approve <leader_telegram_id>");
            return;
        }
        try {
            const newExpiry = await subscriptionService.activateSubscription(arg1);
            const expiryStr = new Date(newExpiry).toLocaleDateString('uz-UZ');
            await telegramApi.sendMessage(botToken, chatId,
                `✅ Leader \`${arg1}\` obunasi faollashtirildi!\n📅 Tugash sanasi: *${expiryStr}*`);

            // Notify the leader directly via MASTER_BOT
            if (env.MASTER_BOT_TOKEN) {
                await telegramApi.sendMessage(env.MASTER_BOT_TOKEN, arg1,
                    `🎉 Obunangiz faollashtirildi!\n\n` +
                    `📅 Keyingi to'lov sanasi: *${expiryStr}*\n\n` +
                    `Endi botingiz to'liq ishlaydi. Tabriklaymiz! 🚀`
                );
            }
        } catch (err) {
            await telegramApi.sendMessage(botToken, chatId, `❌ Xatolik: ${err.message}`);
        }
        return;
    }

    // ─── /sub <leader_telegram_id> — check subscription status ──────
    if (cmd === '/sub') {
        if (!arg1) {
            await telegramApi.sendMessage(botToken, chatId, "⚠️ Format: /sub <leader_telegram_id>");
            return;
        }
        try {
            const access = await subscriptionService.checkLeaderAccess(arg1);
            const leaderDoc = await db.collection('leaders').doc(arg1).get();
            const data = leaderDoc.exists ? leaderDoc.data() : {};
            await telegramApi.sendMessage(botToken, chatId,
                `👤 Leader: \`${arg1}\`\n` +
                `📛 Nomi: ${data.name || '—'}\n` +
                `🔌 Status: *${access.status}*\n` +
                `📅 Tugaydi: ${data.subscription_expiry ? new Date(data.subscription_expiry).toLocaleDateString('uz-UZ') : '—'}\n` +
                `📞 Tel: ${data.phone || '—'}`
            );
        } catch (err) {
            await telegramApi.sendMessage(botToken, chatId, `❌ Xatolik: ${err.message}`);
        }
        return;
    }

    // ─── /stats — platform-wide overview ────────────────────────────
    if (cmd === '/stats') {
        try {
            const today = new Date(); today.setHours(0,0,0,0);
            const [leadsSnap, leadsTodaySnap, leadersSnap] = await Promise.all([
                db.collection('leads').get(),
                db.collection('leads').where('created_at', '>=', today.toISOString()).get(),
                db.collection('leaders').get()
            ]);
            const activeLeaders = leadersSnap.docs.filter(d => d.data().subscription_expiry && new Date(d.data().subscription_expiry) > new Date()).length;
            await telegramApi.sendMessage(botToken, chatId,
                `📊 *Platform Statistikasi*\n\n` +
                `👥 Jami Leaderlar: ${leadersSnap.size}\n` +
                `✅ Faol obunalar: ${activeLeaders}\n` +
                `📥 Jami leadlar: ${leadsSnap.size}\n` +
                `🔥 Bugungi leadlar: ${leadsTodaySnap.size}`
            );
        } catch (err) {
            await telegramApi.sendMessage(botToken, chatId, `❌ Stats xatolik: ${err.message}`);
        }
        return;
    }

    // ─── /leaders — list all registered leaders ──────────────────────
    if (cmd === '/leaders') {
        try {
            const snap = await db.collection('leaders').get();
            if (snap.empty) {
                await telegramApi.sendMessage(botToken, chatId, "Hali leader yo'q.");
                return;
            }
            const lines = snap.docs.map(d => {
                const data = d.data();
                const expiry = data.subscription_expiry ? new Date(data.subscription_expiry).toLocaleDateString('uz-UZ') : 'yo\'q';
                return `• \`${d.id}\` — ${data.name || '?'} | ${expiry}`;
            });
            await telegramApi.sendMessage(botToken, chatId,
                `👥 *Barcha Leaderlar* (${snap.size}):\n\n` + lines.join('\n')
            );
        } catch (err) {
            await telegramApi.sendMessage(botToken, chatId, `❌ ${err.message}`);
        }
        return;
    }

    // ─── /broadcast <message> — send to all leaders ──────────────────
    if (cmd === '/broadcast') {
        const broadcastMsg = parts.slice(1).join(' ');
        if (!broadcastMsg) {
            await telegramApi.sendMessage(botToken, chatId, "⚠️ Format: /broadcast <xabar matni>");
            return;
        }
        try {
            const snap = await db.collection('leaders').get();
            let sent = 0, failed = 0;
            for (const doc of snap.docs) {
                try {
                    await telegramApi.sendMessage(env.MASTER_BOT_TOKEN || botToken, doc.id,
                        `📣 *Ersag Admin xabari:*\n\n${broadcastMsg}`
                    );
                    sent++;
                } catch (_) { failed++; }
            }
            await telegramApi.sendMessage(botToken, chatId,
                `📣 Xabar yuborildi!\n✅ ${sent} ta muvaffaqiyatli\n❌ ${failed} ta xato`
            );
        } catch (err) {
            await telegramApi.sendMessage(botToken, chatId, `❌ Broadcast xatolik: ${err.message}`);
        }
        return;
    }

    // ─── /sheets-refresh — clear Sheets cache ────────────────────────
    if (cmd === '/sheets-refresh') {
        sheetsService.clearCache();
        await telegramApi.sendMessage(botToken, chatId, "♻️ Google Sheets keshi tozalandi. Keyingi so'rovda yangi ma'lumot keladi.");
        return;
    }

    // ─── Default admin help menu ─────────────────────────────────────
    await telegramApi.sendMessage(botToken, chatId,
        "👤 *Admin Panel*\n\n" +
        "/approve `<id>` — Obunani faollashtirish\n" +
        "/sub `<id>` — Obuna statusini ko'rish\n" +
        "/stats — Platform statistikasi\n" +
        "/leaders — Barcha leaderlar ro'yxati\n" +
        "/broadcast `<xabar>` — Barcha leaderlarga xabar\n" +
        "/sheets-refresh — Sheets keshini yangilash"
    );
};

module.exports = { run };

