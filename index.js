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

function schemaMake(mcpTools = []) {
  if (!Array.isArray(mcpTools)) return [];
  return mcpTools.map((t) => ({
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
  try {
    return JSON.parse(rawArgs);
  } catch {
    return { _raw: rawArgs };
  }
}

const openai = new OpenAI({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.KEY || 'not-needed',
});

const MODEL = process.env.MODEL;

const msg = [{ role: 'system', content: SYSTEM_PROMPT }];
const rl = readline.createInterface({ input, output });

async function executeTool(name, rawArgs) {
  const parsedArgs = parseArguments(rawArgs);
  return await callMicrosoftTool({ name, arguments: parsedArgs });
}

async function toolsCall(assistantMessage, tools) {
  for (const call of assistantMessage.tool_calls) {
    const fnName = call.function?.name;
    const rawArgs = call.function?.arguments;
    const parsedArgs = parseArguments(rawArgs);

    console.log('---------------------------------------------');
    console.log(`Tool name : ${fnName} | arguments : ${JSON.stringify(parsedArgs)}`);
    console.log('---------------------------------------------');

    try {
      const result = await executeTool(fnName, parsedArgs);
      const resContent = JSON.stringify(result?.content ?? result ?? { ok: true }, null, 2);

      msg.push({
        role: 'tool',
        tool_call_id: call.id,
        content: resContent,
      });
    } catch (err) {
      console.error(`Tool execution failed (${fnName}):`, err.message || err);
      msg.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify({ error: err.message || String(err) }),
      });
    }
  }

  await run(msg, tools);
}

async function run(messages, tools) {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
    });

    const assistantMsg = completion.choices?.[0]?.message;
    if (!assistantMsg) {
      console.log('\nAI: (empty response)\n');
      return;
    }

    if (Array.isArray(assistantMsg.tool_calls) && assistantMsg.tool_calls.length > 0) {
      msg.push({
        role: 'assistant',
        content: assistantMsg.content ?? null,
        tool_calls: assistantMsg.tool_calls,
      });
      await toolsCall(assistantMsg, tools);
    } else {
      const reply = assistantMsg.content ?? '';
      msg.push({ role: 'assistant', content: reply });
      console.log(`\nAI: ${reply}\n`);
    }
  } catch (error) {
    console.error('\nError communicating with AI:', error.message, '\n');
  }
}

async function getUserInput(tools = []) {
  while (true) {
    const prompt = await rl.question('Enter your prompt:> ');

    if (!prompt.trim() || prompt.trim().toLowerCase() === 'q') {
      if (typeof disconnectMicrosoftLearn === 'function') {
        await disconnectMicrosoftLearn();
      }
      rl.close();
      console.log('\nprogram exit !!');
      break;
    }

    console.log('wait...');
    msg.push({ role: 'user', content: prompt });
    fs.writeFileSync('./prompt.txt', JSON.stringify(msg, null, 2));

    await run(msg, tools);
  }
}

async function start() {
  let ms = [];
  try {
    ms = await connectMicrosoftLearn();
  } catch (err) {
    console.warn('MCP connection skipped/failed:', err.message || err);
  }

  const tools = schemaMake(ms);
  await getUserInput(tools);
}

start();
