const fs = require('node:fs');
const path = require('node:path');

const LOG_FILE = process.env.LOG_FILE || path.join(process.cwd(), 'agent.log');

function getTime() {
  return new Date().toISOString().split('T')[1].replace('Z', '');
}

function writeToFile(line) {
  try {
    fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
  } catch {
  }
}

function formatArgs(args) {
  return args.map((item) => {
    if (item instanceof Error) {
      return `${item.message}${item.stack ? `\n${item.stack}` : ''}`;
    }
    if (typeof item === 'object' && item !== null) {
      try {
        return JSON.stringify(item, null, 2);
      } catch {
        return String(item);
      }
    }
    return String(item);
  });
}

function emit(consoleFn, prefix, ...args) {
  const timestamp = getTime();
  const formatted = formatArgs(args);
  consoleFn(`${prefix} [${timestamp}]`, ...formatted);
  writeToFile(`${prefix} [${timestamp}] ${formatted.join(' ')}`);
}

const Logger = {
  log: (...args) => emit(console.log, '[LOG]', ...args),
  info: (...args) => emit(console.info, 'ℹ️ [INFO]', ...args),
  warn: (...args) => emit(console.warn, '⚠️ [WARN]', ...args),
  error: (...args) => emit(console.error, '❌ [ERROR]', ...args),
  tool: (toolName, toolArgs) => {
    let serializedArgs = '{}';
    try {
      serializedArgs = JSON.stringify(toolArgs ?? {});
    } catch {
      serializedArgs = String(toolArgs);
    }
    emit(console.log, '[TOOL]', `Executing: ${toolName} | args: ${serializedArgs}`);
  },
};

module.exports = Logger;
