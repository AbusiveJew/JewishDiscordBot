require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const discordTranscripts = require('discord-html-transcripts');

const PREFIX = process.env.PREFIX || '$';
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'gal.sys';
const BLACKLIST_PATH = path.join(__dirname, 'blacklist.json');
const PROTECTION_PATH = path.join(__dirname, 'protection.json');
const TICKETS_PATH = path.join(__dirname, 'tickets_config.json');
const LOGS_PATH = path.join(__dirname, 'logs_config.json');
const AUTOROLE_PATH = path.join(__dirname, 'autorole.json');

const BRAND = {
  name: 'JewishDiscordBot',
  footer: '⚡ Developed by gal.sys',
  colors: {
    primary: 0x5865f2,
    success: 0x57f287,
    warning: 0xfee75c,
    danger: 0xed4245,
    dark: 0x2b2d31,
    info: 0x5bc0eb,
    purple: 0x9b59b6,
    pink: 0xe91e63,
    orange: 0xe67e22,
  },
};

const DEFAULT_PROTECTION = {
  antiSpam: { enabled: true, maxMessages: 5, interval: 3000, action: 'timeout', timeoutDuration: 60000 },
  antiRaid: { enabled: true, maxJoins: 8, interval: 10000, lockServer: false },
  antiNuke: { enabled: true, maxActions: 3, interval: 10000, maxBans: 5, maxKicks: 5 },
  antiLink: { enabled: false, whitelist: [], action: 'delete' },
  rateLimit: { enabled: true, cooldown: 2000 },
};

const spamTracker = new Map();
const joinTracker = [];
const nukeTracker = new Map();
const cooldownTracker = new Map();

