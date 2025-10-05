// index.js - FRONTEND ONLY (for sword-ai-b)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// SERVE HTML PAGES ONLY - No WhatsApp logic
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/session.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'session.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Frontend Website' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend Website running on port ${PORT}`);
});
