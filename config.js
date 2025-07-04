// Configurações do sistema de monitoramento e recuperação INTELIGENTE
module.exports = {
    // Configurações básicas
    welcomeMessage: "🎉 Bem-vindo(a), {user}! Aproveite o grupo {group} e leia as regras fixadas. Qualquer dúvida, chame um admin!",
    deleteConfirmation: false,
    maxReconnectAttempts: Infinity,
    reconnectDelay: 3000, // 3 segundos para recuperação rápida

    // Configurações de heartbeat INTELIGENTE
    heartbeat: {
        interval: 2 * 60 * 1000,        // 2 minutos (menos frequente)
        maxFailures: 3,                  // 3 falhas antes de agir (menos agressivo)
        messageTimeout: 12 * 60 * 1000,  // 12 minutos sem mensagem (mais tolerante)
        commandTimeout: 8 * 60 * 1000,   // 8 minutos sem comando (mais tolerante)
        operationTimeout: 15 * 60 * 1000 // 15 minutos sem operação (mais tolerante)
    },

    // Configurações de auto-recuperação INTELIGENTE
    recovery: {
        reconnectTimeout: 60000,                    // 60 segundos (mais tolerante)
        memoryCleanupInterval: 5 * 60 * 1000,      // 5 minutos (menos frequente)
        forceRestartInterval: 90 * 60 * 1000,      // 90 minutos (menos frequente)
        cacheExpiry: 60 * 60 * 1000                // 60 minutos
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