const co = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
});
function loadBlacklist() {
  try {
    return JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveBlacklist(list) {
  fs.writeFileSync(BLACKLIST_PATH, JSON.stringify(list, null, 2));
}


function loadProtection() {
  try {
    const data = JSON.parse(fs.readFileSync(PROTECTION_PATH, 'utf-8'));
    return { ...DEFAULT_PROTECTION, ...data };
  } catch {
    return { ...DEFAULT_PROTECTION };
  }
}

function saveProtection(config) {
  fs.writeFileSync(PROTECTION_PATH, JSON.stringify(config, null, 2));
}


const DEFAULT_TICKETS = { openCategoryId: null, closedCategoryId: null, ticketCount: 0 };

function loadTickets() {
  try {
    const data = JSON.parse(fs.readFileSync(TICKETS_PATH, 'utf-8'));
    return { ...DEFAULT_TICKETS, ...data };
  } catch {
    return { ...DEFAULT_TICKETS };
  }
}

function saveTickets(config) {
  fs.writeFileSync(TICKETS_PATH, JSON.stringify(config, null, 2));
}


const DEFAULT_LOGS = { channelId: null };

function loadLogs() {
  try {
    const data = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
    return { ...DEFAULT_LOGS, ...data };
  } catch {
    return { ...DEFAULT_LOGS };
  }
}

function saveLogs(config) {
  fs.writeFileSync(LOGS_PATH, JSON.stringify(config, null, 2));
}


const DEFAULT_AUTOROLE = { roleId: null };

function loadAutoRole() {
  try {
    const data = JSON.parse(fs.readFileSync(AUTOROLE_PATH, 'utf-8'));
    return { ...DEFAULT_AUTOROLE, ...data };
  } catch {
    return { ...DEFAULT_AUTOROLE };
  }
}

function saveAutoRole(config) {
  fs.writeFileSync(AUTOROLE_PATH, JSON.stringify(config, null, 2));
}

async function getLogChannel(guild) {
  const config = loadLogs();
  if (config.channelId) {
    const channel = guild.channels.cache.get(config.channelId);
    if (channel) return channel;
  }
  return null;
}


function makeEmbed({ title, description, color = BRAND.colors.dark, fields = [], thumbnail = null }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  embed.setAuthor({ name: BRAND.name, iconURL: client.user?.displayAvatarURL() });

  if (fields.length > 0) embed.addFields(fields);
  if (thumbnail) embed.setThumbnail(thumbnail);

  return embed;
}


function parseDuration(args) {
  const amount = parseInt(args[0], 10);
  if (isNaN(amount) || amount <= 0) return null;

  const unit = (args[1] || 'min').toLowerCase();
  const multipliers = {
    sec: 1000, secs: 1000, second: 1000, seconds: 1000, s: 1000,
    min: 60_000, mins: 60_000, minute: 60_000, minutes: 60_000, m: 60_000,
    hour: 3_600_000, hours: 3_600_000, hr: 3_600_000, hrs: 3_600_000, h: 3_600_000,
    day: 86_400_000, days: 86_400_000, d: 86_400_000,
  };

  const ms = multipliers[unit];
  return ms ? amount * ms : null;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}


function log(type, message) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const prefix = `${co.dim}${time}${co.reset}`;
  const types = {
    info: `${co.cyan}ℹ INFO ${co.reset}`,
    success: `${co.green}✓ OK   ${co.reset}`,
    warn: `${co.yellow}⚠ WARN ${co.reset}`,
    error: `${co.red}✗ ERR  ${co.reset}`,
    mod: `${co.magenta}⚔ MOD  ${co.reset}`,
    event: `${co.blue}★ EVT  ${co.reset}`,
    img: `${co.yellow}🖼 IMG  ${co.reset}`,
  };
  console.log(`  ${prefix}  ${types[type] || types.info}  ${message}`);
}

function isAuthorized(member) {
  if (member.user.username.toLowerCase() === OWNER_USERNAME.toLowerCase()) return true;
  return false;
}

async function getImageBuffer(message, args) {
  const attachment = message.attachments.first();
  if (attachment && attachment.contentType?.startsWith('image/')) {
    const res = await fetch(attachment.url);
    return Buffer.from(await res.arrayBuffer());
  }

  const url = args.find(a => /^https?:\/\/.+/i.test(a));
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image (HTTP ${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  if (message.reference) {
    try {
      const replied = await message.channel.messages.fetch(message.reference.messageId);
      const repliedAttachment = replied.attachments.first();
      if (repliedAttachment && repliedAttachment.contentType?.startsWith('image/')) {
        const res = await fetch(repliedAttachment.url);
        return Buffer.from(await res.arrayBuffer());
      }
    } catch { }
  }

  return null;
}


async function imageToGif(buffer) {
  const size = 256;
  const numFrames = 16;
  const gif = GIFEncoder();

  for (let i = 0; i < numFrames; i++) {
    const t = i / numFrames;
    const brightness = 0.75 + 0.4 * Math.sin(t * Math.PI * 2);
    const hue = Math.round(t * 120);

    const { data } = await sharp(buffer)
      .resize(size, size, { fit: 'cover' })
      .modulate({ brightness, hue })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = new Uint8Array(size * size * 4);
    for (let j = 0; j < size * size; j++) {
      rgba[j * 4] = data[j * 3];
      rgba[j * 4 + 1] = data[j * 3 + 1];
      rgba[j * 4 + 2] = data[j * 3 + 2];
      rgba[j * 4 + 3] = 255;
    }

    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, size, size, { palette, delay: 80 });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}

async function deepfryImage(buffer) {
  const jpeg = await sharp(buffer)
    .resize(512, 512, { fit: 'inside' })
    .modulate({ saturation: 3.5, brightness: 1.3 })
    .sharpen({ sigma: 5 })
    .jpeg({ quality: 3 })
    .toBuffer();

  return sharp(jpeg)
    .modulate({ saturation: 2.5 })
    .sharpen({ sigma: 4 })
    .png()
    .toBuffer();
}

async function invertImage(buffer) {
  return sharp(buffer)
    .resize(512, 512, { fit: 'inside' })
    .negate({ alpha: false })
    .png()
    .toBuffer();
}

async function blurImage(buffer) {
  return sharp(buffer)
    .resize(512, 512, { fit: 'inside' })
    .blur(15)
    .png()
    .toBuffer();
}

async function pixelateImage(buffer) {
  return sharp(buffer)
    .resize(24, 24, { fit: 'cover' })
    .resize(512, 512, { fit: 'cover', kernel: 'nearest' })
    .png()
    .toBuffer();
}


const activities = [
  { name: '🛡️ Protecting the server', type: ActivityType.Custom },
  { name: 'for rule breakers', type: ActivityType.Watching },
  { name: `${PREFIX}help for commands`, type: ActivityType.Listening },
  { name: 'moderation logs', type: ActivityType.Watching },
  { name: 'with the ban hammer', type: ActivityType.Playing },
];
let activityIndex = 0;

function rotateActivity() {
  const a = activities[activityIndex];
  client.user.setActivity(a.name, { type: a.type });
  activityIndex = (activityIndex + 1) % activities.length;
}


const eightBallResponses = [
  { text: 'It is certain.', type: 'positive' },
  { text: 'Without a doubt.', type: 'positive' },
  { text: 'You may rely on it.', type: 'positive' },
  { text: 'Yes, definitely.', type: 'positive' },
  { text: 'It is decidedly so.', type: 'positive' },
  { text: 'As I see it, yes.', type: 'positive' },
  { text: 'Most likely.', type: 'positive' },
  { text: 'Signs point to yes.', type: 'positive' },
  { text: 'Reply hazy, try again.', type: 'neutral' },
  { text: 'Ask again later.', type: 'neutral' },
  { text: 'Better not tell you now.', type: 'neutral' },
  { text: 'Cannot predict now.', type: 'neutral' },
  { text: 'Concentrate and ask again.', type: 'neutral' },
  { text: "Don't count on it.", type: 'negative' },
  { text: 'My reply is no.', type: 'negative' },
  { text: 'My sources say no.', type: 'negative' },
  { text: 'Outlook not so good.', type: 'negative' },
  { text: 'Very doubtful.', type: 'negative' },
];


client.once('ready', async () => {
  console.log('Bot logged in');
  log('success', `${co.bold}Logged in as ${co.cyan}${client.user.tag}${co.reset}`);
  log('info', `Prefix: ${co.yellow}${PREFIX}${co.reset}`);
  log('info', `Owner: ${co.yellow}${OWNER_USERNAME}${co.reset}`);
  log('info', `Servers: ${co.yellow}${client.guilds.cache.size}${co.reset}`);
  log('info', `Users: ${co.yellow}${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}${co.reset}`);
  log('info', `Commands: ${co.yellow}30${co.reset}`);
  log('info', `Blacklisted: ${co.yellow}${loadBlacklist().length}${co.reset}`);

  console.log(`\n  ${co.dim}─────────────────────────────────────────${co.reset}`);
  log('success', `${co.green}Bot ready — only ${co.bold}${OWNER_USERNAME}${co.reset}${co.green} can use commands${co.reset}`);
  console.log(`  ${co.dim}─────────────────────────────────────────${co.reset}\n`);

  rotateActivity();
  setInterval(rotateActivity, 15_000);


  const logsConfig = loadLogs();
  const guild = client.guilds.cache.first();
  if (!logsConfig.channelId && guild) {
    try {
      let logChannel = guild.channels.cache.find(c => c.name === 'action-logs');
      if (!logChannel) {
        logChannel = await guild.channels.create({
          name: 'action-logs',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          ]
        });
        log('event', `${co.blue}AUTO-SETUP${co.reset} Created #action-logs channel`);
      }
      logsConfig.channelId = logChannel.id;
      saveLogs(logsConfig);
    } catch (err) {
      log('error', `Failed to auto-create action-logs: ${err.message}`);
    }
  }
});


client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;
  if (!message.guild) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  log('info', `${co.dim}${message.author.username}${co.reset} ran ${co.cyan}${PREFIX}${command}${co.reset} in ${co.dim}#${message.channel.name}${co.reset}`);

  if (!isAuthorized(message.member)) {
    return message.reply({
      embeds: [makeEmbed({
        title: '⛔ Access Denied',
        description: 'You are not authorized to use my commands.',
        color: BRAND.colors.danger,
        fields: [
          { name: 'Required', value: `Username **${OWNER_USERNAME}**`, inline: false },
        ],
      })],
    });
  }



  if (command === 'help') {
    return message.reply({
      embeds: [makeEmbed({
        title: '📖Commands',
        description: 'Sexy Commands\n\u200b',
        color: BRAND.colors.primary,
        fields: [
          {
            name: '🔨 Moderation',
            value: [
              `\`${PREFIX}ban @user\` — Permanently ban a user`,
              `\`${PREFIX}kick @user\` — Kick a user from server`,
              `\`${PREFIX}time @user <dur>\` — Timeout a user`,
              `\`${PREFIX}purge <count>\` — Bulk delete messages`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🚫 Blacklist',
            value: [
              `\`${PREFIX}blacklist @user "reason"\` — Add to blacklist`,
              `\`${PREFIX}unblacklist @user\` — Remove from blacklist`,
              `\`${PREFIX}blacklisted\` — View all blacklisted users`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🖼️ Image Effects',
            value: [
              `\`${PREFIX}imgtogif <url>\` — Animate an image as GIF`,
              `\`${PREFIX}deepfry <url>\` — Deep-fry an image`,
              `\`${PREFIX}invert <url>\` — Invert image colors`,
              `\`${PREFIX}blur <url>\` — Blur an image`,
              `\`${PREFIX}pixel <url>\` — Pixelate an image`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🎲 Games',
            value: [
              `\`${PREFIX}8ball <question>\` — Ask the magic 8-ball`,
              `\`${PREFIX}coinflip\` — Flip a coin`,
              `\`${PREFIX}roll [sides]\` — Roll a die`,
              `\`${PREFIX}mock <text>\` — SpOnGeBoB mOcK tExT`,
              `\`${PREFIX}reverse <text>\` — Reverse text`,
              `\`${PREFIX}emojify <text>\` — Turn text into emojis`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🛡️ Protection',
            value: [
              `\`${PREFIX}protection\` — View protection status`,
              `\`${PREFIX}antispam [on/off]\` — Toggle anti-spam`,
              `\`${PREFIX}antiraid [on/off]\` — Toggle anti-raid`,
              `\`${PREFIX}antinuke [on/off]\` — Toggle anti-nuke`,
              `\`${PREFIX}antilink [on/off]\` — Toggle link filter`,
              `\`${PREFIX}ratelimit [on/off]\` — Toggle command ratelimit`,
            ].join('\n'),
            inline: false,
          },
          {
            name: 'ℹ️ Info & Utility',
            value: [
              `\`${PREFIX}avatar [@user]\` — Show user avatar`,
              `\`${PREFIX}serverinfo\` — Server statistics`,
              `\`${PREFIX}userinfo [@user]\` — User information`,
              `\`${PREFIX}ping\` — Check bot latency`,
              `\`${PREFIX}help\` — Show this message`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '⚙️ Configuration',
            value: [
              `\`${PREFIX}setlogs #channel\` — Setup audit event logging`,
              `\`${PREFIX}ticket\` — Configure and spawn the ticket panel`,
              `\`${PREFIX}role @role\` — Setup auto-role for new members`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '\u200b',
            value: `*${BRAND.footer}*`,
            inline: false,
          },
        ],
      })],
    });
  }

  if (command === 'ping') {
    const sent = await message.reply({
      embeds: [makeEmbed({
        title: '🏓 Pinging...',
        description: 'Measuring latency...',
        color: BRAND.colors.info,
      })],
    });

    const roundtrip = sent.createdTimestamp - message.createdTimestamp;
    const wsLatency = Math.round(client.ws.ping);

    return sent.edit({
      embeds: [makeEmbed({
        title: '🏓 Pong!',
        description: 'Latency measured successfully.',
        color: BRAND.colors.success,
        fields: [
          { name: '📡 Roundtrip', value: `\`${roundtrip}ms\``, inline: true },
          { name: '💓 WebSocket', value: `\`${wsLatency}ms\``, inline: true },
          { name: '📊 Status', value: roundtrip < 200 ? '🟢 Excellent' : roundtrip < 500 ? '🟡 Good' : '🔴 Slow', inline: true },
        ],
      })],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────



  if (command === 'role') {
    const targetRole = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!targetRole) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Set Auto-Role',
          description: 'Set the role that will be automatically assigned to new members.',
          color: BRAND.colors.warning,
          fields: [{ name: 'Syntax', value: `\`\`\`\n${PREFIX}role @role\n\`\`\``, inline: false }],
        })]
      });
    }

    const autoRoleConfig = loadAutoRole();
    autoRoleConfig.roleId = targetRole.id;
    saveAutoRole(autoRoleConfig);
    log('info', `${co.green}AUTO-ROLE${co.reset} Role updated to ${targetRole.name}`);

    return message.reply({
      embeds: [makeEmbed({
        title: '✅ Auto-Role Updated',
        description: `New members will now automatically receive the ${targetRole.toString()} role.`,
        color: BRAND.colors.success,
      })]
    });
  }

  if (command === 'setlogs') {
    const targetChannel = message.mentions.channels.first();
    if (!targetChannel) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Set Logs',
          description: 'Set the channel where audit logs will be sent.',
          color: BRAND.colors.warning,
          fields: [{ name: 'Syntax', value: `\`\`\`\n${PREFIX}setlogs #channel\n\`\`\``, inline: false }],
        })]
      });
    }

    const logsConfig = loadLogs();
    logsConfig.channelId = targetChannel.id;
    saveLogs(logsConfig);
    log('info', `${co.green}SET LOGS${co.reset} Channel updated to #${targetChannel.name}`);

    return message.reply({
      embeds: [makeEmbed({
        title: '✅ Logs Channel Updated',
        description: `Audit logs and transcripts will now be sent to ${targetChannel.toString()}.`,
        color: BRAND.colors.success,
      })]
    });
  }

  if (command === 'ticket') {
    const config = loadTickets();
    const openCat = config.openCategoryId ? `<#${config.openCategoryId}>` : 'Not Set';
    const closedCat = config.closedCategoryId ? `<#${config.closedCategoryId}>` : 'Not Set';

    const embed = makeEmbed({
      title: '🎫 Ticket System Setup',
      description: 'Configure your ticket system categories or send the ticket creation panel to this channel.',
      color: BRAND.colors.primary,
      fields: [
        { name: '📂 Open Tickets Category', value: openCat, inline: true },
        { name: '🗃️ Closed Tickets Category', value: closedCat, inline: true },
        { name: '📊 Total Tickets', value: `\`${config.ticketCount}\``, inline: true },
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup_open_cat')
        .setLabel('Set Open Category')
        .setEmoji('📂')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('setup_closed_cat')
        .setLabel('Set Closed Category')
        .setEmoji('🗃️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('send_ticket_panel')
        .setLabel('Send Ticket Panel')
        .setEmoji('📤')
        .setStyle(ButtonStyle.Primary)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }



  if (command === 'ban') {
    const target = message.mentions.members.first();
    if (!target) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Ban',
          description: 'Permanently ban a user from the server.',
          color: BRAND.colors.warning,
          fields: [
            { name: 'Syntax', value: `\`\`\`\n${PREFIX}ban @user\n\`\`\``, inline: false },
          ],
        })]
      });
    }

    if (!target.bannable) {
      return message.reply({
        embeds: [makeEmbed({
          title: '❌ Cannot Ban',
          description: `Cannot ban **${target.user.tag}** — they may have a higher role.`,
          color: BRAND.colors.danger,
        })]
      });
    }

    try {
      await target.ban({ reason: `Banned by ${message.author.tag}` });
      log('mod', `${co.red}BAN${co.reset} ${target.user.tag} by ${message.author.tag}`);
      return message.reply({
        embeds: [makeEmbed({
          title: '🔨 User Banned',
          description: `**${target.user.tag}** has been permanently banned.`,
          color: BRAND.colors.danger,
          thumbnail: target.user.displayAvatarURL({ size: 128 }),
          fields: [
            { name: '👤 User', value: `${target.user.tag}`, inline: true },
            { name: '🔧 Moderator', value: `${message.author.tag}`, inline: true },
            { name: '📋 Action', value: '`Permanent Ban`', inline: true },
          ],
        })]
      });
    } catch (err) {
      log('error', `Ban failed: ${err.message}`);
      return message.reply({ embeds: [makeEmbed({ title: '❌ Error', description: `\`${err.message}\``, color: BRAND.colors.danger })] });
    }
  }

  if (command === 'kick') {
    const target = message.mentions.members.first();
    if (!target) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Kick',
          description: 'Kick a user from the server.',
          color: BRAND.colors.warning,
          fields: [
            { name: 'Syntax', value: `\`\`\`\n${PREFIX}kick @user\n\`\`\``, inline: false },
          ],
        })]
      });
    }

    if (!target.kickable) {
      return message.reply({
        embeds: [makeEmbed({
          title: '❌ Cannot Kick',
          description: `Cannot kick **${target.user.tag}** — they may have a higher role.`,
          color: BRAND.colors.danger,
        })]
      });
    }

    try {
      await target.kick(`Kicked by ${message.author.tag}`);
      log('mod', `${co.yellow}KICK${co.reset} ${target.user.tag} by ${message.author.tag}`);
      return message.reply({
        embeds: [makeEmbed({
          title: '👢 User Kicked',
          description: `**${target.user.tag}** has been kicked from the server.`,
          color: BRAND.colors.warning,
          thumbnail: target.user.displayAvatarURL({ size: 128 }),
          fields: [
            { name: '👤 User', value: `${target.user.tag}`, inline: true },
            { name: '🔧 Moderator', value: `${message.author.tag}`, inline: true },
            { name: '📋 Action', value: '`Kick`', inline: true },
          ],
        })]
      });
    } catch (err) {
      log('error', `Kick failed: ${err.message}`);
      return message.reply({ embeds: [makeEmbed({ title: '❌ Error', description: `\`${err.message}\``, color: BRAND.colors.danger })] });
    }
  }

  if (command === 'time') {
    const target = message.mentions.members.first();
    if (!target) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Timeout',
          description: 'Temporarily mute a user.',
          color: BRAND.colors.warning,
          fields: [
            { name: 'Syntax', value: `\`\`\`\n${PREFIX}time @user <amount> <unit>\n\`\`\``, inline: false },
            { name: 'Units', value: '`sec` · `min` · `hour` · `day`', inline: false },
            { name: 'Examples', value: `\`${PREFIX}time @user 10 min\`\n\`${PREFIX}time @user 2 hours\``, inline: false },
          ],
        })]
      });
    }

    const durationArgs = args.filter(a => !a.startsWith('<@'));
    const duration = parseDuration(durationArgs);

    if (!duration) {
      return message.reply({
        embeds: [makeEmbed({
          title: '⚠️ Invalid Duration',
          description: 'Provide a valid duration like `10 min` or `2 hours`.',
          color: BRAND.colors.warning,
        })]
      });
    }

    if (duration > 28 * 86_400_000) {
      return message.reply({
        embeds: [makeEmbed({
          title: '❌ Duration Too Long',
          description: 'Timeout cannot exceed **28 days**.',
          color: BRAND.colors.danger,
        })]
      });
    }

    if (!target.moderatable) {
      return message.reply({
        embeds: [makeEmbed({
          title: '❌ Cannot Timeout',
          description: `Cannot timeout **${target.user.tag}** — they may have a higher role.`,
          color: BRAND.colors.danger,
        })]
      });
    }

    try {
      await target.timeout(duration, `Timed out by ${message.author.tag}`);
      const readable = formatDuration(duration);
      log('mod', `${co.blue}TIMEOUT${co.reset} ${target.user.tag} for ${readable} by ${message.author.tag}`);
      return message.reply({
        embeds: [makeEmbed({
          title: '⏱️ User Timed Out',
          description: `**${target.user.tag}** has been timed out.`,
          color: BRAND.colors.primary,
          thumbnail: target.user.displayAvatarURL({ size: 128 }),
          fields: [
            { name: '👤 User', value: `${target.user.tag}`, inline: true },
            { name: '🔧 Moderator', value: `${message.author.tag}`, inline: true },
            { name: '⏳ Duration', value: `\`${readable}\``, inline: true },
          ],
        })]
      });
    } catch (err) {
      log('error', `Timeout failed: ${err.message}`);
      return message.reply({ embeds: [makeEmbed({ title: '❌ Error', description: `\`${err.message}\``, color: BRAND.colors.danger })] });
    }
  }

  if (command === 'purge') {
    const count = parseInt(args[0], 10);
    if (isNaN(count) || count < 1 || count > 100) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Purge',
          description: 'Bulk delete messages in this channel.',
          color: BRAND.colors.warning,
          fields: [
            { name: 'Syntax', value: `\`\`\`\n${PREFIX}purge <1-100>\n\`\`\``, inline: false },
          ],
        })]
      });
    }

    try {
      // +1 to include the command message itself
      const deleted = await message.channel.bulkDelete(count + 1, true);
      log('mod', `${co.red}PURGE${co.reset} ${deleted.size - 1} messages in #${message.channel.name} by ${message.author.tag}`);

      const confirm = await message.channel.send({
        embeds: [makeEmbed({
          title: '🗑️ Messages Purged',
          description: `Deleted **${deleted.size - 1}** messages.`,
          color: BRAND.colors.success,
          fields: [
            { name: '📍 Channel', value: `#${message.channel.name}`, inline: true },
            { name: '🔧 Moderator', value: `${message.author.tag}`, inline: true },
          ],
        })]
      });

      // Auto-delete confirmation after 5 seconds
      setTimeout(() => confirm.delete().catch(() => { }), 5000);
    } catch (err) {
      log('error', `Purge failed: ${err.message}`);
      return message.reply({ embeds: [makeEmbed({ title: '❌ Error', description: `\`${err.message}\``, color: BRAND.colors.danger })] });
    }
    return;
  }

  if (command === 'blacklist') {
    const target = message.mentions.users.first();
    if (!target) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Blacklist',
          description: 'Add a user to the blacklist. They will be auto-kicked on join.',
          color: BRAND.colors.warning,
          fields: [
            { name: 'Syntax', value: `\`\`\`\n${PREFIX}blacklist @user "reason"\n\`\`\``, inline: false },
          ],
        })]
      });
    }

    const reasonMatch = message.content.match(/"(.+?)"/);
    const reason = reasonMatch ? reasonMatch[1] : args.filter(a => !a.startsWith('<@')).join(' ') || 'No reason provided';

    const blacklist = loadBlacklist();

    const existing = blacklist.find(e => e.userId === target.id);
    if (existing) {
      return message.reply({
        embeds: [makeEmbed({
          title: '⚠️ Already Blacklisted',
          description: `**${target.tag}** is already on the blacklist.`,
          color: BRAND.colors.warning,
          thumbnail: target.displayAvatarURL({ size: 128 }),
          fields: [
            { name: '📝 Reason', value: existing.reason, inline: false },
            { name: '👮 By', value: existing.blacklistedBy, inline: true },
            { name: '📅 When', value: `<t:${Math.floor(new Date(existing.blacklistedAt).getTime() / 1000)}:R>`, inline: true },
          ],
        })]
      });
    }

    blacklist.push({
      userId: target.id,
      userTag: target.tag,
      reason,
      blacklistedBy: message.author.tag,
      blacklistedAt: new Date().toISOString(),
    });
    saveBlacklist(blacklist);
    log('mod', `${co.magenta}BLACKLIST${co.reset} ${target.tag} — "${reason}" by ${message.author.tag}`);

    return message.reply({
      embeds: [makeEmbed({
        title: '🚫 User Blacklisted',
        description: `**${target.tag}** has been added to the blacklist.`,
        color: BRAND.colors.dark,
        thumbnail: target.displayAvatarURL({ size: 128 }),
        fields: [
          { name: '👤 User', value: `${target.tag}`, inline: true },
          { name: '🔧 Moderator', value: `${message.author.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false },
        ],
      })]
    });
  }

  if (command === 'unblacklist') {
    const target = message.mentions.users.first();
    if (!target) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Unblacklist',
          description: 'Remove a user from the blacklist.',
          color: BRAND.colors.warning,
          fields: [{ name: 'Syntax', value: `\`\`\`\n${PREFIX}unblacklist @user\n\`\`\``, inline: false }],
        })]
      });
    }

    let blacklist = loadBlacklist();
    const index = blacklist.findIndex(e => e.userId === target.id);

    if (index === -1) {
      return message.reply({
        embeds: [makeEmbed({
          title: '⚠️ Not Found',
          description: `**${target.tag}** is not on the blacklist.`,
          color: BRAND.colors.warning,
        })]
      });
    }

    blacklist.splice(index, 1);
    saveBlacklist(blacklist);
    log('mod', `${co.green}UNBLACKLIST${co.reset} ${target.tag} by ${message.author.tag}`);

    return message.reply({
      embeds: [makeEmbed({
        title: '✅ User Unblacklisted',
        description: `**${target.tag}** has been removed from the blacklist.`,
        color: BRAND.colors.success,
        thumbnail: target.displayAvatarURL({ size: 128 }),
        fields: [
          { name: '👤 User', value: `${target.tag}`, inline: true },
          { name: '🔧 Moderator', value: `${message.author.tag}`, inline: true },
        ],
      })]
    });
  }

  if (command === 'blacklisted') {
    const blacklist = loadBlacklist();

    if (blacklist.length === 0) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📋 Server Blacklist',
          description: '```\n  The blacklist is empty.  \n```\nNo users are currently blacklisted.',
          color: BRAND.colors.primary,
        })]
      });
    }

    const list = blacklist.map((entry, i) => {
      const ts = `<t:${Math.floor(new Date(entry.blacklistedAt).getTime() / 1000)}:R>`;
      return `\`${String(i + 1).padStart(2, '0')}\` **${entry.userTag}**\n╰ *${entry.reason}* — ${ts}`;
    }).join('\n\n');

    return message.reply({
      embeds: [makeEmbed({
        title: `📋 Server Blacklist — ${blacklist.length} user${blacklist.length !== 1 ? 's' : ''}`,
        description: list,
        color: BRAND.colors.primary,
        fields: [{ name: '💡 Tip', value: `Use \`${PREFIX}unblacklist @user\` to remove someone.`, inline: false }],
      })]
    });
  }

  // ─────────────────────────────────────────────────────────────────────────


  if (command === 'imgtogif') {
    const buffer = await getImageBuffer(message, args);
    if (!buffer) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Image to GIF',
          description: 'Convert an image into an animated GIF with a pulse effect.',
          color: BRAND.colors.warning,
          fields: [
            { name: 'Syntax', value: `\`\`\`\n${PREFIX}imgtogif <url>\n\`\`\``, inline: false },
            { name: 'Tip', value: 'You can also attach an image or reply to one!', inline: false },
          ],
        })]
      });
    }

    const processing = await message.reply({
      embeds: [makeEmbed({
        title: '⏳ Processing...',
        description: 'Creating animated GIF — this may take a moment.',
        color: BRAND.colors.info,
      })]
    });

    try {
      const gif = await imageToGif(buffer);
      log('img', `${co.cyan}IMGTOGIF${co.reset} by ${message.author.tag} (${(gif.length / 1024).toFixed(0)}KB)`);

      await processing.delete().catch(() => { });
      return message.reply({
        embeds: [makeEmbed({
          title: '🎞️ Animated GIF Created',
          description: 'Here is your animated image!',
          color: BRAND.colors.success,
        })],
        files: [new AttachmentBuilder(gif, { name: 'animated.gif' })],
      });
    } catch (err) {
      log('error', `ImgToGif failed: ${err.message}`);
      await processing.delete().catch(() => { });
      return message.reply({ embeds: [makeEmbed({ title: '❌ Error', description: `Failed to process image: \`${err.message}\``, color: BRAND.colors.danger })] });
    }
  }

  if (command === 'deepfry') {
    const buffer = await getImageBuffer(message, args);
    if (!buffer) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Deep Fry',
          description: 'Deep-fry an image for maximum meme quality.',
          color: BRAND.colors.warning,
          fields: [
            { name: 'Syntax', value: `\`\`\`\n${PREFIX}deepfry <url>\n\`\`\``, inline: false },
            { name: 'Tip', value: 'You can also attach an image or reply to one!', inline: false },
          ],
        })]
      });
    }

    const processing = await message.reply({
      embeds: [makeEmbed({
        title: '🔥 Deep Frying...',
        description: 'Cranking up the saturation...',
        color: BRAND.colors.orange,
      })]
    });

    try {
      const result = await deepfryImage(buffer);
      log('img', `${co.yellow}DEEPFRY${co.reset} by ${message.author.tag}`);

      await processing.delete().catch(() => { });
      return message.reply({
        embeds: [makeEmbed({
          title: '🔥 Deep Fried!',
          description: 'Your image has been deep fried to perfection.',
          color: BRAND.colors.orange,
        })],
        files: [new AttachmentBuilder(result, { name: 'deepfried.png' })],
      });
    } catch (err) {
      log('error', `Deepfry failed: ${err.message}`);
      await processing.delete().catch(() => { });
      return message.reply({ embeds: [makeEmbed({ title: '❌ Error', description: `\`${err.message}\``, color: BRAND.colors.danger })] });
    }
  }

  if (command === 'invert') {
    const buffer = await getImageBuffer(message, args);
    if (!buffer) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Invert',
          description: 'Invert the colors of an image.',
          color: BRAND.colors.warning,
          fields: [{ name: 'Syntax', value: `\`\`\`\n${PREFIX}invert <url>\n\`\`\``, inline: false }],
        })]
      });
    }

    try {
      const result = await invertImage(buffer);
      log('img', `${co.magenta}INVERT${co.reset} by ${message.author.tag}`);
      return message.reply({
        embeds: [makeEmbed({ title: '🔄 Colors Inverted!', description: 'Image colors have been inverted.', color: BRAND.colors.purple })],
        files: [new AttachmentBuilder(result, { name: 'inverted.png' })],
      });
    } catch (err) {
      return message.reply({ embeds: [makeEmbed({ title: '❌ Error', description: `\`${err.message}\``, color: BRAND.colors.danger })] });
    }
  }

  if (command === 'blur') {
    const buffer = await getImageBuffer(message, args);
    if (!buffer) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Blur',
          description: 'Apply a gaussian blur to an image.',
          color: BRAND.colors.warning,
          fields: [{ name: 'Syntax', value: `\`\`\`\n${PREFIX}blur <url>\n\`\`\``, inline: false }],
        })]
      });
    }

    try {
      const result = await blurImage(buffer);
      log('img', `${co.blue}BLUR${co.reset} by ${message.author.tag}`);
      return message.reply({
        embeds: [makeEmbed({ title: '🌫️ Image Blurred!', description: 'Gaussian blur applied.', color: BRAND.colors.info })],
        files: [new AttachmentBuilder(result, { name: 'blurred.png' })],
      });
    } catch (err) {
      return message.reply({ embeds: [makeEmbed({ title: '❌ Error', description: `\`${err.message}\``, color: BRAND.colors.danger })] });
    }
  }

  if (command === 'pixel') {
    const buffer = await getImageBuffer(message, args);
    if (!buffer) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Pixelate',
          description: 'Pixelate an image.',
          color: BRAND.colors.warning,
          fields: [{ name: 'Syntax', value: `\`\`\`\n${PREFIX}pixel <url>\n\`\`\``, inline: false }],
        })]
      });
    }

    try {
      const result = await pixelateImage(buffer);
      log('img', `${co.green}PIXEL${co.reset} by ${message.author.tag}`);
      return message.reply({
        embeds: [makeEmbed({ title: '🟩 Image Pixelated!', description: 'Your image has been pixelated.', color: BRAND.colors.success })],
        files: [new AttachmentBuilder(result, { name: 'pixelated.png' })],
      });
    } catch (err) {
      return message.reply({ embeds: [makeEmbed({ title: '❌ Error', description: `\`${err.message}\``, color: BRAND.colors.danger })] });
    }
  }



  if (command === 'avatar') {
    const target = message.mentions.users.first() || message.author;
    const avatarURL = target.displayAvatarURL({ size: 1024, dynamic: true });

    return message.reply({
      embeds: [makeEmbed({
        title: `🖼️ ${target.tag}'s Avatar`,
        description: `[Open in browser](${avatarURL})`,
        color: BRAND.colors.primary,
      }).setImage(avatarURL)]
    });
  }

  if (command === 'serverinfo') {
    const guild = message.guild;
    const owner = await guild.fetchOwner();
    const channels = guild.channels.cache;
    const textChannels = channels.filter(c => c.type === 0).size;
    const voiceChannels = channels.filter(c => c.type === 2).size;

    return message.reply({
      embeds: [makeEmbed({
        title: `ℹ️ ${guild.name}`,
        description: guild.description || '*No description set.*',
        color: BRAND.colors.primary,
        thumbnail: guild.iconURL({ size: 256 }),
        fields: [
          { name: '👑 Owner', value: `${owner.user.tag}`, inline: true },
          { name: '👥 Members', value: `\`${guild.memberCount}\``, inline: true },
          { name: '💬 Channels', value: `\`${textChannels}\` text · \`${voiceChannels}\` voice`, inline: true },
          { name: '🎭 Roles', value: `\`${guild.roles.cache.size}\``, inline: true },
          { name: '😀 Emojis', value: `\`${guild.emojis.cache.size}\``, inline: true },
          { name: '🔒 Boost Level', value: `Level \`${guild.premiumTier}\` (${guild.premiumSubscriptionCount} boosts)`, inline: true },
          { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
        ],
      })]
    });
  }

  if (command === 'userinfo') {
    const target = message.mentions.members.first() || message.member;
    const user = target.user;

    const roles = target.roles.cache
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.toString())
      .slice(0, 10);

    return message.reply({
      embeds: [makeEmbed({
        title: `ℹ️ ${user.tag}`,
        description: `${user.toString()} · \`${user.id}\``,
        color: target.displayColor || BRAND.colors.primary,
        thumbnail: user.displayAvatarURL({ size: 256 }),
        fields: [
          { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '📥 Joined Server', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: '🏷️ Display Name', value: target.displayName, inline: true },
          { name: `🎭 Roles [${target.roles.cache.size - 1}]`, value: roles.length ? roles.join(' ') : 'None', inline: false },
          { name: '👑 Highest Role', value: `${target.roles.highest}`, inline: true },
          { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        ],
      })]
    });
  }

  if (command === '8ball') {
    const question = args.join(' ');
    if (!question) {
      return message.reply({
        embeds: [makeEmbed({
          title: '🎱 Magic 8-Ball',
          description: 'You need to ask a question!',
          color: BRAND.colors.warning,
          fields: [{ name: 'Syntax', value: `\`${PREFIX}8ball <question>\``, inline: false }],
        })]
      });
    }

    const response = eightBallResponses[Math.floor(Math.random() * eightBallResponses.length)];
    const colorMap = { positive: BRAND.colors.success, neutral: BRAND.colors.warning, negative: BRAND.colors.danger };

    return message.reply({
      embeds: [makeEmbed({
        title: '🎱 Magic 8-Ball',
        description: `**Q:** ${question}\n\n**A:** *${response.text}*`,
        color: colorMap[response.type],
      })]
    });
  }

  // ── $coinflip ───────────────────────────────────────────────────────────
  if (command === 'coinflip') {
    const result = Math.random() < 0.5;
    return message.reply({
      embeds: [makeEmbed({
        title: '🪙 Coin Flip',
        description: `The coin landed on...\n\n# ${result ? '🌕 Heads!' : '🌑 Tails!'}`,
        color: result ? BRAND.colors.success : BRAND.colors.info,
      })]
    });
  }

  // ── $roll [sides] ──────────────────────────────────────────────────────
  if (command === 'roll') {
    const sides = parseInt(args[0], 10) || 6;
    if (sides < 2 || sides > 1000) {
      return message.reply({
        embeds: [makeEmbed({
          title: '⚠️ Invalid',
          description: 'Sides must be between 2 and 1000.',
          color: BRAND.colors.warning,
        })]
      });
    }

    const result = Math.floor(Math.random() * sides) + 1;
    return message.reply({
      embeds: [makeEmbed({
        title: '🎲 Dice Roll',
        description: `Rolling a **d${sides}**...\n\n# 🎯 ${result}`,
        color: BRAND.colors.primary,
      })]
    });
  }

  if (command === 'mock') {
    const text = args.join(' ');
    if (!text) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Mock',
          description: `\`${PREFIX}mock <text>\``,
          color: BRAND.colors.warning,
        })]
      });
    }

    const mocked = text.split('').map((char, i) => i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()).join('');
    return message.reply({
      embeds: [makeEmbed({
        title: '🧽 SpOnGeBoB sAyS',
        description: mocked,
        color: BRAND.colors.warning,
      })]
    });
  }

  if (command === 'reverse') {
    const text = args.join(' ');
    if (!text) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Reverse',
          description: `\`${PREFIX}reverse <text>\``,
          color: BRAND.colors.warning,
        })]
      });
    }

    const reversed = [...text].reverse().join('');
    return message.reply({
      embeds: [makeEmbed({
        title: '🔄 Reversed',
        description: reversed,
        color: BRAND.colors.info,
      })]
    });
  }

  if (command === 'emojify') {
    const text = args.join(' ');
    if (!text) {
      return message.reply({
        embeds: [makeEmbed({
          title: '📝 Usage — Emojify',
          description: `\`${PREFIX}emojify <text>\``,
          color: BRAND.colors.warning,
        })]
      });
    }

    const emojiMap = {
      ' ': '   ',
      '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
      '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣',
      '!': '❗', '?': '❓', '#': '#️⃣', '*': '✳️',
    };

    const emojified = [...text.toLowerCase()].map(char => {
      if (char >= 'a' && char <= 'z') return `:regional_indicator_${char}:`;
      return emojiMap[char] || char;
    }).join(' ');

    const output = emojified.length > 1900 ? emojified.slice(0, 1900) + '...' : emojified;
    return message.channel.send(output);
  }



  if (command === 'protection') {
    const prot = loadProtection();
    const on = '`🟢 ON`';
    const off = '`🔴 OFF`';

    return message.reply({
      embeds: [makeEmbed({
        title: '🛡️ Server Protection Status',
        description: 'Current protection module status.',
        color: BRAND.colors.primary,
        fields: [
          { name: '🚫 Anti-Spam', value: `${prot.antiSpam.enabled ? on : off}\nMax ${prot.antiSpam.maxMessages} msgs / ${prot.antiSpam.interval / 1000}s`, inline: true },
          { name: '⚔️ Anti-Raid', value: `${prot.antiRaid.enabled ? on : off}\nActions: ${prot.antiRaid.lockServer ? '`Lock Server`' : '`Alert Only`'}`, inline: true },
          { name: '💣 Anti-Nuke', value: `${prot.antiNuke.enabled ? on : off}\nMax Bans: ${prot.antiNuke.maxBans} | Max Kicks: ${prot.antiNuke.maxKicks}`, inline: true },
          { name: '🔗 Anti-Link', value: `${prot.antiLink.enabled ? on : off}\nAction: \`${prot.antiLink.action}\``, inline: true },
          { name: '⏱️ Rate Limit', value: `${prot.rateLimit.enabled ? on : off}\n${prot.rateLimit.cooldown}ms cooldown`, inline: true },
        ],
      })]
    });
  }

  if (command === 'antispam') {
    const prot = loadProtection();
    const toggle = args[0]?.toLowerCase();
    if (toggle === 'on') prot.antiSpam.enabled = true;
    else if (toggle === 'off') prot.antiSpam.enabled = false;
    else prot.antiSpam.enabled = !prot.antiSpam.enabled;
    saveProtection(prot);
    log('mod', `${co.cyan}ANTI-SPAM${co.reset} ${prot.antiSpam.enabled ? 'ENABLED' : 'DISABLED'} by ${message.author.tag}`);
    return message.reply({
      embeds: [makeEmbed({
        title: `🚫 Anti-Spam ${prot.antiSpam.enabled ? 'Enabled' : 'Disabled'}`,
        description: prot.antiSpam.enabled
          ? `Users sending more than **${prot.antiSpam.maxMessages} messages** in **${prot.antiSpam.interval / 1000}s** will be timed out.`
          : 'Anti-spam protection has been disabled.',
        color: prot.antiSpam.enabled ? BRAND.colors.success : BRAND.colors.danger,
      })]
    });
  }

  if (command === 'antiraid') {
    const prot = loadProtection();
    const toggle = args[0]?.toLowerCase();
    if (toggle === 'on') prot.antiRaid.enabled = true;
    else if (toggle === 'off') prot.antiRaid.enabled = false;
    else prot.antiRaid.enabled = !prot.antiRaid.enabled;
    saveProtection(prot);
    log('mod', `${co.cyan}ANTI-RAID${co.reset} ${prot.antiRaid.enabled ? 'ENABLED' : 'DISABLED'} by ${message.author.tag}`);
    return message.reply({
      embeds: [makeEmbed({
        title: `⚔️ Anti-Raid ${prot.antiRaid.enabled ? 'Enabled' : 'Disabled'}`,
        description: prot.antiRaid.enabled
          ? `Alerts when more than **${prot.antiRaid.maxJoins} users** join within **${prot.antiRaid.interval / 1000}s**.\nAuto-Lock: **${prot.antiRaid.lockServer ? 'ENABLED' : 'DISABLED'}**`
          : 'Anti-raid protection has been disabled.',
        color: prot.antiRaid.enabled ? BRAND.colors.success : BRAND.colors.danger,
      })]
    });
  }

  if (command === 'lockraid') {
    const prot = loadProtection();
    prot.antiRaid.lockServer = !prot.antiRaid.lockServer;
    saveProtection(prot);
    log('mod', `${co.cyan}LOCK-RAID${co.reset} ${prot.antiRaid.lockServer ? 'ENABLED' : 'DISABLED'} by ${message.author.tag}`);
    return message.reply({
      embeds: [makeEmbed({
        title: `⚔️ Raid Auto-Lock ${prot.antiRaid.lockServer ? 'Enabled' : 'Disabled'}`,
        description: prot.antiRaid.lockServer
          ? 'The server will automatically remove **Send Messages** permissions from **@everyone** if a raid is detected.'
          : 'The server will only send an alert when a raid is detected.',
        color: prot.antiRaid.lockServer ? BRAND.colors.success : BRAND.colors.danger,
      })]
    });
  }

  if (command === 'antinuke') {
  const prot = loadProtection();
  const toggle = args[0]?.toLowerCase();
  if (toggle === 'on') prot.antiNuke.enabled = true;
  else if (toggle === 'off') prot.antiNuke.enabled = false;
  else prot.antiNuke.enabled = !prot.antiNuke.enabled;
  saveProtection(prot);
  log('mod', `${co.cyan}ANTI-NUKE${co.reset} ${prot.antiNuke.enabled ? 'ENABLED' : 'DISABLED'} by ${message.author.tag}`);
  return message.reply({
    embeds: [makeEmbed({
      title: `💣 Anti-Nuke ${prot.antiNuke.enabled ? 'Enabled' : 'Disabled'}`,
      description: prot.antiNuke.enabled
        ? `Detects mass channel/role deletions. Offenders will have all roles stripped.`
        : 'Anti-nuke protection has been disabled.',
      color: prot.antiNuke.enabled ? BRAND.colors.success : BRAND.colors.danger,
    })]
  });
}

