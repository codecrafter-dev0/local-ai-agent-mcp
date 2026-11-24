const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
  StreamableHTTPClientTransport,
} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const Logger = require('./logger.js');

const SERVER_URL = process.env.MCP_SERVER_URL || 'https://learn.microsoft.com/api/mcp';

let client = null;
let connected = false;

function normalizeToolArgs(rawArgs) {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'object') return rawArgs;
  if (typeof rawArgs === 'string') {
    const trimmed = rawArgs.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      Logger.warn('Failed to parse MCP tool arguments JSON, passing raw string:', err.message);
      return { raw: rawArgs };
    }
  }
  return {};
}

async function connectMicrosoftLearn() {
  try {
    if (connected && client) {
      const existingList = await client.listTools();
      return existingList?.tools || [];
    }

    Logger.info('Connecting to Microsoft Learn MCP...', SERVER_URL);

    const newClient = new Client({
      name: 'my-ai-agent',
      version: '0.2.0',
    });

    const transport = new StreamableHTTPClientTransport(new URL(SERVER_URL));

    await newClient.connect(transport);

    client = newClient;
    connected = true;

    Logger.info('Microsoft Learn MCP connected');

    const response = await client.listTools();
    const toolsList = Array.isArray(response?.tools) ? response.tools : [];

    Logger.info(
      'Microsoft Learn tools discovered:',
      toolsList.map((tool) => tool.name)
    );

    return toolsList;
  } catch (error) {
    connected = false;
    client = null;
    Logger.error('Microsoft Learn MCP connection failed:', error);
    return [];
  }
}

async function callMicrosoftTool(name, args = {}) {
  if (!name || typeof name !== 'string') {
    const err = new Error('Invalid MCP tool name provided');
    Logger.error('Microsoft MCP tool call aborted:', err);
    throw err;
  }

  if (!connected || !client) {
    Logger.warn('MCP client not connected; attempting reconnect before tool call...');
    await connectMicrosoftLearn();
  }

  if (!connected || !client) {
    const err = new Error('Microsoft Learn MCP is not connected');
    Logger.error('Microsoft MCP tool failed:', err);
    throw err;
  }

  const cleanArgs = normalizeToolArgs(args);
  Logger.tool(name, cleanArgs);

  const startTime = Date.now();

  try {
    const result = await client.callTool({
      name,
      arguments: cleanArgs,
    });

    Logger.info('Microsoft MCP tool completed:', {
      name,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    Logger.error('Microsoft MCP tool failed:', {
      name,
      durationMs: Date.now() - startTime,
      error: error.message || String(error),
    });
    throw error;
  }
}

async function disconnectMicrosoftLearn() {
  if (!client) {
    connected = false;
    return;
  }

  try {
    await client.close();
    Logger.info('Microsoft Learn MCP disconnected');
  } catch (error) {
    Logger.error('Error while disconnecting Microsoft Learn MCP:', error);
  } finally {
    client = null;
    connected = false;
  }
}

module.exports = {
  connectMicrosoftLearn,
  callMicrosoftTool,
  disconnectMicrosoftLearn,
};
