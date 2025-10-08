// index.js - FRONTEND ONLY
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'session.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Frontend' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🌐 Frontend running on port', PORT);
});
