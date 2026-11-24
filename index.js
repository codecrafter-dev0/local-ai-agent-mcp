require('dotenv').config();
const OpenAI = require('openai');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const fs = require('node:fs');

const Logger = require('./logger.js');
const {
  connectMicrosoftLearn,
  callMicrosoftTool,
  disconnectMicrosoftLearn,
} = require('./mcp.js');

const SYSTEM_PROMPT =
  'Do not include any reasoning, chain-of-thought, or <think> tags. ' +
  'Return ONLY tool calls when appropriate, or the direct final response without extra explanation.';

process.on('uncaughtException', (err) => {
  Logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled Promise Rejection:', reason);
});

function stripReasoningTags(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .trim();
}

function schemaMake(mcpTools = []) {
  if (!Array.isArray(mcpTools)) return [];
  return mcpTools
    .filter((t) => t && typeof t.name === 'string')
    .map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || `Microsoft Learn tool: ${t.name}`,
        parameters: t.inputSchema || { type: 'object', properties: {} },
      },
    }));
}

function parseArguments(rawArgs) {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'object') return rawArgs;
  if (typeof rawArgs === 'string') {
    const trimmed = rawArgs.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      Logger.warn('Failed to parse tool call arguments JSON:', err.message);
      return { _raw: rawArgs };
    }
  }
  return {};
}

function createOpenAIClient() {
  if (!process.env.BASE_URL) {
    Logger.warn('BASE_URL is not set in .env; falling back to default OpenAI SDK endpoint.');
  }
  if (!process.env.MODEL) {
    Logger.warn('MODEL is not set in .env; API call may fail if model is required.');
  }

  return new OpenAI({
    baseURL: process.env.BASE_URL,
    apiKey: process.env.KEY || 'not-needed',
  });
}

const openai = createOpenAIClient();
const MODEL = process.env.MODEL;

const msg = [{ role: 'system', content: SYSTEM_PROMPT }];
const rl = readline.createInterface({ input, output });

function saveConversationSnapshot() {
  try {
    fs.writeFileSync('./prompt.txt', JSON.stringify(msg, null, 2), 'utf8');
  } catch (err) {
    Logger.error('Failed to save ./prompt.txt:', err);
  }
}

async function executeTool(name, rawArgs) {
  const parsedArgs = parseArguments(rawArgs);
  
  return await callMicrosoftTool(name, parsedArgs);
}

async function toolsCall(assistantMessage, tools) {
  const toolCalls = Array.isArray(assistantMessage?.tool_calls)
    ? assistantMessage.tool_calls
    : [];

  for (const call of toolCalls) {
    const fnName = call?.function?.name;
    const rawArgs = call?.function?.arguments;
    const parsedArgs = parseArguments(rawArgs);

    Logger.info(`Chosen tool: ${fnName}`, parsedArgs);

    try {
      const result = await executeTool(fnName, parsedArgs);
      const resContent = JSON.stringify(
        result?.content ?? result ?? { ok: true },
        null,
        2
      );

      msg.push({
        role: 'tool',
        tool_call_id: call.id,
        content: resContent,
      });
    } catch (err) {
      Logger.error(`Tool execution failed (${fnName}):`, err);
      msg.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify({ error: err?.message || String(err) }),
      });
    }
  }

  saveConversationSnapshot();
  await run(msg, tools);
}

async function run(messages, tools) {
  try {
    const requestPayload = {
      model: MODEL,
      messages,
    };

    if (Array.isArray(tools) && tools.length > 0) {
      requestPayload.tools = tools;
      requestPayload.tool_choice = 'auto';
    }

    const completion = await openai.chat.completions.create(requestPayload);
    const assistantMsg = completion?.choices?.[0]?.message;

    if (!assistantMsg) {
      Logger.warn('Empty assistant message received from model.');
      console.log('\nAI: (empty response)\n');
      return;
    }

    if (Array.isArray(assistantMsg.tool_calls) && assistantMsg.tool_calls.length > 0) {
      msg.push({
        role: 'assistant',
        content: assistantMsg.content ? stripReasoningTags(assistantMsg.content) : null,
        tool_calls: assistantMsg.tool_calls,
      });
      saveConversationSnapshot();
      await toolsCall(assistantMsg, tools);
    } else {
      const cleanReply = stripReasoningTags(assistantMsg.content ?? '');
      msg.push({ role: 'assistant', content: cleanReply });
      saveConversationSnapshot();
      console.log(`\nAI: ${cleanReply}\n`);
    }
  } catch (error) {
    Logger.error('Error communicating with AI:', error);
    console.error('\nError communicating with AI:', error?.message || String(error), '\n');
  }
}

async function getUserInput(tools = []) {
  while (true) {
    let prompt = '';
    try {
      prompt = await rl.question('Enter your prompt:> ');
    } catch (err) {
      Logger.error('Readline input error:', err);
      break;
    }

    const normalized = prompt.trim();
    if (!normalized || normalized.toLowerCase() === 'q') {
      await disconnectMicrosoftLearn();
      rl.close();
      Logger.info('Program exited cleanly.');
      console.log('\nprogram exit !!');
      break;
    }

    console.log('wait...');
    msg.push({ role: 'user', content: normalized });
    saveConversationSnapshot();

    await run(msg, tools);
  }
}

async function start() {
  Logger.info('Starting local AI agent...');
  let mcpTools = [];

  try {
    mcpTools = await connectMicrosoftLearn();
  } catch (err) {
    Logger.error('Unexpected error during MCP startup:', err);
  }

  const tools = schemaMake(mcpTools);
  Logger.info(`Loaded ${tools.length} tool schema(s).`);

  await getUserInput(tools);
}

start().catch((err) => {
  Logger.error('Fatal startup error:', err);
});
