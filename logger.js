
function getTime() {

  return new Date().toISOString().split('T')[1].replace('Z', '');
}

const Logger = {
  log: (...args) => {
    console.log(`[LOG] [${getTime()}]`, ...args);
  },


  info: (...args) => {
    console.info(`ℹ️ [INFO] [${getTime()}]`, ...args);
  },


  warn: (...args) => {
    console.warn(`⚠️ [WARN] [${getTime()}]`, ...args);
  },


  error: (...args) => {
    console.error(`❌ [ERROR] [${getTime()}]`, ...args);
  },


  tool: (toolName, args) => {
    console.log(`[TOOL] [${getTime()}] Executing: ${toolName}`, ...args)
  }
};



module.exports = Logger;
