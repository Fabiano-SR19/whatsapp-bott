// Configurações do sistema de monitoramento e recuperação
module.exports = {
    // Configurações básicas
    welcomeMessage: "🎉 Bem-vindo(a), {user}! Aproveite o grupo {group} e leia as regras fixadas. Qualquer dúvida, chame um admin!",
    deleteConfirmation: false,
    maxReconnectAttempts: Infinity,
    reconnectDelay: 5000,

    // Configurações de heartbeat e monitoramento
    heartbeat: {
        interval: 5 * 60 * 1000,        // 5 minutos (aumentado de 2 para 5)
        maxFailures: 5,                  // Máximo de falhas antes de reiniciar (aumentado de 3 para 5)
        messageTimeout: 30 * 60 * 1000,  // 30 minutos sem mensagem (aumentado de 15 para 30)
        commandTimeout: 20 * 60 * 1000,  // 20 minutos sem comando (aumentado de 10 para 20)
        operationTimeout: 45 * 60 * 1000 // 45 minutos sem operação (aumentado de 20 para 45)
    },

    // Configurações de auto-recuperação
    recovery: {
        reconnectTimeout: 120000,                   // 2 minutos (aumentado de 1 para 2)
        memoryCleanupInterval: 10 * 60 * 1000,     // 10 minutos (aumentado de 5 para 10)
        forceRestartInterval: 2 * 60 * 60 * 1000,  // 2 horas (aumentado de 1 para 2)
        cacheExpiry: 60 * 60 * 1000                // 1 hora
    },

    // Configurações de timeout
    timeouts: {
        commandTimeout: 15000,  // 15 segundos (aumentado de 10 para 15)
        retryDelay: 1000,       // Delay entre tentativas (1 segundo)
        maxRetries: 3           // Máximo de tentativas
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
        timeout: 60000,
        protocolTimeout: 60000
    }
}; 