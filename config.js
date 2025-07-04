// Configurações do sistema de monitoramento e recuperação
module.exports = {
    // Configurações básicas
    welcomeMessage: "🎉 Bem-vindo(a), {user}! Aproveite o grupo {group} e leia as regras fixadas. Qualquer dúvida, chame um admin!",
    deleteConfirmation: false,
    maxReconnectAttempts: Infinity,
    reconnectDelay: 3000,

    // Configurações de heartbeat e monitoramento
    heartbeat: {
        interval: 1 * 60 * 1000,        // 1 minuto (muito mais frequente)
        maxFailures: 2,                  // Apenas 2 falhas antes de reiniciar
        messageTimeout: 5 * 60 * 1000,   // 5 minutos sem mensagem (muito agressivo)
        commandTimeout: 3 * 60 * 1000,   // 3 minutos sem comando (muito agressivo)
        operationTimeout: 8 * 60 * 1000  // 8 minutos sem operação (muito agressivo)
    },

    // Configurações de auto-recuperação
    recovery: {
        reconnectTimeout: 30000,                    // 30 segundos (muito rápido)
        memoryCleanupInterval: 2 * 60 * 1000,      // 2 minutos (muito frequente)
        forceRestartInterval: 30 * 60 * 1000,      // 30 minutos (reinicialização preventiva)
        cacheExpiry: 30 * 60 * 1000                // 30 minutos
    },

    // Configurações de timeout
    timeouts: {
        commandTimeout: 30000,  // 30 segundos (aumentado para comandos funcionarem)
        retryDelay: 500,        // 500ms entre tentativas (muito rápido)
        maxRetries: 2           // Apenas 2 tentativas (muito agressivo)
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
        timeout: 30000,        // Reduzido para 30 segundos
        protocolTimeout: 30000 // Reduzido para 30 segundos
    }
}; 