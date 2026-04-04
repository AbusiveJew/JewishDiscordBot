const fs = require('fs');
const { paths, DEFAULT_PROTECTION, DEFAULT_TICKETS } = require('./config');

const DEFAULT_LOGS = { channelId: null };
const DEFAULT_AUTOROLE = { roleId: null };

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadBlacklist() {
  return readJson(paths.blacklist, []);
}

function saveBlacklist(list) {
  writeJson(paths.blacklist, list);
}

function loadProtection() {
  const data = readJson(paths.protection, null);
  if (!data) return { ...DEFAULT_PROTECTION };
  return { ...DEFAULT_PROTECTION, ...data };
}

function saveProtection(config) {
  writeJson(paths.protection, config);
}

function loadTickets() {
  const data = readJson(paths.tickets, null);
  if (!data) return { ...DEFAULT_TICKETS };
  return { ...DEFAULT_TICKETS, ...data };
}

function saveTickets(config) {
  writeJson(paths.tickets, config);
}

function loadLogs() {
  const data = readJson(paths.logs, null);
  if (!data) return { ...DEFAULT_LOGS };
  return { ...DEFAULT_LOGS, ...data };
}

function saveLogs(config) {
  writeJson(paths.logs, config);
}

function loadAutoRole() {
  const data = readJson(paths.autorole, null);
  if (!data) return { ...DEFAULT_AUTOROLE };
  return { ...DEFAULT_AUTOROLE, ...data };
}

function saveAutoRole(config) {
  writeJson(paths.autorole, config);
}

module.exports = {
  BRAND,
  loadBlacklist,
  saveBlacklist,
  loadProtection,
  saveProtection,
  loadTickets,
  saveTickets,
  loadLogs,
  saveLogs,
  loadAutoRole,
  saveAutoRole,
};
