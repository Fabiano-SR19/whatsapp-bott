// Configurações do sistema de monitoramento e recuperação
module.exports = {
    // Configurações básicas
    welcomeMessage: "🎉 Bem-vindo(a), {user}! Aproveite o grupo {group} e leia as regras fixadas. Qualquer dúvida, chame um admin!",
    deleteConfirmation: false,
    maxReconnectAttempts: Infinity,
    reconnectDelay: 5000,

    // Configurações de heartbeat e monitoramento
    heartbeat: {
        interval: 2 * 60 * 1000, // 2 minutos
        maxFailures: 3,
        messageTimeout: 15 * 60 * 1000, // 15 minutos sem mensagem
        commandTimeout: 10 * 60 * 1000, // 10 minutos sem comando
        operationTimeout: 20 * 60 * 1000 // 20 minutos sem operação
    },

    // Configurações de auto-recuperação
    recovery: {
        reconnectTimeout: 60000, // 1 minuto
        memoryCleanupInterval: 5 * 60 * 1000, // 5 minutos
        forceRestartInterval: 1 * 60 * 60 * 1000, // 1 hora
        cacheExpiry: 60 * 60 * 1000 // 1 hora
    },

    // Configurações de timeout
    timeouts: {
        commandTimeout: 10000, // 10 segundos
        retryDelay: 1000,
        maxRetries: 3
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