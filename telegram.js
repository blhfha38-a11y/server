async function sendTelegramCode(phone, code, sessionId, siteUrl) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    // Если нет токена — демо-режим (логируем в консоль)
    if (!botToken || !chatId) {
        console.log(`📢 [DEMO] Telegram not configured. Would send to ${phone}: code ${code}`);
        console.log(`🔗 Deep link: ${siteUrl}/?sessionId=${sessionId}&code=${code}`);
        return true;
    }
    
    const deepLink = `${siteUrl}/?sessionId=${sessionId}&code=${code}`;
    const message = `🔐 *НОВЫЙ ЗАПРОС ДОСТУПА*\n\n📱 Номер: ${phone}\n🔑 Код: ${code}\n\n✅ [ПОДТВЕРДИТЬ ДОСТУП](${deepLink})\n\n_Ссылка действительна 15 минут_`;
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            console.log(`✅ Telegram message sent to chat ${chatId} for phone ${phone}`);
            return true;
        } else {
            console.error('❌ Telegram API error:', result.description);
            return false;
        }
    } catch (err) {
        console.error('❌ Fetch error to Telegram:', err.message);
        return false;
    }
}

module.exports = { sendTelegramCode };
