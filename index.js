require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '';
const ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID || '1499039164769898636';
const STARTUP_MESSAGE_MARKER = 'VINBOT_STARTUP_MESSAGE_V1';
const ANNOUNCEMENT_TITLE = 'VinBot Anti-Spam Protection';

// Configuration
const SPAM_TIME_WINDOW_MS = 15 * 1000; // 15 seconds window
const MAX_CHANNELS_THRESHOLD = 3;      // Trigger if spamming across >= 3 channels
const MAX_MESSAGES_THRESHOLD = 4;      // Trigger if >= 4 suspicious messages in window
const MUTE_DURATION_MS = 5 * 60 * 60 * 1000; // 5 Hours in milliseconds
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel]
});

// Map: guildId -> Map(userId -> Array<{ timestamp, channelId, message, isSuspicious }>)
const userActivity = new Map();
const processingUsers = new Set();

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log('🛡️ Anti-Spam Protection Active (Monitoring Text & Voice Channel Chats)');
    await sendStartupMessage();
    await sendAnnouncementMessage();
});

async function sendStartupMessage() {
    if (!LOG_CHANNEL_ID) return;

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel || !logChannel.isTextBased()) return;

    try {
        const messages = await logChannel.messages.fetch({ limit: 100 });
        const alreadyPosted = messages.some(message =>
            message.author.id === client.user.id &&
            message.embeds.some(embed => embed.footer?.text === STARTUP_MESSAGE_MARKER)
        );
        if (!alreadyPosted) {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ VinBot is online!')
                .setDescription(
                    'Anti-spam protection is active for `@everyone`, `@here`, and image spam.\n\n' +
                    'Detected spam may be timed out, removed, and reported in this channel.'
                )
                .setColor(0x00AE86)
                .setFooter({ text: STARTUP_MESSAGE_MARKER });
            await logChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('❌ Failed to post startup message:', error.message);
    }
}

async function sendAnnouncementMessage() {
    if (!ANNOUNCEMENT_CHANNEL_ID) return;

    const announcementChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
    if (!announcementChannel || !announcementChannel.isTextBased()) return;

    try {
        const messages = await announcementChannel.messages.fetch({ limit: 100 });
        const alreadyPosted = messages.some(message =>
            message.author.id === client.user.id &&
            message.embeds.some(embed => embed.title === ANNOUNCEMENT_TITLE)
        );
        if (alreadyPosted) return;

        const embed = new EmbedBuilder()
            .setTitle(ANNOUNCEMENT_TITLE)
            .setDescription(
                'This bot helps keep the server safe by automatically detecting and handling ' +
                'rapid spam activity. The protection runs in the background and is active ' +
                "across the server's text-based chats."
            )
            .setColor(0x3498DB)
            .addFields(
                {
                    name: 'What the bot detects',
                    value:
                        '• Repeated `@everyone` or `@here` mentions\n' +
                        '• Image attachment spam (`.png`, `.jpg`, `.jpeg`, `.gif`, and `.webp`)\n' +
                        '• Suspicious activity spread across multiple channels\n' +
                        '• Several suspicious messages sent within a short time window',
                    inline: false
                },
                {
                    name: 'What happens when spam is detected',
                    value:
                        '1. The user is timed out for 5 hours when Discord permissions allow it.\n' +
                        '2. Recent tracked spam messages are deleted immediately.\n' +
                        '3. The bot checks available text and voice-channel text chats for ' +
                        'additional messages from that user from the last two minutes.\n' +
                        '4. A moderation summary is sent to the configured log channel.',
                    inline: false
                },
                {
                    name: 'What is ignored',
                    value:
                        'Direct messages, messages sent by bots, and messages from members ' +
                        'with the `Manage Messages` permission are ignored.',
                    inline: false
                },
                {
                    name: 'Important limitations',
                    value:
                        'The bot needs permission to view channels, read message history, ' +
                        'manage messages, send embeds, and moderate members. Discord role ' +
                        'hierarchy can prevent a timeout even when spam is detected.',
                    inline: false
                }
            )
            .setFooter({ text: 'Made by AmareDev2k' });

        await announcementChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Failed to post announcement:', error.message);
    }
}