if (command === 'antilink') {
  const prot = loadProtection();
  const toggle = args[0]?.toLowerCase();
  if (toggle === 'on') prot.antiLink.enabled = true;
  else if (toggle === 'off') prot.antiLink.enabled = false;
  else prot.antiLink.enabled = !prot.antiLink.enabled;
  saveProtection(prot);
  log('mod', `${co.cyan}ANTI-LINK${co.reset} ${prot.antiLink.enabled ? 'ENABLED' : 'DISABLED'} by ${message.author.tag}`);
  return message.reply({
    embeds: [makeEmbed({
      title: `🔗 Anti-Link ${prot.antiLink.enabled ? 'Enabled' : 'Disabled'}`,
      description: prot.antiLink.enabled
        ? 'Messages containing links will be auto-deleted (owner & root exempt).'
        : 'Link filter has been disabled.',
      color: prot.antiLink.enabled ? BRAND.colors.success : BRAND.colors.danger,
    })]
  });
}

if (command === 'ratelimit') {
  const prot = loadProtection();
  const toggle = args[0]?.toLowerCase();
  if (toggle === 'on') prot.rateLimit.enabled = true;
  else if (toggle === 'off') prot.rateLimit.enabled = false;
  else prot.rateLimit.enabled = !prot.rateLimit.enabled;
  saveProtection(prot);
  log('mod', `${co.cyan}RATE-LIMIT${co.reset} ${prot.rateLimit.enabled ? 'ENABLED' : 'DISABLED'} by ${message.author.tag}`);
  return message.reply({
    embeds: [makeEmbed({
      title: `⏱️ Rate Limit ${prot.rateLimit.enabled ? 'Enabled' : 'Disabled'}`,
      description: prot.rateLimit.enabled
        ? `Users will now have a **${prot.rateLimit.cooldown}ms** cooldown between commands.`
        : 'Command rate limiting has been disabled.',
      color: prot.rateLimit.enabled ? BRAND.colors.success : BRAND.colors.danger,
    })]
  });
}
});


