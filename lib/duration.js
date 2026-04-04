function parseDuration(args) {
  const amount = parseInt(args[0], 10);
  if (isNaN(amount) || amount <= 0) return null;

  const unit = (args[1] || 'min').toLowerCase();
  const multipliers = {
    sec: 1000,
    secs: 1000,
    second: 1000,
    seconds: 1000,
    s: 1000,
    min: 60_000,
    mins: 60_000,
    minute: 60_000,
    minutes: 60_000,
    m: 60_000,
    hour: 3_600_000,
    hours: 3_600_000,
    hr: 3_600_000,
    hrs: 3_600_000,
    h: 3_600_000,
    day: 86_400_000,
    days: 86_400_000,
    d: 86_400_000,
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

module.exports = { parseDuration, formatDuration };
