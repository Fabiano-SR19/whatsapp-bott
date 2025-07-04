// Configurações do sistema de monitoramento e recuperação INTELIGENTE
module.exports = {
    // Configurações básicas
    welcomeMessage: "🎉 Bem-vindo(a), {user}! Aproveite o grupo {group} e leia as regras fixadas. Qualquer dúvida, chame um admin!",
    deleteConfirmation: false,
    maxReconnectAttempts: Infinity,
    reconnectDelay: 3000, // 3 segundos para recuperação rápida

    // Configurações de heartbeat INTELIGENTE
    heartbeat: {
        interval: 1 * 60 * 1000,        // 1 minuto (detecção rápida)
        maxFailures: 2,                  // 2 falhas antes de agir (rápido mas não agressivo)
        messageTimeout: 8 * 60 * 1000,   // 8 minutos sem mensagem (detecta travamento real)
        commandTimeout: 5 * 60 * 1000,   // 5 minutos sem comando (detecta travamento real)
        operationTimeout: 12 * 60 * 1000 // 12 minutos sem operação (detecta travamento real)
    },

    // Configurações de auto-recuperação INTELIGENTE
    recovery: {
        reconnectTimeout: 45000,                    // 45 segundos (rápido mas não agressivo)
        memoryCleanupInterval: 3 * 60 * 1000,      // 3 minutos (frequente mas não excessivo)
        forceRestartInterval: 45 * 60 * 1000,      // 45 minutos (preventivo mas não agressivo)
        cacheExpiry: 45 * 60 * 1000                // 45 minutos
    },

    // Configurações de timeout INTELIGENTE
    timeouts: {
        commandTimeout: 25000,  // 25 segundos (adequado para comandos)
        retryDelay: 800,        // 800ms entre tentativas (rápido mas não agressivo)
        maxRetries: 2           // 2 tentativas (rápido mas não agressivo)
    },

    // Configurações do Puppeteer
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-javascript',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
        ],
        timeout: 45000,        // 45 segundos (rápido mas não agressivo)
        protocolTimeout: 45000 // 45 segundos (rápido mas não agressivo)
    }
}; 