function isSuspiciousMessage(message) {
    const hasEveryone = message.mentions.everyone || message.content.includes('@everyone') || message.content.includes('@here');
    const hasImage = message.attachments.some(att => {
        const name = (att.name || '').toLowerCase();
        const contentType = (att.contentType || '').toLowerCase();
        return IMAGE_EXTENSIONS.some(ext => name.endsWith(ext)) || contentType.startsWith('image/');
    });
    return hasEveryone || hasImage;
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Ignore Moderators/Admins with ManageMessages permission
    if (message.member && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const now = Date.now();

    if (!userActivity.has(guildId)) {
        userActivity.set(guildId, new Map());
    }
    const guildMap = userActivity.get(guildId);
    if (!guildMap.has(userId)) {
        guildMap.set(userId, []);
    }

    const suspicious = isSuspiciousMessage(message);
    const history = guildMap.get(userId);
    history.push({ timestamp: now, channelId: message.channel.id, message, isSuspicious: suspicious });

    // Filter to sliding time window
    const recentHistory = history.filter(entry => now - entry.timestamp <= SPAM_TIME_WINDOW_MS);
    guildMap.set(userId, recentHistory);

    const suspiciousMsgs = recentHistory.filter(e => e.isSuspicious);
    const suspiciousChannels = new Set(suspiciousMsgs.map(e => e.channelId));

    const hasEveryonePing = message.mentions.everyone || message.content.includes('@everyone') || message.content.includes('@here');
    const hasImageAttachment = message.attachments.some(att => IMAGE_EXTENSIONS.some(ext => (att.name || '').toLowerCase().endsWith(ext)));

    const isRaidSpam = (
        (hasEveryonePing && suspiciousMsgs.length >= 2) ||
        (suspiciousChannels.size >= MAX_CHANNELS_THRESHOLD) ||
        (suspiciousMsgs.length >= MAX_MESSAGES_THRESHOLD) ||
        (hasEveryonePing && hasImageAttachment)
    );

    const userKey = `${guildId}:${userId}`;
    if (isRaidSpam && !processingUsers.has(userKey)) {
        processingUsers.add(userKey);
        try {
            await handleSpammer(message.guild, message.member, recentHistory);
        } finally {
            guildMap.set(userId, []);
            processingUsers.delete(userKey);
        }
    }
});

async function handleSpammer(guild, member, history) {
    if (!member) return;
    const reason = 'Automated Anti-Spam: @everyone / Image (.png/.jpg) cross-channel spam detected.';

    // 1. Mute (Timeout) for 5 hours
    let muteSuccess = false;
    try {
        await member.timeout(MUTE_DURATION_MS, reason);
        muteSuccess = true;
        console.log(`🔇 Muted ${member.user.tag} for 5 hours in ${guild.name}.`);
    } catch (err) {
        console.error(`❌ Failed to timeout ${member.user.tag}:`, err.message);
    }

    // 2. Delete tracked messages immediately
    let deletedCount = 0;
    const trackedIds = new Set();
    for (const item of history) {
        try {
            await item.message.delete();
            deletedCount++;
            trackedIds.add(item.message.id);
        } catch (e) {}
    }

    // 3. Sweep all Text Channels and Voice Channel Text Chats
    const cutoff = Date.now() - 2 * 60 * 1000;
    const channels = guild.channels.cache.filter(ch => ch.isTextBased());

    await Promise.all(channels.map(async (channel) => {
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const spamMsgs = messages.filter(m =>
                m.author.id === member.id &&
                !trackedIds.has(m.id) &&
                m.createdTimestamp >= cutoff
            );
            if (spamMsgs.size > 0) {
                const deleted = await channel.bulkDelete(spamMsgs, true);
                deletedCount += deleted.size;
            }
        } catch (e) {}
    }));

    console.log(`🗑️ Deleted ${deletedCount} spam messages from ${member.user.tag}.`);

    // 4. Optional Log Embed
    if (LOG_CHANNEL_ID) {
        const logCh = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logCh && logCh.isTextBased()) {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Anti-Spam Action Executed')
                .setColor(0xFF0000)
                .addFields(
                    { name: 'User', value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
                    { name: 'Action', value: muteSuccess ? '5h Timeout (Mute)' : 'Failed to Mute', inline: true },
                    { name: 'Messages Deleted', value: `\`${deletedCount}\` across Text & Voice chats`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();
            await logCh.send({ embeds: [embed] }).catch(() => {});
        }
    }
}

client.login(TOKEN);