client.on('interactionCreate', async (interaction) => {
  if (!interaction.inGuild()) return;

  const config = loadTickets();

  if (interaction.isChannelSelectMenu()) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: '⛔ Not authorized.', ephemeral: true });
    }

    const selectedCategory = interaction.values[0];

    if (interaction.customId === 'select_open_cat') {
      config.openCategoryId = selectedCategory;
      saveTickets(config);
      return interaction.reply({ content: `✅ Open tickets category set to <#${selectedCategory}>`, ephemeral: true });
    }

    if (interaction.customId === 'select_closed_cat') {
      config.closedCategoryId = selectedCategory;
      saveTickets(config);
      return interaction.reply({ content: `✅ Closed tickets category set to <#${selectedCategory}>`, ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ticket_create_select') {
      const selectedReason = interaction.values[0];
      const reasonMap = {
        'support': 'General Support',
        'purchase': 'Purchases & Billing',
        'get_channel': 'Channel Request',
        'report': 'User Report'
      };

      const parentId = config.openCategoryId;
      if (!parentId || !interaction.guild.channels.cache.has(parentId)) {
        return interaction.reply({ content: '❌ The ticket system is not configured currently. Contact an administrator.', ephemeral: true });
      }

      config.ticketCount++;
      saveTickets(config);
      const ticketId = config.ticketCount.toString().padStart(4, '0');
      const channelName = `ticket-${ticketId}`;

      try {
        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: parentId,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] },
          ],
        });

        const rootRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'root');
        if (rootRole) {
          await ticketChannel.permissionOverwrites.edit(rootRole.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          });
        }

        const embed = makeEmbed({
          title: `🎟️ Ticket #${ticketId} — ${reasonMap[selectedReason]}`,
          description: `Hello ${interaction.user.toString()},\n\nYou selected **${reasonMap[selectedReason]}**.\nPlease describe your request in detail.\nOur support team will respond shortly.\n\nClick the 🔒 button below to close the ticket.`,
          color: BRAND.colors.success,
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `${interaction.user.toString()}`, embeds: [embed], components: [row] });
        log('event', `${co.green}TICKET OPEN${co.reset} ${interaction.user.tag} created ${channelName} for ${reasonMap[selectedReason]}`);

        return interaction.reply({ content: `✅ Ticket created in ${ticketChannel.toString()}`, ephemeral: true });
      } catch (err) {
        log('error', `Ticket creation failed: ${err.message}`);
        return interaction.reply({ content: `❌ Failed to create ticket channel: ${err.message}`, ephemeral: true });
      }
    }
  }

  if (interaction.isButton()) {
    const { customId } = interaction;

    if (['setup_open_cat', 'setup_closed_cat', 'send_ticket_panel'].includes(customId)) {
      if (!isAuthorized(interaction.member)) {
        return interaction.reply({ content: '⛔ Not authorized.', ephemeral: true });
      }

      if (customId === 'setup_open_cat') {
        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('select_open_cat')
            .setPlaceholder('Select the category for OPEN tickets')
            .setChannelTypes(ChannelType.GuildCategory)
        );
        return interaction.reply({ content: 'Select the **Open** tickets category below:', components: [row], ephemeral: true });
      }

      if (customId === 'setup_closed_cat') {
        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('select_closed_cat')
            .setPlaceholder('Select the category for CLOSED tickets')
            .setChannelTypes(ChannelType.GuildCategory)
        );
        return interaction.reply({ content: 'Select the **Closed** tickets category below:', components: [row], ephemeral: true });
      }

      if (customId === 'send_ticket_panel') {
        const embed = makeEmbed({
          title: '⛑️ JewishDiscordBot Support Center',
          description: '> Welcome to the **JewishDiscordBot** support portal.\n> \n> Please use the dropdown below to select the category that best describes your inquiry. This helps us route your request to the appropriate team.\n\n`💡` *Average response time is < 24 hours.*',
          color: BRAND.colors.dark,
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('ticket_create_select')
          .setPlaceholder('Make a selection...')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('General Support')
              .setDescription('Assistance with rules, roles, or server help')
              .setValue('support')
              .setEmoji('🛡️'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Purchases & Billing')
              .setDescription('Inquiries regarding payments or upgrades')
              .setValue('purchase')
              .setEmoji('💳'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Channel Request')
              .setDescription('Request a private text or voice channel')
              .setValue('get_channel')
              .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
              .setLabel('User Report')
              .setDescription('Report a member for breaking the rules')
              .setValue('report')
              .setEmoji('⚠️')
          );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: '✅ Ticket panel sent to this channel.', ephemeral: true });
      }
    }

    // ── Ticket Operation Buttons ──

    if (customId === 'ticket_close') {
      await interaction.deferUpdate();

      const channel = interaction.channel;
      const closedParentId = config.closedCategoryId;

      const embed = makeEmbed({
        title: '🔒 Ticket Closed',
        description: `Ticket closed by **${interaction.user.tag}**.`,
        color: BRAND.colors.warning,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_transcript')
          .setLabel('Save Transcript')
          .setEmoji('📝')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ticket_delete')
          .setLabel('Delete Ticket')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger)
      );

      try {
        await channel.send({ embeds: [embed], components: [row] });

        for (const [memberId, overwrite] of channel.permissionOverwrites.cache) {
          const member = channel.guild.members.cache.get(memberId);
          if (member && !member.user.bot && !isAuthorized(member)) {
            await channel.permissionOverwrites.edit(memberId, { SendMessages: false });
          }
        }

        if (closedParentId && channel.guild.channels.cache.has(closedParentId)) {
          await channel.setParent(closedParentId, { lockPermissions: false });
        }
        await channel.setName(channel.name.replace('ticket', 'closed'));

        log('event', `${co.yellow}TICKET CLOSED${co.reset} by ${interaction.user.tag} in #${channel.name}`);
      } catch (err) {
        log('error', `Ticket closing failed: ${err.message}`);
      }
    }

    if (customId === 'ticket_delete') {
      if (!isAuthorized(interaction.member)) {
        return interaction.reply({ content: '⛔ Only staff can delete tickets.', ephemeral: true });
      }

      await interaction.reply({ content: '🗑️ Deleting ticket in 5 seconds...', ephemeral: false });
      setTimeout(() => {
        interaction.channel.delete().catch(() => { });
        log('event', `${co.red}TICKET DELETED${co.reset} by ${interaction.user.tag}`);
      }, 5000);
    }

    if (customId === 'ticket_transcript') {
      if (!isAuthorized(interaction.member)) {
        return interaction.reply({ content: '⛔ Only staff can generate transcripts.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: false });
      try {
        const channel = interaction.channel;
        const attachment = await discordTranscripts.createTranscript(channel, {
          limit: -1,
          returnType: 'attachment',
          filename: `${channel.name}-transcript.html`,
          saveImages: true,
          poweredBy: false,
          description: `Ticket transcript for ${channel.name}`
        });

        const logChannel = await getLogChannel(channel.guild);

        await interaction.editReply({ content: '✅ HTML Transcript generated.', files: [attachment] });

        // Also send to logs channel if configured
        if (logChannel) {
          logChannel.send({
            embeds: [makeEmbed({
              title: `🗃️ Ticket Transcript Generated`,
              description: `Generated from ${channel.toString()} by ${interaction.user.tag}`,
              color: BRAND.colors.info
            })],
            files: [attachment]
          }).catch(() => { });
        }
      } catch (err) {
        log('error', `Transcript failed: ${err.message}`);
        await interaction.editReply({ content: `❌ Failed to generate transcript: ${err.message}` });
      }
    }
  }
});



