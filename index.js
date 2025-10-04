// index.js - MAIN BOT FILE WITH WEB SERVER - FIXED VERSION
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Your existing bot imports and configuration
// [YOUR EXISTING BOT IMPORTS HERE]
// import config from './config.js';
// import { yourBotFunctions } from './core/whatever.js';

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

// Session generation function (from startsession.js) - FIXED
async function startNewSession(ownerNumber = '', onQR) {
  try {
    console.log('🔐 Starting WhatsApp session...');
    
    const { version } = await fetchLatestBaileysVersion();
    const sessionId = 'session_' + Date.now();
    const authFolder = path.join(SESS_DIR, `auth_${sessionId}`);
    
    // FIX: Use MultiFileAuthState instead of SingleFile
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: { level: 'silent' }
    });

    sock.ev.on('creds.update', saveCreds);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout after 2 minutes'));
      }, 120000);

      sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        
        if (qr && typeof onQR === 'function') {
          onQR(qr);
        }
        
        if (connection === 'open') {
          clearTimeout(timeout);
          
          if (ownerNumber) {
            try {
              const jid = `${ownerNumber}@s.whatsapp.net`;
              await sock.sendMessage(jid, {
                text: `✅ SWORD BOT - SESSION CREATED\n\nSession ID: ${sessionId}\n\nUse this ID in your bot configuration.`
              });
            } catch (e) {
              console.warn('Could not send message:', e.message);
            }
          }
          
          resolve(sessionId);
        }
      });
    });
  } catch (error) {
    console.error('Session error:', error);
    throw error;
  }
}

// Web API Routes
app.post('/api/start-session', async (req, res) => {
  try {
    const { ownerNumber, returnQRCode } = req.body;
    
    const tempId = Date.now().toString();
    
    const sessionResult = await new Promise(async (resolve, reject) => {
      try {
        const sessionId = await startNewSession(ownerNumber || '', (qr) => {
          activeSessions.set(tempId, {
            qr,
            status: 'qr_ready',
            ownerNumber: ownerNumber || '',
            timestamp: Date.now()
          });
          
          if (returnQRCode) {
            resolve({
              tempId,
              qr,
              status: 'qr_ready',
              message: 'Scan QR code with WhatsApp'
            });
          }
        });
        
        activeSessions.set(tempId, {
          sessionId,
          status: 'connected',
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
    service: 'Sword Bot + Session Generator',
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

// YOUR EXISTING BOT CODE GOES HERE
// [YOUR ACTUAL BOT LOGIC - message handling, commands, etc.]

// Start everything
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sword Bot + Session Generator running on port ${PORT}`);
  console.log(`📱 Session Page: http://0.0.0.0:${PORT}/session.html`);
  console.log(`🩺 Health: http://0.0.0.0:${PORT}/health`);
  
  // Initialize your bot here
  // initializeYourBot();
});
