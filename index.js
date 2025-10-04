// index.js - MAIN BOT FILE WITH PHONE NUMBER LINKING SUPPORT
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

// Session generation function with PHONE NUMBER LINKING
async function startNewSession(ownerNumber = '', onCode) {
  try {
    console.log('🔐 Starting WhatsApp session with phone linking...');
    
    const { version } = await fetchLatestBaileysVersion();
    const sessionId = 'session_' + Date.now();
    const authFolder = path.join(SESS_DIR, `auth_${sessionId}`);
    
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
      version,
      auth: state,
      // DISABLE QR CODE, ENABLE PHONE LINKING
      printQRInTerminal: false,
      logger: { level: 'silent' },
      // ADD PHONE LINKING CONFIG
      phoneResponse: async (phoneNumber) => {
        console.log('📱 Phone number detected:', phoneNumber);
        return phoneNumber;
      }
    });

    sock.ev.on('creds.update', saveCreds);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout after 2 minutes'));
      }, 120000);

      sock.ev.on('connection.update', async (update) => {
        const { connection, qr, isNewLogin, code } = update;
        
        console.log('📡 Connection update:', { connection, isNewLogin, code });
        
        // HANDLE PHONE LINKING CODE (8-digit code)
        if (code && typeof onCode === 'function') {
          console.log('🔢 8-digit linking code received:', code);
          onCode(code);
        }
        
        // Handle successful connection
        if (connection === 'open') {
          clearTimeout(timeout);
          console.log('✅✅✅ WhatsApp CONNECTED SUCCESSFULLY!');
          
          if (ownerNumber) {
            try {
              const jid = `${ownerNumber}@s.whatsapp.net`;
              await sock.sendMessage(jid, {
                text: `✅ SWORD BOT - SESSION CREATED\n\nSession ID: ${sessionId}\n\nUse this ID in your bot configuration.`
              });
              console.log('✅ Confirmation message sent to owner');
            } catch (e) {
              console.warn('⚠️ Could not send message:', e.message);
            }
          }
          
          resolve(sessionId);
        }
        
        // Handle connection errors
        if (connection === 'close') {
          clearTimeout(timeout);
          reject(new Error('Connection closed unexpectedly'));
        }
      });
    });
  } catch (error) {
    console.error('Session error:', error);
    throw error;
  }
}

// Web API Routes - UPDATED FOR PHONE LINKING
app.post('/api/start-session', async (req, res) => {
  try {
    const { ownerNumber, phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number required',
        message: 'Please provide a phone number for linking'
      });
    }
    
    const tempId = Date.now().toString();
    
    const sessionResult = await new Promise(async (resolve, reject) => {
      try {
        const sessionId = await startNewSession(ownerNumber || '', (linkingCode) => {
          // Store the 8-digit linking code
          activeSessions.set(tempId, {
            linkingCode,
            status: 'code_ready',
            phoneNumber: phoneNumber,
            ownerNumber: ownerNumber || '',
            timestamp: Date.now()
          });
          
          // Return the linking code to frontend
          resolve({
            tempId,
            linkingCode,
            status: 'code_ready',
            message: 'Use this 8-digit code in WhatsApp > Linked Devices'
          });
        });
        
        // Session connected successfully
        activeSessions.set(tempId, {
          sessionId,
          status: 'connected',
          phoneNumber: phoneNumber,
          ownerNumber: ownerNumber || '',
          timestamp: Date.now()
        });
        
        resolve({
          sessionId,
          status: 'connected',
          message: 'Session created successfully'
        });
        
      } catch (error) {
        reject(error);
      }
    });

    res.json(sessionResult);
    
  } catch (error) {
    console.error('💥 API Error:', error);
    res.status(500).json({
      error: 'Failed to start session',
      details: error.message
    });
  }
});

app.get('/api/session-status', (req, res) => {
  const { tempId } = req.query;
  
  if (!tempId || !activeSessions.has(tempId)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const session = activeSessions.get(tempId);
  
  if (Date.now() - session.timestamp > 10 * 60 * 1000) {
    activeSessions.delete(tempId);
    return res.status(404).json({ error: 'Session expired' });
  }
  
  res.json(session);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Sword Bot + Phone Linking',
    timestamp: new Date().toISOString()
  });
});

// Serve web pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/session.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'session.html'));
});

// Start everything
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sword Bot + Phone Linking running on port ${PORT}`);
  console.log(`📱 Session Page: http://0.0.0.0:${PORT}/session.html`);
  console.log(`🩺 Health: http://0.0.0.0:${PORT}/health`);
});