client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const prot = loadProtection();
  if (!prot.antiSpam.enabled) return;

  // Owner and root are exempt
  if (message.member && isAuthorized(message.member)) return;

  const userId = message.author.id;
  const now = Date.now();

  if (!spamTracker.has(userId)) spamTracker.set(userId, []);
  const timestamps = spamTracker.get(userId);
  timestamps.push(now);

  const filtered = timestamps.filter(t => now - t < prot.antiSpam.interval);
  spamTracker.set(userId, filtered);

  if (filtered.length >= prot.antiSpam.maxMessages) {
    spamTracker.delete(userId); // Reset tracker to avoid repeat actions

    log('event', `${co.red}🚫 ANTI-SPAM${co.reset} ${message.author.tag} — ${filtered.length} msgs in ${prot.antiSpam.interval / 1000}s`);

    try {
      // Delete the spam messages
      const recentMessages = await message.channel.messages.fetch({ limit: prot.antiSpam.maxMessages + 5 });
      const spamMessages = recentMessages.filter(m => m.author.id === userId);
      await message.channel.bulkDelete(spamMessages, true).catch(() => { });

      // Timeout the user
      if (message.member?.moderatable) {
        await message.member.timeout(prot.antiSpam.timeoutDuration, 'Anti-Spam: Message flooding');
      }

      const channel = message.guild.systemChannel || message.channel;
      channel.send({
        embeds: [makeEmbed({
          title: '🚫 Anti-Spam Triggered',
          description: `**${message.author.tag}** has been timed out for spam.`,
          color: BRAND.colors.danger,
          fields: [
            { name: '👤 User', value: `${message.author.tag}`, inline: true },
            { name: '⏳ Duration', value: `\`${formatDuration(prot.antiSpam.timeoutDuration)}\``, inline: true },
            { name: '📝 Reason', value: `${filtered.length} messages in ${prot.antiSpam.interval / 1000}s`, inline: true },
          ],
        })]
      });
    } catch (err) {
      log('error', `Anti-spam action failed: ${err.message}`);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const prot = loadProtection();
  if (!prot.antiLink.enabled) return;

  // Owner and root are exempt
  if (message.member && isAuthorized(message.member)) return;

  const linkRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/\S+|(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|edu|gov|mil|biz|info|mobi|name|aero|asia|jobs|museum|gg|io|me|tv|xyz|link|top|pw|club|online|site|store|tech|website|space|fun|host|press|live|icu|vip|work|tk|ml|ga|cf|gq)(?:\/\S*)?/gi;
  if (linkRegex.test(message.content)) {
    // Check whitelist
    const isWhitelisted = prot.antiLink.whitelist?.some(domain => message.content.includes(domain));
    if (isWhitelisted) return;

    log('event', `${co.red}🔗 ANTI-LINK${co.reset} ${message.author.tag} sent a link in #${message.channel.name}`);

    try {
      await message.delete();
      const warn = await message.channel.send({
        embeds: [makeEmbed({
          title: '🔗 Link Removed',
          description: `**${message.author.tag}**, links are not allowed in this server.`,
          color: BRAND.colors.warning,
        })]
      });

      setTimeout(() => warn.delete().catch(() => { }), 5000);
    } catch (err) {
      log('error', `Anti-link action failed: ${err.message}`);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;
  const prot = loadProtection();
  if (!prot.rateLimit.enabled) return;

  if (message.member && isAuthorized(message.member)) return;

  const userId = message.author.id;
  const now = Date.now();
  const lastUsed = cooldownTracker.get(userId) || 0;

  if (now - lastUsed < prot.rateLimit.cooldown) {
    const remaining = Math.ceil((prot.rateLimit.cooldown - (now - lastUsed)) / 1000);
    try {
      const warn = await message.reply({
        embeds: [makeEmbed({
          title: '⏱️ Slow Down!',
          description: `Please wait **${remaining}s** before using another command.`,
          color: BRAND.colors.warning,
        })]
      });
      setTimeout(() => warn.delete().catch(() => { }), 3000);
    } catch { }
    return;
  }

  cooldownTracker.set(userId, now);
});



client.on('guildMemberAdd', (member) => {
  const blacklist = loadBlacklist();
  const entry = blacklist.find(e => e.userId === member.id);

  if (entry) {
    log('event', `${co.red}BLACKLIST AUTO-KICK${co.reset} ${member.user.tag} joined ${member.guild.name}`);

    member.kick(`Blacklisted: ${entry.reason}`)
      .then(() => {
        const channel = member.guild.systemChannel;
        if (channel) {
          channel.send({
            embeds: [makeEmbed({
              title: '🚫 Blacklisted User Auto-Kicked',
              description: `**${member.user.tag}** attempted to join but is blacklisted.`,
              color: BRAND.colors.danger,
              thumbnail: member.user.displayAvatarURL({ size: 128 }),
              fields: [
                { name: '👤 User', value: `${member.user.tag}`, inline: true },
                { name: '📝 Reason', value: entry.reason, inline: true },
                { name: '👮 By', value: entry.blacklistedBy, inline: true },
              ],
            })]
          });
        }
      })
      .catch(err => log('error', `Auto-kick failed: ${err.message}`));
  }

  const prot = loadProtection();
  if (!prot.antiRaid.enabled) return;

  const now = Date.now();
  joinTracker.push({ userId: member.id, tag: member.user.tag, timestamp: now });


  while (joinTracker.length > 0 && now - joinTracker[0].timestamp > prot.antiRaid.interval) {
    joinTracker.shift();
  }

  if (joinTracker.length >= prot.antiRaid.maxJoins) {
    log('event', `${co.red}${co.bold}⚔️ RAID DETECTED${co.reset} ${joinTracker.length} joins in ${prot.antiRaid.interval / 1000}s in ${member.guild.name}`);

    const channel = member.guild.systemChannel;
    if (channel) {
      const joinList = joinTracker.map(j => `• **${j.tag}**`).join('\n');
      channel.send({
        embeds: [makeEmbed({
          title: '⚔️ Raid Detected!',
          description: `**${joinTracker.length} users** joined in under **${prot.antiRaid.interval / 1000} seconds**.\n\n${joinList}`,
          color: BRAND.colors.danger,
          fields: [
            { name: '⚠️ Action Required', value: 'Consider enabling verification level or locking down the server.', inline: false },
          ],
        })]
      });
    }


    joinTracker.length = 0;

    // Auto-lock server during raid
    if (prot.antiRaid.lockServer) {
      log('event', `${co.red}LOCKDOWN${co.reset} Attempting to lock @everyone permissions due to raid`);
      const everyone_role = member.guild.roles.everyone;
      everyone_role.setPermissions(everyone_role.permissions.remove(PermissionFlagsBits.SendMessages))
        .then(() => log('success', `Locked @everyone permissions`))
        .catch(err => log('error', `Failed to lock @everyone: ${err.message}`));
    }
  }
});

client.on('channelDelete', async (channel) => {
  const prot = loadProtection();
  if (!prot.antiNuke.enabled || !channel.guild) return;

  try {
    const auditLogs = await channel.guild.fetchAuditLogs({ type: 12, limit: 1 });
    const log_entry = auditLogs.entries.first();
    if (!log_entry) return;

    const executor = log_entry.executor;
    if (executor.username.toLowerCase() === OWNER_USERNAME.toLowerCase()) return;

    const executorId = executor.id;
    const now = Date.now();

    if (!nukeTracker.has(executorId)) nukeTracker.set(executorId, []);
    const actions = nukeTracker.get(executorId);
    actions.push({ action: 'channelDelete', timestamp: now });

    const recent = actions.filter(a => now - a.timestamp < prot.antiNuke.interval);
    nukeTracker.set(executorId, recent);

    if (recent.length >= prot.antiNuke.maxActions) {
      log('event', `${co.red}${co.bold}💣 NUKE DETECTED${co.reset} ${executor.tag} deleted ${recent.length} channels rapidl`);
      nukeTracker.delete(executorId);


      const member = await channel.guild.members.fetch(executorId).catch(() => null);
      if (member && member.manageable) {
        const roles = member.roles.cache.filter(r => r.id !== channel.guild.id);
        await member.roles.remove(roles, 'Anti-Nuke: Mass channel deletion detected').catch(() => { });
        log('mod', `${co.red}ANTI-NUKE${co.reset} Stripped all roles from ${executor.tag}`);
      }

      const alertChannel = channel.guild.systemChannel || channel.guild.channels.cache.filter(c => c.type === 0).first();
      if (alertChannel) {
        alertChannel.send({
          embeds: [makeEmbed({
            title: '💣 Nuke Attempt Detected!',
            description: `**${executor.tag}** deleted **${recent.length} channels** rapidly. Their roles have been stripped.`,
            color: BRAND.colors.danger,
            fields: [
              { name: '👤 Offender', value: `${executor.tag}`, inline: true },
              { name: '🛡️ Action Taken', value: 'All roles removed', inline: true },
            ],
          })]
        });
      }
    }
  } catch (err) {
    log('error', `Anti-nuke channel check failed: ${err.message}`);
  }
});

client.on('roleDelete', async (role) => {
  const prot = loadProtection();
  if (!prot.antiNuke.enabled || !role.guild) return;

  try {
    const auditLogs = await role.guild.fetchAuditLogs({ type: 32, limit: 1 });
    const log_entry = auditLogs.entries.first();
    if (!log_entry) return;

    const executor = log_entry.executor;
    if (executor.bot && executor.id === client.user.id) return;
    if (executor.username.toLowerCase() === OWNER_USERNAME.toLowerCase()) return;

    const executorId = executor.id;
    const now = Date.now();

    if (!nukeTracker.has(executorId)) nukeTracker.set(executorId, []);
    const actions = nukeTracker.get(executorId);
    actions.push({ action: 'roleDelete', timestamp: now });

    const recent = actions.filter(a => now - a.timestamp < prot.antiNuke.interval);
    nukeTracker.set(executorId, recent);

    if (recent.length >= prot.antiNuke.maxActions) {
      log('event', `${co.red}${co.bold}💣 NUKE DETECTED${co.reset} ${executor.tag} deleted ${recent.length} roles rapidly`);
      nukeTracker.delete(executorId);

      const member = await role.guild.members.fetch(executorId).catch(() => null);
      if (member && member.manageable) {
        const roles = member.roles.cache.filter(r => r.id !== role.guild.id);
        await member.roles.remove(roles, 'Anti-Nuke: Mass role deletion detected').catch(() => { });
        log('mod', `${co.red}ANTI-NUKE${co.reset} Stripped all roles from ${executor.tag}`);
      }

      const alertChannel = role.guild.systemChannel || role.guild.channels.cache.filter(c => c.type === 0).first();
      if (alertChannel) {
        alertChannel.send({
          embeds: [makeEmbed({
            title: '💣 Nuke Attempt Detected!',
            description: `**${executor.tag}** deleted **${recent.length} roles** rapidly. Their roles have been stripped.`,
            color: BRAND.colors.danger,
            fields: [
              { name: '👤 Offender', value: `${executor.tag}`, inline: true },
              { name: '🛡️ Action Taken', value: 'All roles removed', inline: true },
            ],
          })]
        });
      }
    }
  } catch (err) {
    log('error', `Anti-nuke role check failed: ${err.message}`);
  }
});

client.on('guildBanAdd', async (ban) => {
  const prot = loadProtection();
  if (!prot.antiNuke.enabled) return;
  try {
    const auditLogs = await ban.guild.fetchAuditLogs({ type: 22, limit: 1 });
    const log_entry = auditLogs.entries.first();
    if (!log_entry) return;

    const executor = log_entry.executor;
    if (executor.bot && executor.id === client.user.id) return;
    if (executor.username.toLowerCase() === OWNER_USERNAME.toLowerCase()) return;

    const executorId = executor.id;
    const now = Date.now();
    if (!nukeTracker.has(executorId)) nukeTracker.set(executorId, []);
    const actions = nukeTracker.get(executorId);
    actions.push({ action: 'ban', timestamp: now });

    const recent = actions.filter(a => now - a.timestamp < prot.antiNuke.interval);
    nukeTracker.set(executorId, recent);

    if (recent.length >= prot.antiNuke.maxBans) {
      log('event', `${co.red}${co.bold}💣 NUKE DETECTED${co.reset} ${executor.tag} Banned ${recent.length} members rapidly`);
      nukeTracker.delete(executorId);
      const member = await ban.guild.members.fetch(executorId).catch(() => null);
      if (member && member.manageable) await member.roles.set([], 'Anti-Nuke: Mass ban detected').catch(() => { });
      const alertChannel = ban.guild.systemChannel || ban.guild.channels.cache.filter(c => c.type === 0).first();
      if (alertChannel) {
        alertChannel.send({
          embeds: [makeEmbed({
            title: '💣 Nuke Attempt — Mass Ban',
            description: `**${executor.tag}** banned **${recent.length} members**. All roles removed.`,
            color: BRAND.colors.danger
          })]
        });
      }
    }
  } catch (err) { }
});

client.on('guildMemberRemove', async (member) => {
  const prot = loadProtection();
  if (!prot.antiNuke.enabled) return;
  try {
    const auditLogs = await member.guild.fetchAuditLogs({ type: 20, limit: 1 });
    const log_entry = auditLogs.entries.first();
    if (!log_entry || Date.now() - log_entry.createdTimestamp > 5000) return;

    const executor = log_entry.executor;
    if (executor.bot && executor.id === client.user.id) return;
    if (executor.username.toLowerCase() === OWNER_USERNAME.toLowerCase()) return;

    const executorId = executor.id;
    const now = Date.now();
    if (!nukeTracker.has(executorId)) nukeTracker.set(executorId, []);
    const actions = nukeTracker.get(executorId);
    actions.push({ action: 'kick', timestamp: now });

    const recent = actions.filter(a => now - a.timestamp < prot.antiNuke.interval);
    nukeTracker.set(executorId, recent);

    if (recent.length >= prot.antiNuke.maxKicks) {
      log('event', `${co.red}${co.bold}💣 NUKE DETECTED${co.reset} ${executor.tag} Kicked ${recent.length} members rapidly`);
      nukeTracker.delete(executorId);
      const off = await member.guild.members.fetch(executorId).catch(() => null);
      if (off && off.manageable) await off.roles.set([], 'Anti-Nuke: Mass kick detected').catch(() => { });
      const alertChannel = member.guild.systemChannel || member.guild.channels.cache.filter(c => c.type === 0).first();
      if (alertChannel) {
        alertChannel.send({
          embeds: [makeEmbed({
            title: '💣 Nuke Attempt — Mass Kick',
            description: `**${executor.tag}** kicked **${recent.length} members**. All roles removed.`,
            color: BRAND.colors.danger
          })]
        });
      }
    }
  } catch (err) { }
});

setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of spamTracker) {
    const filtered = timestamps.filter(t => now - t < 30_000);
    if (filtered.length === 0) spamTracker.delete(userId);
    else spamTracker.set(userId, filtered);
  }
  for (const [userId, actions] of nukeTracker) {
    const filtered = actions.filter(a => now - a.timestamp < 30_000);
    if (filtered.length === 0) nukeTracker.delete(userId);
    else nukeTracker.set(userId, filtered);
  }
}, 60_000);



