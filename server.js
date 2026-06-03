const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ========== CORS НАСТРОЙКА ДЛЯ NETLIFY ==========
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8888',  // Netlify dev
    'https://твой-сайт.netlify.app',  // ЗАМЕНИ НА СВОЙ
    'https://*.netlify.app'
];

app.use(cors({
    origin: function(origin, callback) {
        // Разрешить запросы без origin (например, от curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.some(allowed => origin === allowed || origin.endsWith('.netlify.app'))) {
            callback(null, true);
        } else {
            console.log('Blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Обработка preflight запросов
app.options('*', cors());

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ... остальной код сервера (db, telegram, routes) 
