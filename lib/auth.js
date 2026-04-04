const { OWNER_USERNAME, AUTHORIZED_USERNAMES, ROOT_ROLE_NAME } = require('./config');

function hasRootRole(member) {
  if (!member?.roles?.cache) return false;
  return member.roles.cache.some((r) => r.name.toLowerCase() === ROOT_ROLE_NAME);
}

/** Owner username, authorized list, or a role named `root` (case-insensitive). */
function isAuthorized(member) {
  if (!member?.user) return false;
  const u = member.user.username.toLowerCase();
  if (u === OWNER_USERNAME.toLowerCase()) return true;
  if (AUTHORIZED_USERNAMES.includes(u)) return true;
  return hasRootRole(member);
}

module.exports = { isAuthorized, hasRootRole };
