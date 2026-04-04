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

const labels = {
  info: `${co.cyan}ℹ INFO ${co.reset}`,
  success: `${co.green}✓ OK   ${co.reset}`,
  warn: `${co.yellow}⚠ WARN ${co.reset}`,
  error: `${co.red}✗ ERR  ${co.reset}`,
  mod: `${co.magenta}⚔ MOD  ${co.reset}`,
  event: `${co.blue}★ EVT  ${co.reset}`,
  img: `${co.yellow}🖼 IMG  ${co.reset}`,
};

function log(type, message) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const prefix = `${co.dim}${time}${co.reset}`;
  console.log(`  ${prefix}  ${labels[type] || labels.info}  ${message}`);
}

module.exports = { log, co };
