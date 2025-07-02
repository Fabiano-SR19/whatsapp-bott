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
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
                <head><title>Bot WhatsApp</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h1>🤖 Bot WhatsApp Online!</h1>
                    <p>Status: Aguardando conexão</p>
                    <p><a href="/qr" style="background: #25D366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">📱 Baixar QR Code</a></p>
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
    welcomeMessage: "👋 Olá {user}, seja bem-vindo(a) ao grupo {group}!",
    deleteConfirmation: false,
    maxReconnectAttempts: 5,
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

// Carrega configurações salvas
if (fs.existsSync('group_settings.json')) {
    try {
        groupSettings = JSON.parse(fs.readFileSync('group_settings.json'));
    } catch (e) {
        console.error('Erro ao ler group_settings.json:', e);
        groupSettings = {};
    }
}

// EVENTO: QR Code
client.on('qr', async qr => {
    console.log('🔄 QR Code gerado!');
    console.log('📱 Escaneie com WhatsApp → Aparelhos conectados');
    
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

// EVENTO: Bot pronto
client.on('ready', async () => {
    console.log('✅ Bot conectado e pronto!');
    try {
        // Carrega cache inicial de membros dos grupos
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        for (const group of groups) {
            try {
                const metadata = await client.getChatById(group.id._serialized);
                groupMembersCache.set(
                    group.id._serialized, 
                    new Set(metadata.participants.map(p => p.id._serialized))
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

// Função para obter informações do chat
async function getChatInfo(msg) {
    try {
        const chat = await msg.getChat();
        const isGroup = chat.isGroup;
        let participants = [];
        if (isGroup) {
            const metadata = await client.getChatById(chat.id._serialized);
            participants = metadata.participants;
        }
        return {
            chat,
            isGroup,
            participants
        };
    } catch (error) {
        console.error('Erro ao obter info do chat:', error);
        return null;
    }
}

// Função para verificar se o usuário é admin
async function isUserAdmin(msg, participants) {
    try {
        if (!participants || !Array.isArray(participants)) return false;
        const userId = (msg.author || msg.from);
        const admin = participants.find(p => p.id._serialized === userId && (p.isAdmin || p.isSuperAdmin));
        return !!admin;
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
        const cachedMembers = groupMembersCache.get(chat.id._serialized) || new Set();
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
                groupMembersCache.set(groupId, cachedMembers);
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
        timeout = setTimeout(async () => {
            await msg.reply('⌛ O comando demorou muito para responder');
        }, 15000);
        
        const command = msg.body.toLowerCase().trim().split(' ')[0];
        const chatInfo = await getChatInfo(msg);
        if (!chatInfo) return;
        
        const { chat, isGroup, participants } = chatInfo;
        
        // Verificar se é admin para TODOS os comandos
        const senderIsAdmin = await isUserAdmin(msg, participants);
        if (!senderIsAdmin) {
            return msg.reply('❌ Você precisa ser admin para executar este comando!');
        }
        
        // Verificar se o bot está ativo (exceto para comandos de ativação)
        const allowedWhenDisabled = ['!ativar', '!ajuda', '!status'];
        if (isGroup && !allowedWhenDisabled.includes(command)) {
            const isBotActive = groupSettings[chat.id._serialized]?.botActive !== false;
            if (!isBotActive) return;
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
            default:
                return; // Ignora comandos desconhecidos
        }
    } catch (error) {
        console.error('Erro ao executar comando:', error);
        msg.reply('❌ Ocorreu um erro ao executar este comando.');
    } finally {
        clearTimeout(timeout);
    }
}

// EVENTO: Mensagens recebidas
client.on('message', async msg => {
    try {
        console.log(`📨 Mensagem recebida: "${msg.body}" de ${msg.author || msg.from}`);
        
        if (msg.fromMe) {
            console.log('❌ Mensagem minha, ignorando');
            return;
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
        await msg.reply(
            `ℹ️ *Status do bot*:\n` +
            `- *Ativo*: ${isActive ? '✅ SIM' : '❌ NÃO'}\n` +
            `- *Boas-vindas*: ${welcomeEnabled ? '✅ LIGADO' : '❌ DESLIGADO'}\n` +
            `- *Membros no cache*: ${groupMembersCache.get(chat.id._serialized)?.size || 0}`
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
        await chat.setMessagesAdminsOnly(lock);
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
                new Set(metadata.participants.map(p => p.id._serialized))
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

// Sistema de reconexão automática
let reconnectAttempts = 0;

client.on('disconnected', async (reason) => {
    console.log(`❌ Conexão perdida (${reason}), tentando reconectar...`);
    if (reconnectAttempts < CONFIG.maxReconnectAttempts) {
        reconnectAttempts++;
        await new Promise(resolve => setTimeout(resolve, CONFIG.reconnectDelay));
        try {
            await client.initialize();
            reconnectAttempts = 0;
            console.log('✅ Reconexão bem-sucedida!');
        } catch (err) {
            console.error(`Tentativa ${reconnectAttempts} falhou:`, err);
        }
    } else {
        console.error('❌ Máximo de tentativas de reconexão atingido');
        process.exit(1);
    }
});

// Inicializa o bot
client.initialize().catch(error => {
    console.error('Erro ao inicializar o bot:', error);
    process.exit(1);
});

// Tratamento de erros globais
process.on('unhandledRejection', error => {
    console.error('Erro não tratado:', error);
});

process.on('uncaughtException', error => {
    console.error('Exceção não capturada:', error);
});

// Adicionar evento nativo para detectar novos participantes
client.on('group_join', async (notification) => {
    try {
        const chat = await notification.getChat();
        const groupId = chat.id._serialized;
        const groupConfig = groupSettings[groupId] || {};
        if (groupConfig.welcomeEnabled === false) {
            console.log('[BOAS-VINDAS] Boas-vindas desativadas para este grupo.');
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
                    mentions: [contact]
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