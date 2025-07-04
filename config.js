// Configurações do sistema de monitoramento e recuperação
module.exports = {
    // Configurações básicas
    welcomeMessage: "🎉 Bem-vindo(a), {user}! Aproveite o grupo {group} e leia as regras fixadas. Qualquer dúvida, chame um admin!",
    deleteConfirmation: false,
    maxReconnectAttempts: Infinity,
    reconnectDelay: 5000,

    // Configurações de heartbeat e monitoramento
    heartbeat: {
        interval: 2 * 60 * 1000,        // 2 minutos (menos frequente)
        maxFailures: 3,                  // 3 falhas antes de reiniciar
        messageTimeout: 10 * 60 * 1000,  // 10 minutos sem mensagem
        commandTimeout: 8 * 60 * 1000,   // 8 minutos sem comando
        operationTimeout: 15 * 60 * 1000 // 15 minutos sem operação
    },

    // Configurações de auto-recuperação
    recovery: {
        reconnectTimeout: 60000,                    // 1 minuto
        memoryCleanupInterval: 5 * 60 * 1000,      // 5 minutos
        forceRestartInterval: 60 * 60 * 1000,      // 1 hora (menos frequente)
        cacheExpiry: 60 * 60 * 1000                // 1 hora
    },

    // Configurações de timeout
    timeouts: {
        commandTimeout: 45000,  // 45 segundos (mais tolerante)
        retryDelay: 1000,       // 1 segundo entre tentativas
        maxRetries: 3           // 3 tentativas
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
        timeout: 60000,        // Aumentado para 60 segundos
        protocolTimeout: 60000 // Aumentado para 60 segundos
    }
}; 