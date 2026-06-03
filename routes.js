// Если хочешь вынести маршруты отдельно
const express = require('express');
const router = express.Router();
const { createSession, verifySession, checkSession, getVerifiedCount } = require('./db');
const { sendTelegramCode } = require('./telegram');

router.post('/send-code', async (req, res) => {
    // та же логика, что в server.js
});

router.get('/check-session/:sessionId', async (req, res) => {
    // ...
});

router.post('/auto-verify', async (req, res) => {
    // ...
});

router.get('/stats', async (req, res) => {
    const count = await getVerifiedCount();
    res.json({ total: count });
});

module.exports = router;