client.on('messageDelete', async (message) => {
  if (message.author?.bot || !message.guild) return;
  const logChannel = await getLogChannel(message.guild);
  if (!logChannel) return;

  log('event', `${co.magenta}MESSAGE DELETE${co.reset} ${message.author.tag} in #${message.channel.name}`);
  logChannel.send({
    embeds: [makeEmbed({
      title: '🗑️ Message Deleted',
      description: `A message from **${message.author.tag}** was deleted in <#${message.channel.id}>.`,
      color: BRAND.colors.danger,
      fields: [
        { name: '👤 Author', value: `${message.author.tag} (${message.author.id})`, inline: true },
        { name: '💬 Content', value: message.content ? `\`\`\`\n${message.content.length > 1000 ? message.content.slice(0, 1000) + '...' : message.content}\n\`\`\`` : '*No text content (embed/attachment)*', inline: false },
      ],
    })]
  }).catch(() => { });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot || !oldMessage.guild) return;
  if (oldMessage.content === newMessage.content) return;

  const logChannel = await getLogChannel(oldMessage.guild);
  if (!logChannel) return;

  log('event', `${co.magenta}MESSAGE EDIT${co.reset} ${oldMessage.author.tag} in #${oldMessage.channel.name}`);
  logChannel.send({
    embeds: [makeEmbed({
      title: '📝 Message Edited',
      description: `**${oldMessage.author.tag}** edited their message in <#${oldMessage.channel.id}>.`,
      color: BRAND.colors.warning,
      fields: [
        { name: '⬅️ Before', value: oldMessage.content ? `\`\`\`\n${oldMessage.content.length > 500 ? oldMessage.content.slice(0, 500) + '...' : oldMessage.content}\n\`\`\`` : '*No content*', inline: false },
        { name: '➡️ After', value: newMessage.content ? `\`\`\`\n${newMessage.content.length > 500 ? newMessage.content.slice(0, 500) + '...' : newMessage.content}\n\`\`\`` : '*No content*', inline: false },
        { name: '🔗 Link', value: `[Jump to message](${newMessage.url})`, inline: false },
      ],
    })]
  }).catch(() => { });
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const logChannel = await getLogChannel(newState.guild || oldState.guild);
  if (!logChannel) return;

  const member = newState.member;
  if (member?.user?.bot) return;

  if (!oldState.channelId && newState.channelId) {

    logChannel.send({
      embeds: [makeEmbed({
        title: '🎙️ Voice Join',
        description: `**${member.user.tag}** joined voice channel <#${newState.channelId}>.`,
        color: BRAND.colors.success,
      })]
    }).catch(() => { });
  } else if (oldState.channelId && !newState.channelId) {

    logChannel.send({
      embeds: [makeEmbed({
        title: '🚪 Voice Leave',
        description: `**${member.user.tag}** left voice channel <#${oldState.channelId}>.`,
        color: BRAND.colors.danger,
      })]
    }).catch(() => { });
  } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {

    logChannel.send({
      embeds: [makeEmbed({
        title: '🔄 Voice Move',
        description: `**${member.user.tag}** moved from <#${oldState.channelId}> to <#${newState.channelId}>.`,
        color: BRAND.colors.info,
      })]
    }).catch(() => { });
  }
});

client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;
  const config = loadAutoRole();
  if (config.roleId) {
    const role = member.guild.roles.cache.get(config.roleId);
    if (role) {
      member.roles.add(role).catch(err => log('error', `Failed to assign autorole: ${err.message}`));
      log('event', `${co.blue}AUTO-ROLE${co.reset} Assigned ${role.name} to ${member.user.tag}`);
    }
  }
});

client.login(process.env.BOT_TOKEN);
