/**
 * telegramGateway.js
 *
 * Entry point for all Telegram webhook updates.
 * Handles two special cases before delegating to the router:
 *   1. chat_join_request  → vipService
 *   2. approve_pay_ / decline_pay_ callback_query → billingAgent approval flow
 */

const logger = require('../utils/logger');
const router = require('../core/router');

const handleTelegramUpdate = async (req, res) => {
    try {
        const botToken = req.params.botToken || req.query.token;
        const update = req.body;

        if (!botToken) {
            logger.warn('Received update without bot token');
            return res.status(400).send('Missing bot token');
        }

        if (!update) {
            logger.warn('Received empty update');
            return res.status(400).send('Empty update');
        }

        logger.info(`[Gateway OK] Received Telegram update for bot: ${botToken.substring(0, 10)}...`);

        // ── 1. VIP group join requests ────────────────────────────────────────
        if (update.chat_join_request) {
            const vipService = require('../services/vipService');
            await vipService.handleJoinRequest(update, botToken);
            return res.status(200).send('OK');
        }

        // ── 2. Billing Admin Actions (approve / decline payment) ──────────────
        // These callbacks come back on the Master Bot token when the admin taps
        // an inline button on a forwarded payment screenshot.
        if (update.callback_query) {
            const cbData = update.callback_query.data || '';

            if (cbData.startsWith('approve_pay_') || cbData.startsWith('decline_pay_')) {
                await handleBillingCallback(update.callback_query, botToken);
                return res.status(200).send('OK');
            }
        }

        // ── 3. Standard routing ───────────────────────────────────────────────
        await router.routeUpdate(update, botToken).catch(err =>
            logger.error('Router execution error:', err)
        );

        res.status(200).send('OK');
    } catch (error) {
        logger.error('Error in telegram gateway:', error);
        res.status(200).send('OK'); // Prevent infinite retries from Telegram
    }
};

// ─── Billing callback handler ──────────────────────────────────────────────

const handleBillingCallback = async (callbackQuery, botToken) => {
    const telegramApi = require('../utils/telegramApi');
    const { db } = require('../config/db');
    const env = require('../config/env');

    const cbData = callbackQuery.data;
    const adminChatId = callbackQuery.message.chat.id;
    const adminMsgId = callbackQuery.message.message_id;

    // Always silence the spinner on the admin's button press
    await telegramApi.answerCallbackQuery(botToken, callbackQuery.id);

    // ── Approve ──────────────────────────────────────────────────────────────
    if (cbData.startsWith('approve_pay_')) {
        const userId = cbData.replace('approve_pay_', '');
        logger.info(`[BillingGateway] Approving payment for user ${userId}`);

        try {
            // Credit the user's quota — add 500 tokens (refine per tier later)
            const APPROVED_TOKEN_CREDIT = 500;
            const docRef = db.collection('quotas').doc(String(userId));
            const doc = await docRef.get();

            if (doc.exists) {
                const current = doc.data();
                await docRef.update({
                    limit: (current.limit || 0) + APPROVED_TOKEN_CREDIT,
                    last_payment_at: new Date().toISOString(),
                    last_payment_status: 'approved',
                });
            } else {
                // First-time user — bootstrap their quota record
                await docRef.set({
                    used: 0,
                    limit: APPROVED_TOKEN_CREDIT,
                    last_reset: new Date().toISOString(),
                    last_payment_at: new Date().toISOString(),
                    last_payment_status: 'approved',
                });
            }

            // Notify the user via the Master Bot
            const masterToken = env.MASTER_BOT_TOKEN;
            if (masterToken && userId) {
                await telegramApi.sendMessage(
                    masterToken,
                    userId,
                    `✅ <b>To'lovingiz tasdiqlandi!</b>\n\n` +
                    `Balansingizga <b>${APPROVED_TOKEN_CREDIT}</b> xabar qo'shildi.\n` +
                    `Endi botingizdan to'liq foydalanishingiz mumkin! 🎉`
                );
            }

            // Edit admin message to remove buttons
            await telegramApi.editMessageText(
                botToken,
                adminChatId,
                adminMsgId,
                `${callbackQuery.message.caption || ''}\n\n✅ <b>Tasdiqlandi</b> — ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`
            );

            logger.info(`[BillingGateway] ✅ Payment approved for user ${userId} (+${APPROVED_TOKEN_CREDIT} tokens)`);
        } catch (err) {
            logger.error('[BillingGateway] Error approving payment:', err);
        }

        return;
    }

    // ── Decline ──────────────────────────────────────────────────────────────
    if (cbData.startsWith('decline_pay_')) {
        const userId = cbData.replace('decline_pay_', '');
        logger.info(`[BillingGateway] Declining payment for user ${userId}`);

        try {
            // Record the decline in Firestore
            await db.collection('quotas').doc(String(userId)).set({
                last_payment_at: new Date().toISOString(),
                last_payment_status: 'declined',
            }, { merge: true });

            // Notify the user via the Master Bot
            const masterToken = env.MASTER_BOT_TOKEN;
            if (masterToken && userId) {
                await telegramApi.sendMessage(
                    masterToken,
                    userId,
                    `❌ <b>To'lovingiz rad etildi.</b>\n\n` +
                    `Chek qabul qilinmadi yoki xato miqdorda o'tkazilgan bo'lishi mumkin.\n\n` +
                    `Yordam uchun adminга murojaat qiling: @MSU_Berdibekov`
                );
            }

            // Edit admin message to remove buttons
            await telegramApi.editMessageText(
                botToken,
                adminChatId,
                adminMsgId,
                `${callbackQuery.message.caption || ''}\n\n❌ <b>Rad etildi</b> — ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`
            );

            logger.info(`[BillingGateway] ❌ Payment declined for user ${userId}`);
        } catch (err) {
            logger.error('[BillingGateway] Error declining payment:', err);
        }
    }
};

module.exports = { handleTelegramUpdate };
