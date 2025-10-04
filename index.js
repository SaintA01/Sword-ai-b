// index.js - COMPLETELY FIXED VERSION WITH PHONE LINKING
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store active sessions for web interface
const activeSessions = new Map();
const SESS_DIR = path.resolve('./sessions');

if (!fs.existsSync(SESS_DIR)) {
  fs.mkdirSync(SESS_DIR, { recursive: true });
}

// SIMPLE SESSION GENERATION - FIXED FOR PHONE LINKING
async function startNewSession(phoneNumber = '', ownerNumber = '', onCode, onQR) {
  try {
    console.log('🔐 Starting WhatsApp session...');
    console.log('📱 Phone number:', phoneNumber || 'Not provided');
    console.log('👤 Owner number:', ownerNumber || 'Not provided');
    
    const { version } = await fetchLatestBaileysVersion();
    const sessionId = 'session_' + Date.now();
    const authFolder = path.join(SESS_DIR, `auth_${sessionId}`);
    
    console.log('📁 Auth folder:', authFolder);
    
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true, // This helps with debugging
      logger: { level: 'silent' },
      // Enable phone linking
      mobile: true
    });

    sock.ev.on('creds.update', saveCreds);

    return new Promise((resolve, reject) => {
      let connectionEstablished = false;
      
      const timeout = setTimeout(() => {
        if (!connectionEstablished) {
          console.log('⏰ Session timeout after 2 minutes');
          reject(new Error('Timeout: No response from WhatsApp in 2 minutes'));
        }
      }, 120000);

      sock.ev.on('connection.update', async (update) => {
        const { connection, qr, isNewLogin, code, lastDisconnect } = update;
        
        console.log('📡 Connection update:', { 
          connection, 
          qr: qr ? 'QR received' : 'No QR',
          code: code ? 'Code received' : 'No code',
          isNewLogin 
        });
        
        // Handle QR Code (for QR scanning method)
        if (qr && typeof onQR === 'function') {
          console.log('🎯 QR Code received');
          onQR(qr);
        }
        
        // Handle Phone Linking Code (8-digit code)
        if (code && typeof onCode === 'function') {
          console.log('🔢 8-digit linking code received:', code);
          onCode(code);
        }
        
        // Handle successful connection
        if (connection === 'open') {
          console.log('✅✅✅ WhatsApp CONNECTED SUCCESSFULLY!');
          connectionEstablished = true;
          clearTimeout(timeout);
          
          // Send confirmation message if owner number provided
          if (ownerNumber && ownerNumber.trim() !== '') {
            try {
              const jid = ownerNumber.includes('@') ? ownerNumber : `${ownerNumber}@s.whatsapp.net`;
              console.log('📤 Sending confirmation to:', jid);
              
              await sock.sendMessage(jid, {
                text: `✅ SWORD BOT - SESSION CREATED\n\nSession ID: ${sessionId}\n\nUse this ID in your bot configuration.`
              });
              
              console.log('✅ Confirmation message sent');
            } catch (e) {
              console.warn('⚠️ Could not send WhatsApp message:', e.message);
            }
          }
          
          resolve(sessionId);
        }
        
        // Handle connection closure
        if (connection === 'close') {
          console.log('🔌 Connection closed');
          clearTimeout(timeout);
          
          if (lastDisconnect?.error?.output?.statusCode !== 200) {
            reject(new Error('Connection closed: ' + (lastDisconnect?.error?.message || 'Unknown error')));
          }
        }
      });

      // Handle connection errors
      sock.ev.on('connection.failed', (error) => {
        console.error('💥 Connection failed:', error);
        clearTimeout(timeout);
        reject(new Error('Connection failed: ' + error.message));
      });
    });
  } catch (error) {
    console.error('💥 Error in startNewSession:', error);
    throw error;
  }
}

// WEB API ROUTES - COMPLETELY FIXED
app.post('/api/start-session', async (req, res) => {
  try {
    const { phoneNumber, ownerNumber, returnQRCode } = req.body;
    
    console.log('📱 API Called: /api/start-session', { phoneNumber, ownerNumber, returnQRCode });
    
    if (!phoneNumber && !returnQRCode) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Provide either phoneNumber for linking or returnQRCode=true for QR'
      });
    }
    
    const tempId = Date.now().toString();
    
    const sessionResult = await new Promise(async (resolve, reject) => {
      try {
        const sessionId = await startNewSession(
          phoneNumber || '', 
          ownerNumber || '', 
          // Phone linking code callback
          (linkingCode) => {
            console.log('🔢 Sending linking code to frontend:', linkingCode);
            activeSessions.set(tempId, {
              linkingCode,
              status: 'code_ready',
              phoneNumber: phoneNumber || '',
              ownerNumber: ownerNumber || '',
              timestamp: Date.now()
            });
            
            resolve({
              tempId,
              linkingCode,
              status: 'code_ready',
              message: 'Use this 8-digit code in WhatsApp > Linked Devices'
            });
          },
          // QR code callback  
          (qrCode) => {
            console.log('🎯 Sending QR code to frontend');
            activeSessions.set(tempId, {
              qr: qrCode,
              status: 'qr_ready',
              phoneNumber: phoneNumber || '',
              ownerNumber: ownerNumber || '',
              timestamp: Date.now()
            });
            
            if (returnQRCode) {
              resolve({
                tempId,
                qr: qrCode,
                status: 'qr_ready',
                message: 'Scan the QR code with WhatsApp'
              });
            }
          }
        );
        
        // Session connected successfully
        console.log('✅ Session connected successfully:', sessionId);
        activeSessions.set(tempId, {
          sessionId,
          status: 'connected',
          phoneNumber: phoneNumber || '',
          ownerNumber: ownerNumber || '',
          timestamp: Date.now()
        });
        
        resolve({
          sessionId,
          status: 'connected',
          message: 'Session created successfully'
        });
        
      } catch (error) {
        console.error('❌ Session creation failed:', error);
        reject(error);
      }
    });

    console.log('✅ Sending success response to frontend');
    res.json(sessionResult);
    
  } catch (error) {
    console.error('💥 API Error:', error);
    res.status(500).json({
      error: 'Failed to start session',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/api/session-status', (req, res) => {
  const { tempId } = req.query;
  
  console.log('📊 Session status check:', tempId);
  
  if (!tempId || !activeSessions.has(tempId)) {
    return res.status(404).json({ 
      error: 'Session not found',
      availableSessions: Array.from(activeSessions.keys())
    });
  }
  
  const session = activeSessions.get(tempId);
  
  // Clean up old sessions (10 minutes)
  if (Date.now() - session.timestamp > 10 * 60 * 1000) {
    activeSessions.delete(tempId);
    return res.status(404).json({ error: 'Session expired' });
  }
  
  console.log('📊 Returning session status:', session.status);
  res.json(session);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Sword Bot + Phone Linking',
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.size
  });
});

// Serve web pages
app.get('/', (req, res) => {
  res.json({
    message: 'Sword Bot Backend API',
    endpoints: {
      health: '/health',
      startSession: 'POST /api/start-session',
      sessionStatus: 'GET /api/session-status'
    }
  });
});

app.get('/session.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'session.html'));
});

// Start everything
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sword Bot + Phone Linking running on port ${PORT}`);
  console.log(`📱 Health: http://0.0.0.0:${PORT}/health`);
  console.log(`🔗 Session Page: http://0.0.0.0:${PORT}/session.html`);
  console.log('✅ Backend is ready to accept requests!');
});
