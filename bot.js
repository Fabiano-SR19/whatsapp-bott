const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const fs = require('fs');
const http = require('http');

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
            timestamp: new Date().toISOString()
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
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
                    <p><a href="/qr" style="background: #25D366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">📱 Baixar QR Code</a></p>
                    <p><a href="/status" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">📊 Status JSON</a></p>
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

// Configurações básicas
const CONFIG = {
    welcomeMessage: "🎉 Bem-vindo(a), {user}! Aproveite o grupo {group} e leia as regras fixadas. Qualquer dúvida, chame um admin!",
    deleteConfirmation: false,
    maxReconnectAttempts: Infinity, // reconexão infinita
    reconnectDelay: 5000
};

// Inicializa o cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './auth_folder'
    }),
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
        console.log('✅ Reconexão bem-sucedida!');
    } catch (err) {
        console.error(`❌ Tentativa ${reconnectAttempts} falhou:`, err);
        isReconnecting = false;
        // Não encerra o processo, tenta de novo na próxima desconexão
    }
});

// Heartbeat melhorado para checar sessão a cada 30 segundos
setInterval(async () => {
    // Verifica se está reconectando há muito tempo (mais de 1 minuto)
    if (isReconnecting && (Date.now() - reconnectStartTime) > 60000) {
        console.warn('[HEARTBEAT] Reconexão travada há mais de 1 minuto, forçando reset...');
        isReconnecting = false;
        connectionStatus = 'error';
    }
    
    if (isReconnecting) {
        console.log('[HEARTBEAT] Reconexão em andamento, pulando verificação...');
        return;
    }
    
    try {
        const now = Date.now();
        const timeSinceLastHeartbeat = now - lastHeartbeat;
        
        // Verifica se o cliente está realmente conectado
        if (!client.info || !client.info.wid) {
            console.warn('[HEARTBEAT] Sessão não ativa, tentando reconectar...');
            connectionStatus = 'reconnecting';
            isReconnecting = true;
            reconnectStartTime = Date.now();
            try {
                await client.initialize();
                isReconnecting = false;
                connectionStatus = 'connected';
                console.log('[HEARTBEAT] Reconexão forçada bem-sucedida!');
            } catch (reconnectError) {
                console.error('[HEARTBEAT] Erro na reconexão forçada:', reconnectError);
                isReconnecting = false;
                connectionStatus = 'error';
            }
        } else {
            // Se o cliente tem info, assume que está conectado
            if (connectionStatus === 'reconnecting') {
                console.log('[HEARTBEAT] Status corrigido: estava reconectando mas cliente está OK');
            }
            connectionStatus = 'connected';
            lastHeartbeat = now;
            console.log(`[HEARTBEAT] Sessão ativa (${timeSinceLastHeartbeat}ms desde último check)`);
        }
    } catch (err) {
        console.error('[HEARTBEAT] Erro ao checar/reconectar sessão:', err);
        isReconnecting = false;
        connectionStatus = 'error';
    }
}, 60 * 1000); // Verifica a cada 1 minuto

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
    connectionStatus = 'ready';
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

// Função para obter informações do chat
async function getChatInfo(msg) {
    try {
        // Primeiro, tenta obter informações básicas da mensagem sem usar getChat()
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
            name: 'Grupo' // Nome padrão
        };
        
        let participants = [];
        
        // Só tenta obter metadata se for grupo
        if (isGroup) {
            try {
                const metadata = await getChatMetadata(chatId);
                if (metadata && metadata.participants) {
                    participants = metadata.participants;
                    if (metadata.name) {
                        chat.name = metadata.name;
                    }
                }
            } catch (metadataError) {
                console.error('Erro ao obter metadata do chat:', metadataError.message);
                // Continua sem participantes, mas não falha
                participants = [];
            }
        }
        
        return {
            chat,
            isGroup,
            participants
        };
    } catch (error) {
        console.error('Erro ao obter info do chat:', error.message);
        
        // Fallback: tenta obter informações mínimas
        try {
            const chatId = msg.from || msg.chat?.id?._serialized;
            if (chatId) {
                return {
                    chat: { 
                        id: { _serialized: chatId }, 
                        isGroup: chatId.includes('@g.us'),
                        name: 'Chat'
                    },
                    isGroup: chatId.includes('@g.us'),
                    participants: []
                };
            }
        } catch (fallbackError) {
            console.error('[FALLBACK] Erro no fallback:', fallbackError.message);
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
            return cached.data;
        }
        
        // Se não está no cache ou expirou, busca do WhatsApp
        if (connectionStatus === 'connected' && client.info && client.info.wid) {
            const metadata = await client.getChatById(chatId);
            if (metadata) {
                chatMetadataCache.set(chatId, {
                    data: metadata,
                    timestamp: Date.now()
                });
                return metadata;
            }
        }
        
        return null;
    } catch (error) {
        console.error(`[METADATA] Erro ao obter metadata para ${chatId}:`, error.message);
        return null;
    }
}

