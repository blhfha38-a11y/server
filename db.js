const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Инициализация таблиц
async function initDB() {
    const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            phone TEXT NOT NULL,
            code TEXT NOT NULL,
            verified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '15 minutes'
        )
    `;
    
    const createIndexPhone = `CREATE INDEX IF NOT EXISTS idx_sessions_phone ON sessions(phone)`;
    const createIndexExpires = `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`;
    
    await pool.query(createSessionsTable);
    await pool.query(createIndexPhone);
    await pool.query(createIndexExpires);
    
    console.log('✅ PostgreSQL ready');
    
    // Автоочистка просроченных сессий каждые 5 минут
    setInterval(async () => {
        await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
        console.log('🧹 Cleaned expired sessions');
    }, 5 * 60 * 1000);
}

// Создание новой сессии
async function createSession(sessionId, phone, code) {
    try {
        await pool.query(
            'INSERT INTO sessions (session_id, phone, code) VALUES ($1, $2, $3)',
            [sessionId, phone, code]
        );
        return true;
    } catch (err) {
        console.error('DB insert error:', err);
        return false;
    }
}

// Проверка кода и верификация сессии
async function verifySession(sessionId, code) {
    const result = await pool.query(
        `UPDATE sessions 
         SET verified = TRUE 
         WHERE session_id = $1 AND code = $2 AND verified = FALSE AND expires_at > NOW()
         RETURNING session_id`,
        [sessionId, code]
    );
    return result.rows.length > 0;
}

// Проверка статуса сессии
async function checkSession(sessionId) {
    const result = await pool.query(
        'SELECT verified FROM sessions WHERE session_id = $1 AND expires_at > NOW()',
        [sessionId]
    );
    return result.rows[0] || null;
}

// Количество верифицированных сессий (для счётчика)
async function getVerifiedCount() {
    const result = await pool.query('SELECT COUNT(*) FROM sessions WHERE verified = TRUE');
    return parseInt(result.rows[0].count);
}

module.exports = { initDB, createSession, verifySession, checkSession, getVerifiedCount };
