require('dotenv').config();
const path = require('path');

const PREFIX = process.env.PREFIX || '$';
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'owner';
const AUTHORIZED_USERNAMES = (process.env.AUTHORIZED_USERNAMES || '')
  .split(',')
  .map((s) => s.trim().replace(/^@/, '').toLowerCase())
  .filter(Boolean);

const ROOT_ROLE_NAME = 'root';

const BRAND = {
  name: 'JewishDiscordBot',
  footer: '⚡ JewishDiscordBot',
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
  antiSpam: {
    enabled: true,
    maxMessages: 5,
    interval: 3000,
    action: 'timeout',
    timeoutDuration: 60000,
  },
  antiRaid: { enabled: true, maxJoins: 8, interval: 10000, lockServer: false },
  antiNuke: {
    enabled: true,
    maxActions: 3,
    interval: 10000,
    maxBans: 5,
    maxKicks: 5,
  },
  antiLink: { enabled: false, whitelist: [], action: 'delete' },
  rateLimit: { enabled: true, cooldown: 2000 },
};

const DEFAULT_TICKETS = { openCategoryId: null, closedCategoryId: null, ticketCount: 0 };

const TICKET_TYPE_SLUG = {
  support: 'support',
  purchase: 'purchase',
  get_channel: 'get-channel',
  report: 'report',
};

const TICKET_REASON_LABELS = {
  support: 'General Support',
  purchase: 'Purchases & Billing',
  get_channel: 'Channel Request',
  report: 'User Report',
};

const paths = {
  blacklist: path.join(__dirname, '..', 'blacklist.json'),
  protection: path.join(__dirname, '..', 'protection.json'),
  tickets: path.join(__dirname, '..', 'tickets_config.json'),
  logs: path.join(__dirname, '..', 'logs_config.json'),
  autorole: path.join(__dirname, '..', 'autorole.json'),
};

module.exports = {
  PREFIX,
  OWNER_USERNAME,
  AUTHORIZED_USERNAMES,
  ROOT_ROLE_NAME,
  BRAND,
  DEFAULT_PROTECTION,
  DEFAULT_TICKETS,
  TICKET_TYPE_SLUG,
  TICKET_REASON_LABELS,
  paths,
};
