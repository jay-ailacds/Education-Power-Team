type LogLevel = "debug" | "info" | "warn" | "error";

const COLORS = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
};

let currentLevel: LogLevel = "info";
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function log(level: LogLevel, prefix: string, msg: string, ...args: unknown[]) {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const ts = new Date().toISOString().slice(11, 19);
  const color = COLORS[level];
  console.log(`${COLORS.dim}${ts}${COLORS.reset} ${color}${prefix}${COLORS.reset} ${msg}`, ...args);
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log("debug", "DBG", msg, ...args),
  info: (msg: string, ...args: unknown[]) => log("info", "INF", msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log("warn", "WRN", msg, ...args),
  error: (msg: string, ...args: unknown[]) => log("error", "ERR", msg, ...args),

  step: (name: string, msg: string) => {
    console.log(`\n${COLORS.bold}${COLORS.green}[${name}]${COLORS.reset} ${msg}`);
  },

  progress: (current: number, total: number, label: string) => {
    const pct = Math.round((current / total) * 100);
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
    process.stdout.write(`\r  ${bar} ${pct}% ${label}`);
    if (current === total) process.stdout.write("\n");
  },
};
