const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const fs = require('fs');
const http = require('http');
const CONFIG = require('./config');

// Servidor HTTP simples para health check do Railway
const server = http.createServer((req, res) => {
    console.log(`📡 Requisição recebida: ${req.method} ${req.url}`);
    
    if (req.url === '/qr') {
        console.log('📱 Tentando servir QR Code...');
        // Servir QR Code como imagem
        fs.readFile('./qrcode.png', (err, data) => {
            if (err) {
                console.log('❌ QR Code não encontrado:', err.message);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('QR Code não encontrado. Aguarde o bot gerar um novo.');
            } else {
                console.log('✅ QR Code enviado com sucesso!');
                res.writeHead(200, { 'Content-Type': 'image/png' });
                res.end(data);
            }
        });
    } else if (req.url === '/status') {
        // Endpoint para verificar status do bot
        const status = {
            connectionStatus,
            isReconnecting,
            reconnectAttempts,
            lastHeartbeat: new Date(lastHeartbeat).toISOString(),
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            lastMessage: new Date(lastMessageTimestamp).toISOString(),
            lastCommand: new Date(lastCommandProcessed).toISOString(),
            heartbeatFailures,
            watchdogFailures,
            emergencyMode,
            memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            // Informações do sistema inteligente
            intelligentSystem: {
                avgResponseTime: Math.round(behaviorHistory.avgResponseTime) + 'ms',
                maxResponseTime: behaviorHistory.maxResponseTime + 'ms',
                healthyPeriods: behaviorHistory.healthyPeriods,
                consecutiveErrors: problemPatterns.consecutiveErrors,
                lastErrorTime: problemPatterns.lastErrorTime ? new Date(problemPatterns.lastErrorTime).toISOString() : null
            }
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
    } else if (req.url === '/health') {
        // Health check ultra-rápido para monitoramento externo
        const isHealthy = connectionStatus === 'connected' && 
                         !isReconnecting && 
                         heartbeatFailures === 0 &&
                         watchdogFailures === 0;
        
        if (isHealthy) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
        } else {
            res.writeHead(503, { 'Content-Type': 'text/plain' });
            res.end('UNHEALTHY');
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
                <head><title>Bot WhatsApp</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h1>🤖 Bot WhatsApp Online!</h1>
                    <p>Status: ${connectionStatus}</p>
                    <p>Reconectando: ${isReconnecting ? 'Sim' : 'Não'}</p>
                    <p>Tentativas de reconexão: ${reconnectAttempts}</p>
                    <p>Falhas de heartbeat: ${heartbeatFailures}</p>
                    <p>Falhas de watchdog: ${watchdogFailures}</p>
                    <p>Modo de emergência: ${emergencyMode ? 'Ativo' : 'Inativo'}</p>
                    <p><strong>Sistema Inteligente:</strong></p>
                    <p>• Tempo médio de resposta: ${Math.round(behaviorHistory.avgResponseTime)}ms</p>
                    <p>• Períodos saudáveis: ${behaviorHistory.healthyPeriods}</p>
                    <p>• Erros consecutivos: ${problemPatterns.consecutiveErrors}</p>
                    <p><a href="/qr" style="background: #25D366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">📱 Baixar QR Code</a></p>
                    <p><a href="/status" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">📊 Status JSON</a></p>
                    <p><a href="/health" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">🏥 Health Check</a></p>
                    <p>Ou acesse diretamente: <a href="/qr">${req.headers.host}/qr</a></p>
                    <p><small>Se não funcionar, aguarde alguns segundos e tente novamente.</small></p>
                </body>
            </html>
        `);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 URL interna: http://localhost:${PORT}`);
    console.log(`📱 QR Code interno: http://localhost:${PORT}/qr`);
    console.log(`🔗 Aguarde o Railway gerar a URL pública...`);
});

// Configurações básicas já importadas do config.js

// Inicializa o cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './auth_folder'
    }),
    puppeteer: CONFIG.puppeteer
});

// Armazenamento de estado
let groupSettings = {};
const groupMembersCache = new Map();
const chatMetadataCache = new Map(); // Cache para metadata de chats

// Carrega configurações salvas
if (fs.existsSync('group_settings.json')) {
    try {
        groupSettings = JSON.parse(fs.readFileSync('group_settings.json'));
    } catch (e) {
        console.error('Erro ao ler group_settings.json:', e);
        groupSettings = {};
    }
}

// Sistema de reconexão automática melhorado
let reconnectAttempts = 0;
let isReconnecting = false;
let lastHeartbeat = Date.now();
let connectionStatus = 'disconnected';
let reconnectStartTime = 0;

// Variável para registrar o timestamp da última mensagem recebida
let lastMessageTimestamp = Date.now();

// Sistema de monitoramento INTELIGENTE
let lastCommandProcessed = Date.now();
let lastSuccessfulOperation = Date.now();
let heartbeatFailures = 0;
let maxHeartbeatFailures = CONFIG.heartbeat.maxFailures;
let emergencyMode = false;
let consecutiveHealthyChecks = 0;

// Sistema de watchdog INTELIGENTE
let watchdogActive = true;
let lastWatchdogCheck = Date.now();
let watchdogFailures = 0;
let maxWatchdogFailures = 3; // 3 falhas antes de agir (menos agressivo)

// Sistema de detecção inteligente de problemas
let problemPatterns = {
    consecutiveErrors: 0,
    lastErrorTime: 0,
    errorWindow: 10 * 60 * 1000, // 10 minutos (mais tolerante)
    maxErrorsInWindow: 5 // 5 erros antes de ativar emergência
};

// Sistema de aprendizado de comportamento
let behaviorHistory = {
    avgResponseTime: 0,
    responseTimes: [],
    maxResponseTime: 30000, // 30 segundos
    healthyPeriods: 0,
    lastHealthCheck: Date.now()
};

// Função centralizada para reinicializar o cliente WhatsApp
let consecutiveReconnectFails = 0;
async function forceRestartClient(reason) {
    try {
        console.warn(`[RESTART] Reinicializando cliente WhatsApp. Motivo: ${reason}`);
        await client.destroy();
    } catch (e) {
        console.error('[RESTART] Erro ao destruir cliente:', e);
    }
    try {
        await client.initialize();
        consecutiveReconnectFails = 0;
        heartbeatFailures = 0;
        consecutiveHealthyChecks = 0;
        emergencyMode = false;
        watchdogFailures = 0;
        lastWatchdogCheck = Date.now();
        lastSuccessfulOperation = Date.now();
        console.log('[RESTART] Cliente reinicializado com sucesso!');
    } catch (err) {
        consecutiveReconnectFails++;
        console.error(`[RESTART] Falha ao reinicializar cliente (${consecutiveReconnectFails} tentativas):`, err);
        if (consecutiveReconnectFails >= 3) {
            console.error('[RESTART] Muitas falhas consecutivas, reiniciando processo Node.js...');
            process.exit(1);
        }
    }
}