// Função para retry de operações
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.error(`[RETRY] Tentativa ${attempt}/${maxRetries} falhou:`, error.message);
            if (attempt === maxRetries) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
}

// Função para verificar se o usuário é admin
async function isUserAdmin(msg, participants) {
    try {
        if (!participants || !Array.isArray(participants)) {
            console.log('[ADMIN] Sem participantes disponíveis, tentando buscar metadata...');
            try {
                // Só tenta buscar metadata se o cliente estiver estável
                if (connectionStatus === 'connected' && client.info && client.info.wid) {
                    const chatId = msg.chat?.id?._serialized || msg.from;
                    if (chatId && chatId.includes('@g.us')) {
                        participants = await retryOperation(async () => {
                            const metadata = await client.getChatById(chatId);
                            return metadata.participants || [];
                        });
                    }
                }
            } catch (metadataError) {
                console.error('[ADMIN] Erro ao buscar metadata após retry:', metadataError.message);
                return false;
            }
        }
        
        const userId = (msg.author || msg.from);
        const admin = participants.find(p => p.id._serialized === userId && (p.isAdmin || p.isSuperAdmin));
        const isAdmin = !!admin;
        console.log(`[ADMIN] Usuário ${userId} é admin? ${isAdmin}`);
        return isAdmin;
    } catch (error) {
        console.error('Erro ao verificar admin:', error);
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
                await chat.sendMessage(welcomeText, {
                    mentions: [contact]
                });
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
        const chatInfo = await getChatInfo(msg);
        if (!chatInfo) return;
        const senderIsAdmin = await isUserAdmin(msg, chatInfo.participants);
        if (!senderIsAdmin) {
            return msg.reply('❌ Você precisa ser admin para executar este comando!');
        }
        groupSettings[chat.id._serialized] = {
            ...groupSettings[chat.id._serialized],
            botActive: activate
        };
        saveGroupSettings();
        await msg.reply(`✅ Bot ${activate ? 'ativado' : 'desativado'} neste grupo!`);
        if (activate) {
            await chat.sendMessage(`🤖 Bot ativado! Digite *!ajuda* para ver os comandos disponíveis.`);
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
            await chat.sendMessage(`🚫 Mensagem com link apagada!`, { mentions: [msg.author || msg.from] });
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
    const metadata = await client.getChatById(groupId);
    for (const participant of metadata.participants) {
        if (!participant.id.user.startsWith('55')) {
            try {
                await chat.removeParticipants([participant.id._serialized]);
                await chat.sendMessage(`🚫 Usuário removido por não ser do Brasil (+55): @${participant.id.user}`, { mentions: [participant.id._serialized] });
            } catch (e) {
                console.error('Erro ao remover estrangeiro:', e);
            }
        }
    }
}

// Função para lidar com comandos
async function handleCommand(msg) {
    let timeout;
    try {
        console.log(`[COMANDO] Iniciando processamento do comando: ${msg.body}`);
        
        // Verifica se o bot está conectado
        if (connectionStatus !== 'ready' && connectionStatus !== 'connected') {
            console.log(`[COMANDO] Bot não está pronto (status: ${connectionStatus}), ignorando comando`);
            return;
        }
        
        timeout = setTimeout(async () => {
            console.log('[COMANDO] Timeout atingido, enviando resposta de demora');
            try {
                await msg.reply('⌛ O comando demorou muito para responder');
            } catch (timeoutError) {
                console.error('[COMANDO] Erro ao enviar resposta de timeout:', timeoutError);
            }
        }, 15000);
        
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
        
        // Verificar se o bot é admin (com tratamento de erro)
        let botIsAdmin = false;
        try {
            // Só verifica admin se for grupo
            if (isGroup) {
                const metadata = await getChatMetadata(chat.id._serialized);
                if (metadata && metadata.participants) {
                    const adminIds = metadata.participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized);
                    console.log(`[DEBUG] Admins do grupo:`, adminIds);
                    console.log(`[DEBUG] Meu ID: ${client.info.wid._serialized}`);
                    botIsAdmin = adminIds.includes(client.info.wid._serialized);
                    console.log(`[DEBUG] Bot é admin? ${botIsAdmin}`);
                }
            }
        } catch (metadataError) {
            console.error('[COMANDO] Erro ao verificar admin:', metadataError.message);
            // Se não conseguir verificar admin, assume que não é admin por segurança
            botIsAdmin = false;
        }
        
        if (!botIsAdmin) {
            console.log('[COMANDO] Bot não é admin, ignorando comando');
            return; // Apenas ignora, não responde nada
        }
        
        // Verificar se é admin para TODOS os comandos
        const senderIsAdmin = await isUserAdmin(msg, participants);
        console.log(`[COMANDO] Usuário é admin? ${senderIsAdmin}`);
        if (!senderIsAdmin) {
            console.log('[COMANDO] Usuário não é admin, enviando resposta de erro');
            return msg.reply('❌ Você precisa ser admin para executar este comando!');
        }
        
        // Verificar se o bot está ativo para TODOS os comandos exceto !ativar
        if (isGroup && command !== '!ativar') {
            const isBotActive = groupSettings[chat.id._serialized]?.botActive !== false;
            console.log(`[COMANDO] Bot ativo no grupo? ${isBotActive}`);
            if (!isBotActive) {
                console.log('[COMANDO] Bot não está ativo neste grupo');
                return;
            }
        }
        
        switch (command) {
            case '!ativar':
                if (!isGroup) return;
                await toggleBotActivation(chat, msg, true);
                break;
            case '!desativar':
                if (!isGroup) return;
                await toggleBotActivation(chat, msg, false);
                break;
            case '!fechar':
                if (!isGroup) return;
                await setGroupLock(chat, msg, true);
                break;
            case '!abrir':
                if (!isGroup) return;
                await setGroupLock(chat, msg, false);
                break;
            case '!apagar':
                await deleteMessage(msg);
                break;
            case '!boasvindas':
                if (!isGroup) return;
                await toggleWelcome(chat, msg);
                break;
            case '!banir':
                if (!isGroup) return;
                await banUser(chat, msg);
                break;
            case '!cite':
                if (!isGroup) return;
                await mentionAll(chat, msg, participants);
                break;
            case '!ajuda':
                await showHelp(msg);
                break;
            case '!status':
                if (!isGroup) return;
                await checkBotStatus(chat, msg);
                break;
            case '!antifake':
                if (!isGroup) return;
                await toggleAntiFake(chat, msg);
                break;
            case '!antilink':
                if (!isGroup) return;
                await toggleAntiLink(chat, msg);
                break;
            case '!autoanuncio':
                if (!isGroup) return;
                await toggleAutoMessage(chat, msg);
                break;
            case '!setanuncio':
                if (!isGroup) return;
                await setAutoMessageText(chat, msg);
                break;
            case '!promover':
                if (!isGroup) return;
                await promoteUser(chat, msg);
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
        console.log(`📨 Mensagem recebida: "${msg.body}" de ${msg.author || msg.from} (Status: ${connectionStatus})`);
        
        if (msg.fromMe) {
            console.log('❌ Mensagem minha, ignorando');
            return;
        }
        
        // Verifica se o bot está conectado antes de processar
        if (connectionStatus !== 'ready' && connectionStatus !== 'connected') {
            console.log(`⚠️ Bot não está pronto (status: ${connectionStatus}), ignorando mensagem`);
            
            // Auto-correção rápida para mensagens
            if (connectionStatus === 'reconnecting' && (Date.now() - reconnectStartTime) > 15000) {
                console.log('[MENSAGEM] Reconexão travada, forçando verificação de status...');
                try {
                    if (client.info && client.info.wid) {
                        connectionStatus = 'connected';
                        console.log('[MENSAGEM] Status corrigido para connected');
                    }
                } catch (error) {
                    console.error('[MENSAGEM] Erro ao verificar status:', error);
                }
            }
            
            // Se ainda não está pronto, ignora a mensagem
            if (connectionStatus !== 'ready' && connectionStatus !== 'connected') {
                return;
            }
        }
        
        if (isNewMemberMessage(msg)) {
            console.log('[EVENTO] Mensagem de novo membro detectada:', msg.body);
            await handleNewMember(msg);
        }
        
        if (msg.body.startsWith('!')) {
            console.log('🔧 Comando detectado:', msg.body);
            await handleCommand(msg);
        }
        
        // Anti-link
        const chatInfo = await getChatInfo(msg);
        if (chatInfo && chatInfo.isGroup) {
            await handleAntiLink(msg, chatInfo.chat, chatInfo.participants);
        }
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
        
        await msg.reply(
            `ℹ️ *Status do bot*:\n` +
            `- *Ativo*: ${isActive ? '✅ SIM' : '❌ NÃO'}\n` +
            `- *Boas-vindas*: ${welcomeEnabled ? '✅ LIGADO' : '❌ DESLIGADO'}\n` +
            `- *Membros no cache*: ${cacheSize}\n` +
            `- *Idade do cache*: ${cacheAge}s\n` +
            `- *Status da conexão*: ${connectionStatus}`
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
        const mentions = participants
            .filter(p => !p.isAdmin && !p.isSuperAdmin)
            .map(p => p.id._serialized);
        if (mentions.length === 0) {
            return msg.reply('❌ Não há participantes para mencionar!');
        }
        await chat.sendMessage(quotedMsg.body, {
            mentions: mentions
        });
        await msg.delete();
        await quotedMsg.delete();
        await chat.sendMessage(`✅ ${mentions.length} membros foram notificados discretamente`, {
            sendSeen: true
        });
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
        await chat.removeParticipants([userToBan]);
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
        await chat.promoteParticipants([contact]);
        
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
└── !status - Mostra status do bot

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
├── !setanuncio <msg> - Define a mensagem automática

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
            const metadata = await client.getChatById(chat.id._serialized);
            groupMembersCache.set(
                chat.id._serialized, 
                {
                    members: new Set(metadata.participants.map(p => p.id._serialized)),
                    lastUpdate: Date.now()
                }
            );
            console.log(`[CACHE] Cache de membros atualizado para ${chat.name}`);
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

// Inicializa o bot
client.initialize().catch(error => {
    console.error('Erro ao inicializar o bot:', error);
    process.exit(1);
});

// Tratamento de erros globais
process.on('unhandledRejection', error => {
    console.error('❌ Erro não tratado (Promise):', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Exceção não capturada:', error);
    // Não encerra o processo, apenas loga o erro
});

// Limpeza de memória a cada 5 minutos
setInterval(() => {
    try {
        // Força garbage collection se disponível
        if (global.gc) {
            global.gc();
            console.log('[MEMORY] Garbage collection executada');
        }
        
        // Limpa cache de membros antigo (mais de 1 hora)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [groupId, cache] of groupMembersCache.entries()) {
            if (cache.lastUpdate && cache.lastUpdate < oneHourAgo) {
                groupMembersCache.delete(groupId);
                console.log(`[MEMORY] Cache limpo para grupo ${groupId}`);
            }
        }
        
        // Auto-correção de status travado
        if (connectionStatus === 'reconnecting' && (Date.now() - reconnectStartTime) > 30000) {
            console.warn('[AUTO-CORREÇÃO] Status travado em reconnecting há mais de 30 segundos, forçando correção...');
            try {
                if (client.info && client.info.wid) {
                    connectionStatus = 'connected';
                    isReconnecting = false;
                    console.log('[AUTO-CORREÇÃO] Status corrigido para connected');
                } else {
                    connectionStatus = 'error';
                    isReconnecting = false;
                    console.log('[AUTO-CORREÇÃO] Status corrigido para error');
                }
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
                if (client.info && client.info.wid) {
                    connectionStatus = 'connected';
                    console.log('[AUTO-CORREÇÃO] Status error corrigido para connected');
                } else {
                    // Tenta reinicializar o cliente
                    isReconnecting = true;
                    reconnectStartTime = Date.now();
                    client.initialize().then(() => {
                        isReconnecting = false;
                        connectionStatus = 'connected';
                        console.log('[AUTO-CORREÇÃO] Cliente reinicializado com sucesso');
                    }).catch((error) => {
                        console.error('[AUTO-CORREÇÃO] Erro ao reinicializar cliente:', error);
                        isReconnecting = false;
                    });
                }
            } catch (error) {
                console.error('[AUTO-CORREÇÃO] Erro ao corrigir status error:', error);
                isReconnecting = false;
            }
        }
    } catch (error) {
        console.error('[MEMORY] Erro na limpeza de memória:', error);
    }
}, 5 * 60 * 1000); // 5 minutos

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
        const metadata = await client.getChatById(groupId);
        const adminIds = metadata.participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized);
        if (!adminIds.includes(client.info.wid._serialized)) {
            console.log('[BOAS-VINDAS] Bot não é admin. Ignorando.');
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
                await chat.sendMessage(welcomeText, {
                    mentions: [contact.id._serialized]
                });
                console.log(`[BOAS-VINDAS] Mensagem enviada para @${contact.id.user} via evento nativo`);
            } catch (memberError) {
                console.error(`[BOAS-VINDAS] Erro ao enviar mensagem para membro ${memberId}:`, memberError);
            }
        }
    } catch (error) {
        console.error('[BOAS-VINDAS] Erro ao enviar mensagem de boas-vindas via evento nativo:', error);
    }
});