client.on('disconnected', async (reason) => {
    console.log(`❌ Conexão perdida (${reason}), tentando reconectar...`);
    connectionStatus = 'disconnected';
    reconnectAttempts++;
    isReconnecting = true;
    reconnectStartTime = Date.now();
    
    // Aguarda um pouco antes de tentar reconectar
    await new Promise(resolve => setTimeout(resolve, CONFIG.reconnectDelay));
    
    try {
        console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}...`);
        await client.initialize();
        reconnectAttempts = 0;
        isReconnecting = false;
        connectionStatus = 'connected';
        lastSuccessfulOperation = Date.now();
        console.log('✅ Reconexão bem-sucedida!');
    } catch (err) {
        console.error(`❌ Tentativa ${reconnectAttempts} falhou:`, err);
        isReconnecting = false;
        
        // Se falhou muitas vezes, tenta reinicializar completamente
        if (reconnectAttempts >= 5) {
            console.warn('[RECONEXÃO] Muitas falhas, tentando reinicialização completa...');
            try {
                await forceRestartClient('Múltiplas falhas de reconexão');
            } catch (restartError) {
                console.error('[RECONEXÃO] Falha na reinicialização:', restartError);
            }
        }
    }
});

// Função de detecção INTELIGENTE de problemas
async function checkBotHealth() {
    const startTime = Date.now();
    
    try {
        // Verifica se o cliente tem informações básicas
        if (!client.info || !client.info.wid) {
            console.warn('[HEALTH] Cliente sem informações básicas');
            recordProblem('missing_info');
            return false;
        }

        // Verifica se o cliente está realmente pronto
        if (!client.pupPage || !client.pupPage.evaluate) {
            console.warn('[HEALTH] Cliente não está totalmente inicializado');
            recordProblem('not_ready');
            return false;
        }

        // Teste de conectividade com timeout mais longo
        const chats = await Promise.race([
            client.getChats(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 15000)
            )
        ]);

        if (!chats || chats.length === 0) {
            console.warn('[HEALTH] Não foi possível obter chats');
            recordProblem('no_chats');
            return false;
        }

        // Calcula tempo de resposta
        const responseTime = Date.now() - startTime;
        updateBehaviorHistory(responseTime);

        // Verifica se o tempo de resposta está dentro do normal
        if (responseTime > behaviorHistory.maxResponseTime) {
            console.warn(`[HEALTH] Tempo de resposta alto: ${responseTime}ms`);
            recordProblem('slow_response');
            return false;
        }

        // Bot está saudável
        console.log(`[HEALTH] ✅ Saudável - ${chats.length} chats, ${responseTime}ms`);
        recordSuccess();
        return true;
    } catch (error) {
        console.error('[HEALTH] Erro ao verificar saúde:', error.message);
        
        // Se for erro de cliente não inicializado, não conta como problema real
        if (error.message.includes('Target closed') || 
            error.message.includes('Protocol error') ||
            error.message.includes('Cannot read properties of undefined')) {
            console.warn('[HEALTH] Cliente em processo de inicialização, ignorando erro');
            return false; // Não registra como problema
        }
        
        recordProblem('api_error');
        return false;
    }
}

// Função para registrar problemas e detectar padrões
function recordProblem(type) {
    const now = Date.now();
    problemPatterns.consecutiveErrors++;
    problemPatterns.lastErrorTime = now;
    
    // Verifica se há muitos erros em uma janela de tempo
    if (problemPatterns.consecutiveErrors >= problemPatterns.maxErrorsInWindow) {
        console.error(`[INTELLIGENT] Padrão de problemas detectado: ${problemPatterns.consecutiveErrors} erros consecutivos`);
        emergencyMode = true;
    }
}

// Função para registrar sucessos
function recordSuccess() {
    problemPatterns.consecutiveErrors = 0;
    behaviorHistory.healthyPeriods++;
    
    // Sai do modo de emergência após 3 períodos saudáveis
    if (emergencyMode && behaviorHistory.healthyPeriods >= 3) {
        emergencyMode = false;
        console.log('[INTELLIGENT] Saindo do modo de emergência - bot estável');
    }
}

// Função para atualizar histórico de comportamento
function updateBehaviorHistory(responseTime) {
    behaviorHistory.responseTimes.push(responseTime);
    
    // Mantém apenas os últimos 10 tempos de resposta
    if (behaviorHistory.responseTimes.length > 10) {
        behaviorHistory.responseTimes.shift();
    }
    
    // Calcula tempo médio de resposta
    behaviorHistory.avgResponseTime = behaviorHistory.responseTimes.reduce((a, b) => a + b, 0) / behaviorHistory.responseTimes.length;
    
    // Ajusta tempo máximo baseado no comportamento
    if (behaviorHistory.avgResponseTime > 0) {
        behaviorHistory.maxResponseTime = Math.max(30000, behaviorHistory.avgResponseTime * 3);
    }
}

// Heartbeat melhorado com verificações mais robustas
setInterval(async () => {
    try {
        const now = Date.now();
        const timeSinceLastHeartbeat = now - lastHeartbeat;
        const timeSinceLastMessage = now - lastMessageTimestamp;
        const timeSinceLastCommand = now - lastCommandProcessed;
        const timeSinceLastOperation = now - lastSuccessfulOperation;

        console.log(`[HEARTBEAT] Verificando saúde do bot...`);
        console.log(`[HEARTBEAT] Tempo desde última mensagem: ${Math.floor(timeSinceLastMessage / 1000)}s`);
        console.log(`[HEARTBEAT] Tempo desde último comando: ${Math.floor(timeSinceLastCommand / 1000)}s`);
        console.log(`[HEARTBEAT] Tempo desde última operação: ${Math.floor(timeSinceLastOperation / 1000)}s`);

        // Verifica se está reconectando há muito tempo
        if (isReconnecting && (now - reconnectStartTime) > CONFIG.recovery.reconnectTimeout) {
            console.warn(`[HEARTBEAT] Reconexão travada há mais de ${Math.floor(CONFIG.recovery.reconnectTimeout / 1000)} segundos, forçando reset...`);
            isReconnecting = false;
            connectionStatus = 'error';
            await forceRestartClient('Reconexão travada > 1min');
            return;
        }

        if (isReconnecting) {
            console.log('[HEARTBEAT] Reconexão em andamento, pulando verificação...');
            return;
        }

        // Verifica se o bot está saudável usando sistema inteligente
        const isHealthy = await checkBotHealth();
        
        if (!isHealthy) {
            heartbeatFailures++;
            console.warn(`[HEARTBEAT] Bot não saudável (falha ${heartbeatFailures}/${maxHeartbeatFailures})`);
            
            // Só reinicia se estiver em modo de emergência E muitas falhas
            if (emergencyMode && heartbeatFailures >= maxHeartbeatFailures) {
                console.error('[HEARTBEAT] Problema real detectado em modo de emergência, reinicializando cliente...');
                connectionStatus = 'error';
                isReconnecting = true;
                reconnectStartTime = now;
                await forceRestartClient('Problema real detectado pelo sistema inteligente');
                return;
            }
        } else {
            // Bot está saudável
            if (heartbeatFailures > 0) {
                console.log(`[HEARTBEAT] Bot recuperou saúde! Resetando contador (era ${heartbeatFailures})`);
            }
            heartbeatFailures = 0;
            consecutiveHealthyChecks++;
            lastSuccessfulOperation = now;
            
            // Grace period inteligente baseado no comportamento
            const gracePeriod = emergencyMode ? 1 * 60 * 1000 : 3 * 60 * 1000;
            const timeSinceLastActivity = Math.min(timeSinceLastMessage, timeSinceLastCommand);
            
            if (timeSinceLastActivity < gracePeriod) {
                console.log(`[HEARTBEAT] Grace period ativo (${Math.floor(timeSinceLastActivity / 1000)}s desde última atividade)`);
            } else {
            // Verifica se não recebeu mensagem há muito tempo
            if (timeSinceLastMessage > CONFIG.heartbeat.messageTimeout) {
                console.warn(`[HEARTBEAT] Nenhuma mensagem recebida há mais de ${Math.floor(CONFIG.heartbeat.messageTimeout / 60000)} minutos, pode estar travado`);
                heartbeatFailures++;
                
                if (heartbeatFailures >= maxHeartbeatFailures) {
                    console.error('[HEARTBEAT] Bot parece estar travado, reinicializando...');
                    connectionStatus = 'error';
                    isReconnecting = true;
                    reconnectStartTime = now;
                    await forceRestartClient(`Bot travado - sem mensagens > ${Math.floor(CONFIG.heartbeat.messageTimeout / 60000)}min`);
                    return;
                }
            }

            // Verifica se não processou comando há muito tempo
            if (timeSinceLastCommand > CONFIG.heartbeat.commandTimeout) {
                console.warn(`[HEARTBEAT] Nenhum comando processado há mais de ${Math.floor(CONFIG.heartbeat.commandTimeout / 60000)} minutos`);
                heartbeatFailures++;
                
                if (heartbeatFailures >= maxHeartbeatFailures) {
                    console.error('[HEARTBEAT] Bot não está processando comandos, reinicializando...');
                    connectionStatus = 'error';
                    isReconnecting = true;
                    reconnectStartTime = now;
                    await forceRestartClient(`Bot não processa comandos > ${Math.floor(CONFIG.heartbeat.commandTimeout / 60000)}min`);
                    return;
                }
            }
        }

            connectionStatus = 'connected';
            lastHeartbeat = now;
            
            // Só mostra log detalhado se houver algo importante ou a cada 10 verificações
            const shouldLogDetailed = heartbeatFailures > 0 || 
                                    timeSinceLastMessage > 5 * 60 * 1000 || 
                                    timeSinceLastCommand > 5 * 60 * 1000 ||
                                    (Math.floor(now / CONFIG.heartbeat.interval) % 10) === 0;
            
            if (shouldLogDetailed) {
                console.log(`[HEARTBEAT] Bot saudável (${timeSinceLastHeartbeat}ms desde último check)`);
            } else {
                console.log(`[HEARTBEAT] ✅ OK`);
            }
        }

    } catch (err) {
        console.error('[HEARTBEAT] Erro ao verificar saúde do bot:', err);
        heartbeatFailures++;
        
        if (heartbeatFailures >= maxHeartbeatFailures) {
            console.error('[HEARTBEAT] Muitos erros consecutivos, reinicializando cliente...');
            connectionStatus = 'error';
            isReconnecting = true;
            reconnectStartTime = Date.now();
            await forceRestartClient('Erros consecutivos no heartbeat');
        }
    }
}, CONFIG.heartbeat.interval);

// Watchdog INTELIGENTE - verifica a cada 3 minutos
setInterval(async () => {
    if (!watchdogActive) return;
    
    try {
        const now = Date.now();
        
        // Só executa se não estiver em reconexão
        if (isReconnecting) {
            console.log('[WATCHDOG] Reconexão em andamento, pulando verificação...');
            return;
        }
        
        // Verificação inteligente: só testa se o cliente tem informações básicas
        if (!client.info || !client.info.wid) {
            console.warn('[WATCHDOG] Cliente sem informações básicas detectado');
            watchdogFailures++;
            
            if (watchdogFailures >= maxWatchdogFailures) {
                console.error('[WATCHDOG] Problema real detectado, reinicializando...');
                await forceRestartClient('Watchdog: cliente sem informações');
                watchdogFailures = 0;
            }
            return;
        }
        
        // Teste inteligente de conectividade com timeout
        try {
            const chats = await Promise.race([
                client.getChats(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 12000)
                )
            ]);
            
            if (chats && chats.length >= 0) {
                watchdogFailures = 0; // Reset falhas se está funcionando
                lastWatchdogCheck = now;
                console.log(`[WATCHDOG] ✅ OK - ${chats.length} chats disponíveis`);
            } else {
                throw new Error('Nenhum chat disponível');
            }
        } catch (error) {
            console.warn('[WATCHDOG] Falha no teste de conectividade:', error.message);
            
            // Se for erro de inicialização, não conta como falha
            if (error.message.includes('Target closed') || 
                error.message.includes('Protocol error') ||
                error.message.includes('Cannot read properties of undefined')) {
                console.warn('[WATCHDOG] Cliente em inicialização, ignorando erro');
                return;
            }
            
            watchdogFailures++;
            
            if (watchdogFailures >= maxWatchdogFailures) {
                console.error('[WATCHDOG] Problema real detectado, reinicializando...');
                await forceRestartClient('Watchdog: falha de conectividade');
                watchdogFailures = 0;
            }
        }
    } catch (error) {
        console.error('[WATCHDOG] Erro crítico:', error);
        watchdogFailures++;
        
        if (watchdogFailures >= maxWatchdogFailures) {
            await forceRestartClient('Watchdog: erro crítico');
            watchdogFailures = 0;
        }
    }
}, 3 * 60 * 1000); // 3 minutos (inteligente)

// Adiciona evento de autenticação
client.on('authenticated', () => {
    console.log('🔐 Cliente autenticado!');
    connectionStatus = 'authenticated';
});

client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
    connectionStatus = 'auth_failed';
});

client.on('loading_screen', (percent, message) => {
    console.log(`📱 Carregando: ${percent}% - ${message}`);
});

client.on('qr', async qr => {
    console.log('🔄 QR Code gerado!');
    console.log('📱 Escaneie com WhatsApp → Aparelhos conectados');
    connectionStatus = 'waiting_qr';
    
    try {
        // Gerar QR Code como imagem PNG
        await qrcodeImage.toFile('./qrcode.png', qr, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        console.log('✅ QR Code salvo como imagem!');
        console.log('📱 Acesse a URL do Railway + /qr para baixar');
        console.log('🔗 Exemplo: https://seu-bot.railway.app/qr');
        
        // Também mostrar no terminal (menor)
        qrcode.generate(qr, { small: true });
        
    } catch (error) {
        console.error('❌ Erro ao gerar QR Code:', error);
        // Fallback para terminal
        qrcode.generate(qr, { small: true });
    }
});

// EVENTO: Bot pronto
client.on('ready', async () => {
    console.log('✅ Bot conectado e pronto!');
    connectionStatus = 'connected';
    lastHeartbeat = Date.now();
    
    try {
        // Carrega cache inicial de membros dos grupos
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        for (const group of groups) {
            try {
                const metadata = await client.getChatById(group.id._serialized);
                groupMembersCache.set(
                    group.id._serialized, 
                    {
                        members: new Set(metadata.participants.map(p => p.id._serialized)),
                        lastUpdate: Date.now()
                    }
                );
                console.log(`[CACHE] Membros carregados para o grupo ${group.name}`);
            } catch (error) {
                console.error(`Erro ao carregar metadata do grupo ${group.name}:`, error);
            }
        }
        // Iniciar auto-mensagens para grupos ativados
        for (const groupId in groupSettings) {
            if (groupSettings[groupId].autoMessageEnabled) {
                try {
                    const chat = await client.getChatById(groupId);
                    startAutoMessage(groupId, chat);
                } catch (e) {
                    console.error('Erro ao iniciar auto-mensagem:', e);
                }
            }
        }
    } catch (error) {
        console.error('Erro ao inicializar cache de membros:', error);
    }
});

// --- Mensagem automática a cada 1h ---
const autoMessageIntervals = {};

function getAutoMessageConfig(groupId) {
    if (!groupSettings[groupId]) groupSettings[groupId] = {};
    if (typeof groupSettings[groupId].autoMessageEnabled === 'undefined') {
        groupSettings[groupId].autoMessageEnabled = false;
    }
    if (typeof groupSettings[groupId].autoMessageText === 'undefined') {
        groupSettings[groupId].autoMessageText = 'Mensagem automática padrão!';
    }
    return groupSettings[groupId];
}

function startAutoMessage(groupId, chat) {
    stopAutoMessage(groupId);
    const config = getAutoMessageConfig(groupId);
    if (!config.autoMessageEnabled) return;
    autoMessageIntervals[groupId] = setInterval(async () => {
        try {
            await chat.sendMessage(config.autoMessageText);
        } catch (e) {
            console.error('Erro ao enviar mensagem automática:', e);
        }
    }, 60 * 60 * 1000); // 1 hora
}

function stopAutoMessage(groupId) {
    if (autoMessageIntervals[groupId]) {
        clearInterval(autoMessageIntervals[groupId]);
        delete autoMessageIntervals[groupId];
    }
}

async function toggleAutoMessage(chat, msg) {
    const groupId = chat.id._serialized;
    const config = getAutoMessageConfig(groupId);
    config.autoMessageEnabled = !config.autoMessageEnabled;
    saveGroupSettings();
    if (config.autoMessageEnabled) {
        startAutoMessage(groupId, chat);
        await msg.reply('✅ Mensagem automática ativada!');
    } else {
        stopAutoMessage(groupId);
        await msg.reply('❌ Mensagem automática desativada!');
    }
}

async function setAutoMessageText(chat, msg) {
    const groupId = chat.id._serialized;
    const config = getAutoMessageConfig(groupId);
    const texto = msg.body.replace('!setanuncio', '').trim();
    if (!texto) {
        await msg.reply('⚠️ Use: !setanuncio Sua mensagem aqui');
        return;
    }
    config.autoMessageText = texto;
    saveGroupSettings();
    await msg.reply('✅ Mensagem automática configurada!');
}

// Função para obter informações do chat - ULTRA SIMPLIFICADA
async function getChatInfo(msg) {
    try {
        // Obtém informações básicas da mensagem
        const chatId = msg.chat?.id?._serialized || msg.from;
        const isGroup = chatId && chatId.includes('@g.us');
        
        if (!chatId) {
            console.error('[CHAT] Não foi possível obter ID do chat');
            return null;
        }
        
        // Cria um objeto chat básico
        const chat = {
            id: { _serialized: chatId },
            isGroup: isGroup,
            name: isGroup ? 'Grupo' : 'Chat'
        };
        
        // Para comandos que precisam de participantes, busca do metadata
        const command = msg.body.toLowerCase().trim().split(' ')[0];
        const commandsNeedingParticipants = ['!cite', '!banir', '!promover'];
        let participants = [];
        
        if (isGroup && commandsNeedingParticipants.includes(command)) {
            try {
                const metadata = await getChatMetadata(chatId);
                if (metadata && metadata.participants) {
                    participants = metadata.participants;
                    console.log(`[CHAT] Buscou ${participants.length} participantes para comando ${command}`);
                }
            } catch (error) {
                console.warn('[CHAT] Erro ao buscar participantes, continuando sem:', error.message);
            }
        }
        
        // Retorna com participantes se disponíveis
        return {
            chat,
            isGroup,
            participants
        };
    } catch (error) {
        console.error('Erro ao obter info do chat:', error.message);
        
        // Fallback rápido
        const chatId = msg.from || msg.chat?.id?._serialized;
        if (chatId) {
            return {
                chat: { 
                    id: { _serialized: chatId }, 
                    isGroup: chatId.includes('@g.us'),
                    name: chatId.includes('@g.us') ? 'Grupo' : 'Chat'
                },
                isGroup: chatId.includes('@g.us'),
                participants: []
            };
        }
        
        return null;
    }
}

// Função para obter metadata com cache
async function getChatMetadata(chatId) {
    try {
        // Verifica cache primeiro
        const cached = chatMetadataCache.get(chatId);
        if (cached && (Date.now() - cached.timestamp) < 30000) { // Cache válido por 30 segundos
            console.log(`[METADATA] Usando cache para ${chatId}`);
            return cached.data;
        }
        
        // Se não está no cache ou expirou, busca do WhatsApp
        if (connectionStatus === 'connected' && client.info && client.info.wid) {
            console.log(`[METADATA] Buscando metadata para ${chatId}...`);
            try {
                const metadata = await client.getChatById(chatId);
                if (metadata && metadata.participants) {
                    console.log(`[METADATA] Metadata obtida com sucesso para ${chatId}`);
                    chatMetadataCache.set(chatId, {
                        data: metadata,
                        timestamp: Date.now()
                    });
                    return metadata;
                } else {
                    console.log(`[METADATA] Metadata incompleta para ${chatId}`);
                }
            } catch (metadataError) {
                console.error(`[METADATA] Erro ao buscar metadata para ${chatId}:`, metadataError.message);
            }
        } else {
            console.log(`[METADATA] Cliente não está pronto para buscar metadata (status: ${connectionStatus})`);
        }
        
        return null;
    } catch (error) {
        console.error(`[METADATA] Erro ao obter metadata para ${chatId}:`, error.message);
        return null;
    }
}

// Função para retry de operações
async function retryOperation(operation, maxRetries = CONFIG.timeouts.maxRetries, delay = CONFIG.timeouts.retryDelay) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await operation();
            lastSuccessfulOperation = Date.now(); // Registra operação bem-sucedida
            return result;
        } catch (error) {
            console.error(`[RETRY] Tentativa ${attempt}/${maxRetries} falhou:`, error.message);
            if (attempt === maxRetries) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
}

// Função para verificar se o usuário é admin - SIMPLIFICADA
async function isUserAdmin(msg, participants) {
    try {
        const userId = (msg.author || msg.from);
        console.log(`[ADMIN] Verificando se ${userId} é admin...`);
        
        // Se não tem participantes, tenta buscar
        if (!participants || !Array.isArray(participants) || participants.length === 0) {
            console.log('[ADMIN] Sem participantes, buscando metadata...');
            try {
                const chatId = msg.chat?.id?._serialized || msg.from;
                if (chatId && chatId.includes('@g.us')) {
                    const metadata = await client.getChatById(chatId);
                    if (metadata && metadata.participants) {
                        participants = metadata.participants;
                        console.log(`[ADMIN] Buscou ${participants.length} participantes`);
                    }
                }
            } catch (error) {
                console.warn('[ADMIN] Erro ao buscar metadata:', error.message);
                // Se não conseguir buscar, retorna false para ser mais seguro
                console.log('[ADMIN] Erro ao buscar metadata, retornando false');
                return false;
            }
        }
        
        // Se ainda não tem participantes, retorna false
        if (!participants || !Array.isArray(participants) || participants.length === 0) {
            console.log('[ADMIN] Sem participantes após busca, retornando false');
            return false;
        }
        
        // Procura o usuário na lista de participantes
        const admin = participants.find(p => {
            const participantId = p.id?._serialized || p.id;
            return participantId === userId && (p.isAdmin || p.isSuperAdmin);
        });
        
        const isAdmin = !!admin;
        console.log(`[ADMIN] Usuário ${userId} é admin? ${isAdmin}`);
        
        return isAdmin;
    } catch (error) {
        console.error('[ADMIN] Erro ao verificar admin:', error);
        // Em caso de erro, retorna false para ser mais seguro
        console.log('[ADMIN] Erro na verificação, retornando false');
        return false;
    }
}

// Função melhorada para detectar mensagens de novo membro
function isNewMemberMessage(msg) {
    if (msg.type !== 'gp2') return false;
    const joinPatterns = [
        /entrou no grupo/,
        /foi adicionado/,
        /adicionou \+\d+@c\.us/,
        /participant added/,
        /membro adicionado/,
        /added by invitation/,
        /você adicionou/,
        /added \+\d+/,
        /joined using/
    ];
    return joinPatterns.some(pattern => pattern.test(msg.body.toLowerCase()));
}

// Função de boas-vindas corrigida
async function handleNewMember(msg) {
    try {
        console.log('[DEBUG] Verificando nova mensagem de grupo:', msg.body);
        const chat = await msg.getChat();
        if (!chat.isGroup) return;
        const metadata = await client.getChatById(chat.id._serialized);
        const isAdmin = metadata.participants.find(p => p.id._serialized === client.info.wid._serialized && (p.isAdmin || p.isSuperAdmin));
        if (!isAdmin) {
            console.log('[BOAS-VINDAS] Bot não é admin. Ignorando.');
            return;
        }
        const currentParticipants = new Set(metadata.participants.map(p => p.id._serialized));
        const cachedData = groupMembersCache.get(chat.id._serialized);
        const cachedMembers = cachedData ? cachedData.members : new Set();
        const newMembers = [...currentParticipants].filter(id => !cachedMembers.has(id));
        if (newMembers.length === 0) {
            console.log('[BOAS-VINDAS] Nenhum novo membro detectado.');
            return;
        }
        const groupId = chat.id._serialized;
        const groupConfig = groupSettings[groupId] || {};
        
        // Verificar se o bot está ativo
        const isBotActive = groupSettings[groupId]?.botActive !== false;
        if (!isBotActive) {
            console.log('[BOAS-VINDAS] Bot não está ativo neste grupo.');
            return;
        }
        
        if (groupConfig.welcomeEnabled === false) {
            console.log('[BOAS-VINDAS] Boas-vindas desativadas para este grupo.');
            return;
        }
        console.log(`[BOAS-VINDAS] Novos membros detectados: ${newMembers.length}`);
        for (const memberId of newMembers) {
            try {
                const contact = await client.getContactById(memberId);
                const welcomeText = CONFIG.welcomeMessage
                    .replace('{user}', `@${contact.id.user}`)
                    .replace('{group}', chat.name);
                
                // Obtém o chat real antes de enviar mensagem
                const realChat = await client.getChatById(chat.id._serialized);
                if (realChat && typeof realChat.sendMessage === 'function') {
                    await realChat.sendMessage(welcomeText, {
                        mentions: [contact.id._serialized]
                    });
                } else {
                    // Método alternativo usando a API do WhatsApp diretamente
                    await client.pupPage.evaluate((chatId, welcomeText, contactId) => {
                        return window.Store.Chat.get(chatId).then(chat => {
                            return chat.sendMessage(welcomeText, { mentions: [contactId] });
                        });
                    }, chat.id._serialized, welcomeText, contact.id._serialized);
                }
                console.log(`[BOAS-VINDAS] Mensagem enviada para @${contact.id.user}`);
                cachedMembers.add(contact.id._serialized);
                groupMembersCache.set(groupId, {
                    members: cachedMembers,
                    lastUpdate: Date.now()
                });
            } catch (memberError) {
                console.error(`Erro com membro ${memberId}:`, memberError);
            }
        }
        // Chama anti-fake após boas-vindas
        if (chat.isGroup) {
            await handleAntiFake(chat);
        }
    } catch (error) {
        console.error('Erro no handleNewMember:', error);
    }
}

// Função para ativar/desativar o bot no grupo
async function toggleBotActivation(chat, msg, activate) {
    try {
        // Para !ativar, não precisa verificar se é admin - qualquer pessoa pode ativar
        groupSettings[chat.id._serialized] = {
            ...groupSettings[chat.id._serialized],
            botActive: activate
        };
        saveGroupSettings();
        await msg.reply(`✅ Bot ${activate ? 'ativado' : 'desativado'} neste grupo!`);
        if (activate) {
            // Obtém o chat real antes de enviar mensagem
            const realChat = await client.getChatById(chat.id._serialized);
            if (realChat && typeof realChat.sendMessage === 'function') {
                await realChat.sendMessage(`🤖 Bot ativado! Digite *!ajuda* para ver os comandos disponíveis.`);
            } else {
                // Método alternativo usando a API do WhatsApp diretamente
                await client.pupPage.evaluate((chatId) => {
                    return window.Store.Chat.get(chatId).then(chat => {
                        return chat.sendMessage(`🤖 Bot ativado! Digite *!ajuda* para ver os comandos disponíveis.`);
                    });
                }, chat.id._serialized);
            }
        }
    } catch (error) {
        console.error('Erro ao alternar ativação do bot:', error);
        msg.reply('❌ Ocorreu um erro ao executar este comando.');
    }
}

// Adiciona opções ao groupSettings
function getGroupConfig(groupId) {
    if (!groupSettings[groupId]) {
        groupSettings[groupId] = {};
    }
    if (typeof groupSettings[groupId].antiFake === 'undefined') {
        groupSettings[groupId].antiFake = false;
    }
    if (typeof groupSettings[groupId].antiLink === 'undefined') {
        groupSettings[groupId].antiLink = false;
    }
    return groupSettings[groupId];
}

// Função para ativar/desativar anti-fake
async function toggleAntiFake(chat, msg) {
    const groupId = chat.id._serialized;
    const config = getGroupConfig(groupId);
    config.antiFake = !config.antiFake;
    saveGroupSettings();
    await msg.reply(`✅ Anti-fake ${config.antiFake ? 'ativado' : 'desativado'} neste grupo!`);
}

// Função para ativar/desativar anti-link
async function toggleAntiLink(chat, msg) {
    const groupId = chat.id._serialized;
    const config = getGroupConfig(groupId);
    config.antiLink = !config.antiLink;
    saveGroupSettings();
    await msg.reply(`✅ Anti-link ${config.antiLink ? 'ativado' : 'desativado'} neste grupo!`);
}

// Função para verificar e agir sobre links
async function handleAntiLink(msg, chat, participants) {
    const groupId = chat.id._serialized;
    const config = getGroupConfig(groupId);
    if (!config.antiLink) return;
    const isAdmin = await isUserAdmin(msg, participants);
    const linkRegex = /https?:\/\//i;
    if (linkRegex.test(msg.body) && !isAdmin) {
        try {
            await msg.delete(true);
            
            // Obtém o chat real antes de enviar mensagem
            const realChat = await client.getChatById(chat.id._serialized);
            if (realChat && typeof realChat.sendMessage === 'function') {
                await realChat.sendMessage(`🚫 Mensagem com link apagada!`, { mentions: [msg.author || msg.from] });
            } else {
                // Método alternativo usando a API do WhatsApp diretamente
                await client.pupPage.evaluate((chatId, authorId) => {
                    return window.Store.Chat.get(chatId).then(chat => {
                        return chat.sendMessage(`🚫 Mensagem com link apagada!`, { mentions: [authorId] });
                    });
                }, chat.id._serialized, msg.author || msg.from);
            }
        } catch (e) {
            console.error('Erro ao apagar mensagem com link:', e);
        }
    }
}

// Função para anti-fake ao entrar novo membro
async function handleAntiFake(chat) {
    const groupId = chat.id._serialized;
    const config = getGroupConfig(groupId);
    if (!config.antiFake) return;
    
    // Verificar se o bot está ativo
    const isBotActive = groupSettings[groupId]?.botActive !== false;
    if (!isBotActive) return;
    
    // Verificar se o bot é admin
    try {
        const metadata = await client.getChatById(groupId);
        const adminIds = metadata.participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized);
        const botIsAdmin = adminIds.includes(client.info.wid._serialized);
        
        if (!botIsAdmin) return;
        
        for (const participant of metadata.participants) {
            if (!participant.id.user.startsWith('55')) {
                try {
                    // Obtém o chat real antes de usar métodos
                    const realChat = await client.getChatById(groupId);
                    if (realChat && typeof realChat.removeParticipants === 'function') {
                        await realChat.removeParticipants([participant.id._serialized]);
                        await realChat.sendMessage(`🚫 Usuário removido por não ser do Brasil (+55): @${participant.id.user}`, { mentions: [participant.id._serialized] });
                    } else {
                        // Método alternativo usando a API do WhatsApp diretamente
                        await client.pupPage.evaluate((chatId, participantId, participantUser) => {
                            return window.Store.Chat.get(chatId).then(chat => {
                                chat.removeParticipants([participantId]);
                                return chat.sendMessage(`🚫 Usuário removido por não ser do Brasil (+55): @${participantUser}`, { mentions: [participantId] });
                            });
                        }, groupId, participant.id._serialized, participant.id.user);
                    }
                } catch (e) {
                    console.error('Erro ao remover estrangeiro:', e);
                }
            }
        }
    } catch (error) {
        console.error('[ANTI-FAKE] Erro ao verificar admin para anti-fake:', error.message);
    }
}

// Função para lidar com comandos
async function handleCommand(msg) {
    let timeout;
    try {
        console.log(`[COMANDO] Iniciando processamento do comando: ${msg.body}`);
        
        // Verifica se o bot está conectado
        if (connectionStatus !== 'connected') {
            console.log(`[COMANDO] Bot não está pronto (status: ${connectionStatus}), ignorando comando`);
            await msg.reply('⚠️ Bot está reconectando, tente novamente em alguns segundos.');
            return;
        }
        
        timeout = setTimeout(async () => {
            console.log('[COMANDO] Timeout atingido, enviando resposta de demora');
            try {
                await msg.reply('⌛ O comando demorou muito para responder');
            } catch (timeoutError) {
                console.error('[COMANDO] Erro ao enviar resposta de timeout:', timeoutError);
            }
        }, CONFIG.timeouts.commandTimeout);
        
        const command = msg.body.toLowerCase().trim().split(' ')[0];
        console.log(`[COMANDO] Comando identificado: ${command}`);
        
        const chatInfo = await getChatInfo(msg);
        if (!chatInfo) {
            console.log('[COMANDO] Não foi possível obter informações do chat');
            return;
        }
        
        // Só funciona em grupos
        if (!chatInfo.isGroup) {
            console.log('[COMANDO] Comando em chat privado, ignorando');
            return; // Ignora comandos em chats privados
        }
        
        const { chat, isGroup, participants } = chatInfo;
        console.log(`[COMANDO] Processando em grupo: ${chat.name || 'Nome não disponível'}`);
        
        // Verificação de admin e ativação para TODOS os comandos exceto !ativar, !ajuda e !ping
        if (isGroup && !['!ativar', '!ajuda', '!ping', '!status'].includes(command)) {
            // Verifica se o bot está ativo
            const isBotActive = groupSettings[chat.id._serialized]?.botActive !== false;
            console.log(`[COMANDO] Bot ativo no grupo? ${isBotActive}`);
            
            if (!isBotActive) {
                console.log('[COMANDO] Bot não está ativo neste grupo');
                await msg.reply('❌ Bot não está ativo neste grupo. Use *!ativar* para ativá-lo.');
                return;
            }
            
            // Verifica se o bot é admin (de forma rigorosa)
            let botIsAdmin = false;
            try {
                const metadata = await getChatMetadata(chat.id._serialized);
                if (metadata && metadata.participants) {
                    const adminIds = metadata.participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized);
                    botIsAdmin = adminIds.includes(client.info.wid._serialized);
                    console.log(`[COMANDO] Bot é admin? ${botIsAdmin} (ID: ${client.info.wid._serialized})`);
                    console.log(`[COMANDO] Admins do grupo: ${adminIds.join(', ')}`);
                } else {
                    console.log('[COMANDO] Não foi possível obter metadata do grupo');
                    botIsAdmin = false;
                }
            } catch (error) {
                console.warn('[COMANDO] Erro ao verificar admin do bot:', error.message);
                botIsAdmin = false;
            }
            
            if (!botIsAdmin) {
                console.log('[COMANDO] Bot não é admin neste grupo');
                await msg.reply('❌ Bot precisa ser administrador para executar comandos. Promova o bot para admin.');
                return;
            }
            
            // Verifica se o usuário é admin (para comandos que precisam de permissão)
            const commandsNeedingUserAdmin = ['!fechar', '!abrir', '!banir', '!promover', '!antifake', '!antilink', '!autoanuncio', '!setanuncio', '!boasvindas'];
            if (commandsNeedingUserAdmin.includes(command)) {
                let userIsAdmin = false;
                try {
                    const metadata = await getChatMetadata(chat.id._serialized);
                    if (metadata && metadata.participants) {
                        userIsAdmin = await isUserAdmin(msg, metadata.participants);
                    }
                } catch (error) {
                    console.warn('[COMANDO] Erro ao verificar admin do usuário:', error.message);
                    userIsAdmin = false;
                }
                
                console.log(`[COMANDO] Usuário é admin? ${userIsAdmin}`);
                
                if (!userIsAdmin) {
                    console.log('[COMANDO] Usuário não é admin');
                    await msg.reply('❌ Você precisa ser administrador para executar este comando!');
                    return;
                }
            }
        }
        
        switch (command) {
            case '!ativar':
                if (!isGroup) return;
                await toggleBotActivation(chat, msg, true);
                lastCommandProcessed = Date.now();
                break;
            case '!desativar':
                if (!isGroup) return;
                await toggleBotActivation(chat, msg, false);
                lastCommandProcessed = Date.now();
                break;
            case '!fechar':
                if (!isGroup) return;
                await setGroupLock(chat, msg, true);
                lastCommandProcessed = Date.now();
                break;
            case '!abrir':
                if (!isGroup) return;
                await setGroupLock(chat, msg, false);
                lastCommandProcessed = Date.now();
                break;
            case '!apagar':
                await deleteMessage(msg);
                lastCommandProcessed = Date.now();
                break;
            case '!boasvindas':
                if (!isGroup) return;
                await toggleWelcome(chat, msg);
                lastCommandProcessed = Date.now();
                break;
            case '!banir':
                if (!isGroup) return;
                await banUser(chat, msg);
                lastCommandProcessed = Date.now();
                break;
            case '!cite':
                if (!isGroup) return;
                await mentionAll(chat, msg, participants);
                lastCommandProcessed = Date.now();
                break;
            case '!ajuda':
                await showHelp(msg);
                lastCommandProcessed = Date.now();
                break;
            case '!status':
                if (!isGroup) return;
                await checkBotStatus(chat, msg);
                lastCommandProcessed = Date.now();
                break;
            case '!antifake':
                if (!isGroup) return;
                await toggleAntiFake(chat, msg);
                lastCommandProcessed = Date.now();
                break;
            case '!antilink':
                if (!isGroup) return;
                await toggleAntiLink(chat, msg);
                lastCommandProcessed = Date.now();
                break;
            case '!autoanuncio':
                if (!isGroup) return;
                await toggleAutoMessage(chat, msg);
                lastCommandProcessed = Date.now();
                break;
            case '!setanuncio':
                if (!isGroup) return;
                await setAutoMessageText(chat, msg);
                lastCommandProcessed = Date.now();
                break;
            case '!promover':
                if (!isGroup) return;
                await promoteUser(chat, msg);
                lastCommandProcessed = Date.now();
                break;
            case '!ping':
                await msg.reply('🏓 Pong! Bot está funcionando normalmente.');
                lastCommandProcessed = Date.now();
                break;

            default:
                return; // Ignora comandos desconhecidos
        }
        
        console.log(`[COMANDO] Comando ${command} executado com sucesso`);
    } catch (error) {
        console.error('[COMANDO] Erro ao executar comando:', error);
        try {
            await msg.reply('❌ Ocorreu um erro ao executar este comando.');
        } catch (replyError) {
            console.error('[COMANDO] Erro ao enviar resposta de erro:', replyError);
        }
    } finally {
        clearTimeout(timeout);
        console.log(`[COMANDO] Finalizando processamento do comando: ${msg.body}`);
    }
}

// EVENTO: Mensagens recebidas
client.on('message', async msg => {
    try {
        // Verifica se o bot está conectado antes de processar
        if (connectionStatus !== 'connected') {
            console.log(`⚠️ Bot não está pronto (status: ${connectionStatus}), ignorando mensagem`);
            return;
        }
        
        if (msg.fromMe) {
            console.log('❌ Mensagem minha, ignorando');
            return;
        }
        
        console.log(`📨 Mensagem recebida: "${msg.body}" de ${msg.author || msg.from}`);
        
        if (isNewMemberMessage(msg)) {
            console.log('[EVENTO] Mensagem de novo membro detectada:', msg.body);
            await handleNewMember(msg);
        }
        
        if (msg.body.startsWith('!')) {
            console.log('🔧 Comando detectado:', msg.body);
            console.log(`🔧 Autor: ${msg.author || msg.from}`);
            console.log(`🔧 Chat: ${msg.chat?.id?._serialized || msg.from}`);
            console.log(`🔧 É grupo: ${msg.chat?.isGroup || msg.from?.includes('@g.us')}`);
            lastCommandProcessed = Date.now(); // Registra que um comando foi detectado
            await handleCommand(msg);
        }
        
        // Anti-link - só funciona se bot for admin e estiver ativo
        if (msg.body.includes('http')) {
            const chatInfo = await getChatInfo(msg);
            if (chatInfo && chatInfo.isGroup) {
                const groupId = chatInfo.chat.id._serialized;
                const isBotActive = groupSettings[groupId]?.botActive !== false;
                
                if (isBotActive) {
                    try {
                        const metadata = await getChatMetadata(groupId);
                        if (metadata && metadata.participants) {
                            const adminIds = metadata.participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized);
                            const botIsAdmin = adminIds.includes(client.info.wid._serialized);
                            
                            if (botIsAdmin) {
                                await handleAntiLink(msg, chatInfo.chat, chatInfo.participants);
                            }
                        }
                    } catch (error) {
                        console.error('[ANTI-LINK] Erro ao verificar admin para anti-link:', error.message);
                    }
                }
            }
        }

        // Atualiza o timestamp da última mensagem recebida
        lastMessageTimestamp = Date.now();
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

// Função para verificar status do bot no grupo
async function checkBotStatus(chat, msg) {
    try {
        const isActive = groupSettings[chat.id._serialized]?.botActive !== false;
        const welcomeEnabled = groupSettings[chat.id._serialized]?.welcomeEnabled !== false;
        const cachedData = groupMembersCache.get(chat.id._serialized);
        const cacheSize = cachedData ? cachedData.members.size : 0;
        const cacheAge = cachedData ? Math.floor((Date.now() - cachedData.lastUpdate) / 1000) : 0;
        
        const timeSinceLastMessage = Math.floor((Date.now() - lastMessageTimestamp) / 1000);
        const timeSinceLastCommand = Math.floor((Date.now() - lastCommandProcessed) / 1000);
        const timeSinceLastOperation = Math.floor((Date.now() - lastSuccessfulOperation) / 1000);
        
        await msg.reply(
            `ℹ️ *Status do bot*:\n` +
            `- *Ativo*: ${isActive ? '✅ SIM' : '❌ NÃO'}\n` +
            `- *Boas-vindas*: ${welcomeEnabled ? '✅ LIGADO' : '❌ DESLIGADO'}\n` +
            `- *Status da conexão*: ${connectionStatus}\n` +
            `- *Última mensagem*: ${timeSinceLastMessage}s atrás\n` +
            `- *Último comando*: ${timeSinceLastCommand}s atrás\n` +
            `- *Última operação*: ${timeSinceLastOperation}s atrás\n` +
            `- *Falhas de heartbeat*: ${heartbeatFailures}/${maxHeartbeatFailures}\n` +
            `- *Membros no cache*: ${cacheSize}\n` +
            `- *Idade do cache*: ${cacheAge}s\n\n` +
            `🧠 *Sistema Inteligente*:\n` +
            `- *Tempo médio de resposta*: ${Math.round(behaviorHistory.avgResponseTime)}ms\n` +
            `- *Períodos saudáveis*: ${behaviorHistory.healthyPeriods}\n` +
            `- *Erros consecutivos*: ${problemPatterns.consecutiveErrors}\n` +
            `- *Modo de emergência*: ${emergencyMode ? '🔴 ATIVO' : '🟢 INATIVO'}`
        );
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        msg.reply('❌ Ocorreu um erro ao verificar o status.');
    }
}

// Função para mencionar todos os participantes
async function mentionAll(chat, msg, participants) {
    try {
        if (!msg.hasQuotedMsg) {
            return msg.reply('⚠️ Responda a mensagem com *!cite* para marcar todos ocultamente');
        }
        
        const quotedMsg = await msg.getQuotedMessage();
        
        // Se não tem participantes, busca do metadata
        let finalParticipants = participants;
        if (!finalParticipants || finalParticipants.length === 0) {
            try {
                const metadata = await getChatMetadata(chat.id._serialized);
                if (metadata && metadata.participants) {
                    finalParticipants = metadata.participants;
                    console.log(`[CITE] Buscou ${finalParticipants.length} participantes do metadata`);
                } else {
                    return msg.reply('❌ Não foi possível obter lista de participantes');
                }
            } catch (error) {
                console.error('[CITE] Erro ao buscar participantes:', error);
                return msg.reply('❌ Erro ao obter lista de participantes');
            }
        }
        
        const mentions = finalParticipants
            .filter(p => !p.isAdmin && !p.isSuperAdmin)
            .map(p => p.id._serialized);
            
        if (mentions.length === 0) {
            return msg.reply('❌ Não há participantes para mencionar!');
        }
        
        console.log(`[CITE] Vai mencionar ${mentions.length} participantes`);
        
        // Obtém o chat real usando o ID
        const realChat = await client.getChatById(chat.id._serialized);
        
        if (realChat && typeof realChat.sendMessage === 'function') {
            await realChat.sendMessage(quotedMsg.body, {
                mentions: mentions
            });
            await msg.delete();
            await quotedMsg.delete();
            await realChat.sendMessage(`✅ ${mentions.length} membros foram notificados discretamente`, {
                sendSeen: true
            });
        } else {
            // Método alternativo usando a API do WhatsApp diretamente
            const chatId = chat.id._serialized;
            await client.pupPage.evaluate((chatId, messageBody, mentions) => {
                return window.Store.Chat.get(chatId).then(chat => {
                    return chat.sendMessage(messageBody, { mentions: mentions });
                });
            }, chatId, quotedMsg.body, mentions);
            
            await msg.delete();
            await quotedMsg.delete();
            
            await client.pupPage.evaluate((chatId, count) => {
                return window.Store.Chat.get(chatId).then(chat => {
                    return chat.sendMessage(`✅ ${count} membros foram notificados discretamente`, { sendSeen: true });
                });
            }, chatId, mentions.length);
        }
        
        console.log(`[CITE] Comando executado com sucesso - ${mentions.length} membros mencionados`);
    } catch (error) {
        console.error('Erro ao mencionar todos:', error);
        msg.reply('❌ Ocorreu um erro ao mencionar os membros.');
    }
}

// Função para banir usuários
async function banUser(chat, msg) {
    try {
        if (!msg.hasQuotedMsg && msg.mentionedIds.length === 0) {
            return msg.reply('⚠️ Marque o usuário ou responda sua mensagem com *!banir*');
        }
        let userToBan;
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            userToBan = quotedMsg.author || quotedMsg.from;
        } else {
            userToBan = msg.mentionedIds[0];
        }
        if (userToBan === (msg.author || msg.from)) {
            return msg.reply('❌ Você não pode banir a si mesmo!');
        }
        const me = await client.getContactById(client.info.wid._serialized);
        if (userToBan === me.id._serialized) {
            return msg.reply('❌ Você não pode banir o bot!');
        }
        
        // Obtém o chat real usando o ID
        const realChat = await client.getChatById(chat.id._serialized);
        
        if (realChat && typeof realChat.removeParticipants === 'function') {
            await realChat.removeParticipants([userToBan]);
        } else {
            // Método alternativo usando a API do WhatsApp diretamente
            const chatId = chat.id._serialized;
            await client.pupPage.evaluate((chatId, userToBan) => {
                return window.Store.Chat.get(chatId).then(chat => {
                    return chat.removeParticipants([userToBan]);
                });
            }, chatId, userToBan);
        }
        
        await msg.reply('✅ Usuário banido com sucesso!');
    } catch (error) {
        console.error('Erro ao banir usuário:', error);
        msg.reply('❌ Ocorreu um erro ao banir o usuário. Verifique se sou admin.');
    }
}

// Função para promover usuários para admin
async function promoteUser(chat, msg) {
    try {
        if (!msg.hasQuotedMsg && msg.mentionedIds.length === 0) {
            return msg.reply('⚠️ Marque o usuário ou responda sua mensagem com *!promover*');
        }
        
        let userToPromote;
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            userToPromote = quotedMsg.author || quotedMsg.from;
        } else {
            userToPromote = msg.mentionedIds[0];
        }
        
        // Verificar se não está tentando promover a si mesmo
        if (userToPromote === (msg.author || msg.from)) {
            return msg.reply('❌ Você não pode promover a si mesmo!');
        }
        
        // Verificar se não está tentando promover o bot
        const me = await client.getContactById(client.info.wid._serialized);
        if (userToPromote === me.id._serialized) {
            return msg.reply('❌ Você não pode promover o bot!');
        }
        
        // Verificar se o usuário já é admin
        const metadata = await client.getChatById(chat.id._serialized);
        const adminIds = metadata.participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized);
        if (adminIds.includes(userToPromote)) {
            return msg.reply('❌ Este usuário já é administrador!');
        }
        
        // Promover o usuário
        const contact = await client.getContactById(userToPromote);
        
        // Obtém o chat real usando o ID
        const realChat = await client.getChatById(chat.id._serialized);
        
        if (realChat && typeof realChat.promoteParticipants === 'function') {
            await realChat.promoteParticipants([contact]);
        } else {
            // Método alternativo usando a API do WhatsApp diretamente
            const chatId = chat.id._serialized;
            await client.pupPage.evaluate((chatId, contact) => {
                return window.Store.Chat.get(chatId).then(chat => {
                    return chat.promoteParticipants([contact]);
                });
            }, chatId, contact);
        }
        
        await msg.reply(`✅ @${contact.id.user} foi promovido para administrador!`, {
            mentions: [contact.id._serialized]
        });
        
        console.log(`[PROMOÇÃO] ${contact.id.user} foi promovido por ${msg.author || msg.from}`);
        
    } catch (error) {
        console.error('Erro ao promover usuário:', error);
        msg.reply('❌ Ocorreu um erro ao promover o usuário. Verifique se sou admin e tenho permissões.');
    }
}

// Função para apagar mensagens
async function deleteMessage(msg) {
    try {
        if (!msg.hasQuotedMsg) {
            return msg.reply('⚠️ Responda a mensagem com *!apagar*');
        }
        const quotedMsg = await msg.getQuotedMessage();
        await quotedMsg.delete(true);
        if (CONFIG.deleteConfirmation) {
            await msg.reply('🗑️ Mensagem apagada com sucesso!');
        } else {
            await msg.delete();
        }
    } catch (error) {
        console.error('Erro ao apagar mensagem:', error);
        msg.reply('❌ Não foi possível apagar a mensagem. Verifique minhas permissões.');
    }
}

// Função de ajuda
async function showHelp(msg) {
    try {
        const helpText = `
🌟 *MENU DE AJUDA* 🌟

🔧 *Controle do Bot*:
├── !ativar - Ativa o bot no grupo
├── !desativar - Desativa o bot no grupo
├── !status - Mostra status do bot
└── !ping - Testa se o bot está funcionando

📌 *Administração* (apenas admins):
├── !abrir - Libera o grupo para todos
├── !fechar - Restringe para apenas admins
├── !banir - Remove usuário do grupo
├── !promover - Promove usuário para admin
├── !cite - Marca todos ocultamente
├── !apagar - Apaga mensagem
├── !antifake - Ativa/desativa anti-fake
├── !antilink - Ativa/desativa anti-link
├── !autoanuncio - Ativa/desativa mensagem automática a cada 1h
└── !setanuncio <msg> - Define a mensagem automática

🎉 *Configurações*:
└── !boasvindas - Ativa/desativa mensagens de boas-vindas

ℹ️ Todos os comandos devem começar com "!"
        `;
        await msg.reply(helpText);
    } catch (error) {
        console.error('Erro ao mostrar ajuda:', error);
    }
}

// Funções auxiliares
async function setGroupLock(chat, msg, lock) {
    try {
        // Obtém o chat real usando o ID
        const realChat = await client.getChatById(chat.id._serialized);
        
        if (realChat && typeof realChat.setMessagesAdminsOnly === 'function') {
            await realChat.setMessagesAdminsOnly(lock);
        } else {
            // Método alternativo usando a API do WhatsApp diretamente
            const chatId = chat.id._serialized;
            await client.pupPage.evaluate((chatId, lock) => {
                return window.Store.Chat.get(chatId).then(chat => {
                    if (lock) {
                        return chat.setMessagesAdminsOnly(true);
                    } else {
                        return chat.setMessagesAdminsOnly(false);
                    }
                });
            }, chatId, lock);
        }
        
        groupSettings[chat.id._serialized] = {
            ...groupSettings[chat.id._serialized],
            isLocked: lock
        };
        saveGroupSettings();
        await msg.reply(`✅ Grupo ${lock ? 'fechado' : 'aberto'} com sucesso!`);
    } catch (error) {
        console.error(`Erro ao ${lock ? 'fechar' : 'abrir'} grupo:`, error);
        msg.reply(`❌ Não foi possível ${lock ? 'fechar' : 'abrir'} o grupo. Verifique minhas permissões.`);
    }
}

async function toggleWelcome(chat, msg) {
    try {
        const current = groupSettings[chat.id._serialized]?.welcomeEnabled !== false;
        groupSettings[chat.id._serialized] = {
            ...groupSettings[chat.id._serialized],
            welcomeEnabled: !current
        };
        saveGroupSettings();
        if (!current) {
            try {
                const metadata = await getChatMetadata(chat.id._serialized);
                if (metadata && metadata.participants) {
                    groupMembersCache.set(
                        chat.id._serialized, 
                        {
                            members: new Set(metadata.participants.map(p => p.id._serialized)),
                            lastUpdate: Date.now()
                        }
                    );
                    console.log(`[CACHE] Cache de membros atualizado para ${chat.name || 'Grupo'}`);
                }
            } catch (metadataError) {
                console.error('[CACHE] Erro ao atualizar cache de membros:', metadataError.message);
                // Continua mesmo se não conseguir atualizar o cache
            }
        }
        await msg.reply(`✅ Boas-vindas ${current ? 'desativadas' : 'ativadas'}!`);
    } catch (error) {
        console.error('Erro ao alternar boas-vindas:', error);
        msg.reply('❌ Ocorreu um erro ao alterar as configurações de boas-vindas.');
    }
}

function saveGroupSettings() {
    try {
        fs.writeFileSync('group_settings.json', JSON.stringify(groupSettings, null, 2));
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
    }
}

// Inicializa o bot com retry
async function initializeBot() {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        try {
            console.log(`[INIT] Tentativa ${attempts + 1} de inicialização...`);
            await client.initialize();
            console.log('[INIT] Bot inicializado com sucesso!');
            return;
        } catch (error) {
            attempts++;
            console.error(`[INIT] Tentativa ${attempts} falhou:`, error.message);
            
            if (attempts >= maxAttempts) {
                console.error('[INIT] Todas as tentativas falharam, encerrando processo...');
                process.exit(1);
            }
            
            // Aguarda antes da próxima tentativa
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

initializeBot();

// Tratamento de erros globais - INTELIGENTE para uptime máximo
process.on('unhandledRejection', error => {
    console.error('❌ Erro não tratado (Promise):', error);
    
    // Só reinicia se for erro crítico
    if (error.message && (
        error.message.includes('Target closed') ||
        error.message.includes('Protocol error') ||
        error.message.includes('Connection closed') ||
        error.message.includes('Session closed')
    )) {
        console.error('🔄 Erro crítico detectado, reiniciando processo Node.js...');
        process.exit(1);
    } else {
        console.warn('⚠️ Erro não crítico, continuando operação...');
    }
});

process.on('uncaughtException', error => {
    console.error('❌ Exceção não capturada:', error);
    
    // Só reinicia se for erro crítico
    if (error.message && (
        error.message.includes('Target closed') ||
        error.message.includes('Protocol error') ||
        error.message.includes('Connection closed') ||
        error.message.includes('Session closed')
    )) {
        console.error('🔄 Erro crítico detectado, reiniciando processo Node.js...');
        process.exit(1);
    } else {
        console.warn('⚠️ Exceção não crítica, continuando operação...');
    }
});

// Monitoramento de memória - menos agressivo
setInterval(() => {
    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (memMB > 1000) { // Se usar mais de 1GB
        console.error(`[MEMORY] Uso de memória muito alto: ${memMB}MB. Reiniciando processo...`);
        process.exit(1);
    } else if (memMB > 500) {
        console.warn(`[MEMORY] Uso de memória alto: ${memMB}MB`);
    }
}, 5 * 60 * 1000); // Verifica a cada 5 minutos

// Limpeza de memória e watchdog a cada 5 minutos
setInterval(() => {
    (async () => {
        try {
            // Força garbage collection se disponível
            if (global.gc) {
                global.gc();
                console.log('[MEMORY] Garbage collection executada');
            }
            // Limpa cache de membros antigo
            const oneHourAgo = Date.now() - CONFIG.recovery.cacheExpiry;
            for (const [groupId, cache] of groupMembersCache.entries()) {
                if (cache.lastUpdate && cache.lastUpdate < oneHourAgo) {
                    groupMembersCache.delete(groupId);
                    console.log(`[MEMORY] Cache limpo para grupo ${groupId}`);
                }
            }
            // Auto-correção de status travado
            if (connectionStatus === 'reconnecting' && (Date.now() - reconnectStartTime) > CONFIG.recovery.reconnectTimeout) {
                console.warn(`[AUTO-CORREÇÃO] Status travado em reconnecting há mais de ${Math.floor(CONFIG.recovery.reconnectTimeout / 1000)} segundos, forçando correção...`);
                try {
                    await forceRestartClient('Auto-correção: reconnecting > 30s');
                } catch (error) {
                    console.error('[AUTO-CORREÇÃO] Erro ao corrigir status:', error);
                    connectionStatus = 'error';
                    isReconnecting = false;
                }
            }
            // Auto-correção de status error
            if (connectionStatus === 'error') {
                console.warn('[AUTO-CORREÇÃO] Status em error, tentando reconectar...');
                try {
                    await forceRestartClient('Auto-correção: status error');
                } catch (error) {
                    console.error('[AUTO-CORREÇÃO] Erro ao corrigir status error:', error);
                    isReconnecting = false;
                }
            }
            // Auto-correção INTELIGENTE para bot travado
            const timeSinceLastMessage = Date.now() - lastMessageTimestamp;
            const timeSinceLastCommand = Date.now() - lastCommandProcessed;
            
            // Só reinicia se estiver em modo de emergência E muito tempo sem atividade
            const inactivityThreshold = emergencyMode ? 10 * 60 * 1000 : 20 * 60 * 1000; // 10min em emergência, 20min normal
            
            if (emergencyMode && timeSinceLastMessage > inactivityThreshold && timeSinceLastCommand > inactivityThreshold) {
                console.warn(`[AUTO-CORREÇÃO] Bot inativo por mais de ${Math.floor(inactivityThreshold / 60000)} minutos em modo de emergência! Reinicializando...`);
                try {
                    await forceRestartClient(`Auto-correção: bot inativo > ${Math.floor(inactivityThreshold / 60000)}min`);
                } catch (error) {
                    console.error('[AUTO-CORREÇÃO] Erro ao reinicializar bot inativo:', error);
                    connectionStatus = 'error';
                    isReconnecting = false;
                }
            }
            
            // Verificação inteligente: só reinicia se realmente não estiver conectado E em emergência
            if (emergencyMode && connectionStatus !== 'connected' && (Date.now() - lastHeartbeat) > 10 * 60 * 1000) {
                console.warn('[AUTO-CORREÇÃO] Cliente não conectado por mais de 10 minutos em modo de emergência! Reinicializando...');
                await forceRestartClient('Auto-correção: cliente não conectado > 10min');
            }
            
        } catch (error) {
            console.error('[MEMORY] Erro na limpeza de memória:', error);
        }
    })();
}, CONFIG.recovery.memoryCleanupInterval);

// Adicionar evento nativo para detectar novos participantes
client.on('group_join', async (notification) => {
    try {
        const chat = await notification.getChat();
        const groupId = chat.id._serialized;
        const groupConfig = groupSettings[groupId] || {};
        // Só envia se o recurso estiver ativado
        if (groupConfig.welcomeEnabled === false) {
            console.log('[BOAS-VINDAS] Boas-vindas desativadas para este grupo.');
            return;
        }
        // Só envia se o bot estiver ativado no grupo
        const isBotActive = groupSettings[groupId]?.botActive !== false;
        if (!isBotActive) {
            console.log('[BOAS-VINDAS] Bot desativado neste grupo.');
            return;
        }
        // Só envia se o bot for admin
        try {
            const metadata = await getChatMetadata(groupId);
            if (!metadata || !metadata.participants) {
                console.log('[BOAS-VINDAS] Não foi possível obter metadata do grupo.');
                return;
            }
            const adminIds = metadata.participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized);
            if (!adminIds.includes(client.info.wid._serialized)) {
                console.log('[BOAS-VINDAS] Bot não é admin. Ignorando.');
                return;
            }
        } catch (metadataError) {
            console.error('[BOAS-VINDAS] Erro ao verificar admin:', metadataError.message);
            return;
        }
        // notification.recipientIds pode conter 1 ou mais membros
        const recipientIds = notification.recipientIds || [];
        for (const memberId of recipientIds) {
            try {
                const contact = await client.getContactById(memberId);
                const welcomeText = CONFIG.welcomeMessage
                    .replace('{user}', `@${contact.id.user}`)
                    .replace('{group}', chat.name);
                
                // Obtém o chat real para enviar mensagem
                const realChat = await client.getChatById(chat.id._serialized);
                if (realChat && typeof realChat.sendMessage === 'function') {
                    await realChat.sendMessage(welcomeText, {
                        mentions: [contact.id._serialized]
                    });
                } else {
                    // Método alternativo usando a API do WhatsApp diretamente
                    await client.pupPage.evaluate((chatId, welcomeText, contactId) => {
                        return window.Store.Chat.get(chatId).then(chat => {
                            return chat.sendMessage(welcomeText, { mentions: [contactId] });
                        });
                    }, chat.id._serialized, welcomeText, contact.id._serialized);
                }
                
                console.log(`[BOAS-VINDAS] Mensagem enviada para @${contact.id.user} via evento nativo`);
            } catch (memberError) {
                console.error(`[BOAS-VINDAS] Erro ao enviar mensagem para membro ${memberId}:`, memberError);
            }
        }
    } catch (error) {
        console.error('[BOAS-VINDAS] Erro ao enviar mensagem de boas-vindas via evento nativo:', error);
    }
});

// Reinicialização preventiva INTELIGENTE
setInterval(async () => {
    // Só reinicializa se não estiver em reconexão e estiver saudável
    if (isReconnecting || emergencyMode) {
        console.log('[RESTART-PREVENTIVO] Pulando reinicialização - reconexão em andamento ou modo de emergência');
        return;
    }
    
    // Verifica se realmente precisa reinicializar
    const timeSinceLastRestart = Date.now() - lastSuccessfulOperation;
    if (timeSinceLastRestart < 60 * 60 * 1000) { // 60 minutos (menos frequente)
        console.log('[RESTART-PREVENTIVO] Bot está funcionando bem, pulando reinicialização preventiva');
        return;
    }
    
    console.log('[RESTART-PREVENTIVO] Reinicializando cliente WhatsApp para manter estabilidade...');
    try {
        await client.destroy();
        await client.initialize();
        console.log('[RESTART-PREVENTIVO] Reinicialização preventiva concluída com sucesso!');
        lastSuccessfulOperation = Date.now();
    } catch (err) {
        console.error('[RESTART-PREVENTIVO] Erro na reinicialização preventiva:', err);
        // Só força restart se for erro crítico
        if (err.message.includes('timeout') || err.message.includes('connection')) {
            console.error('[RESTART-PREVENTIVO] Erro crítico detectado, reiniciando processo...');
            process.exit(1);
        }
    }
}, CONFIG.recovery.forceRestartInterval);