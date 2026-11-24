require('dotenv').config();
const OpenAI = require('openai');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
let fs=require('node:fs')
let tools=require('./tools.js')
let Logger=require('./logger.js')
let {connectMicrosoftLearn,
  callMicrosoftTool,
  disconnectMicrosoftLearn}=require('./mcp.js')


//let tool=fs.readFileSync('./tools.js','utf-8')

//console.log(tools)
const SYSTEM_PROMPT =
  "Do not include any reasoning, chain-of-thought, or <think> tags. " +
  "Return ONLY tool calls when appropriate, or the direct final response without extra explanation.";


function schmaMake(mcpTools=[]){

const tools = mcpTools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || `Microsoft Learn tool: ${t.name}`,
      parameters: t.inputSchema || { type: "object", properties: {} },
    },
}))

return tools;
}




const openai = new OpenAI({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.KEY || 'not-needed',
});

const MODEL = process.env.MODEL;

const msg = [
  { role: 'system', content: SYSTEM_PROMPT },
];

async function run(messages) {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
     tools,
    });

    const reply = completion.choices[0].message.content;
  console.log(`\nAI: ${reply}\n`);
 if(completion.choices[0].message.tool_calls){
toolsCall(completion.choices[0].message)
}
   msg.push({ role: 'assistant', content: reply });
 
 } catch (error) {
    console.error('\nError communicating with AI:', error.message, '\n');
  }
}

const rl = readline.createInterface({ input, output });
let abailableTools = ['microsoft_docs_search', 'microsoft_code_sample_search', 'microsoft_docs_fetch']



async function executeTool(name,arg){
let res=await callMicrosoftTool({name,arguments:arg})
}


async function toolsCall(func){
for(let call of func.tool_calls){

if(abailableTools.includes(call.function.name)){
Logger.tool(call.function.name,call.function.argument)
let result=await executeTool(call.function.name,call.function.argument)

let res=JSON.stringify(result.content, null, 2)
msg.push({role:'tool',content:res})
}

console.log("---------------------------------------------")
Logger.tool(call.function.name,call.function.argument)
console.log("---------------------------------------------")

}
run(msg)
}

//toolsCall()



async function getUserInput() {
  const prompt = await rl.question('Enter your prompt:> ');

  if (prompt !== "" && prompt.trim().toLowerCase() !== 'q') {
    console.log('wait...');
    msg.push({ role: 'user', content: prompt });

    await run(msg);
    getUserInput();
  } else {
disconnectMicrosoftLearn();
    rl.close();
    console.log('\nprogram exit !!');
  }
}

//getUserInput();


async function start(){
let ms=await connectMicrosoftLearn()
//Logger.log(ms)

let mcpTools=schmaMake(ms)
tools=[...tools,...mcpTools]

//Logger.log(tools)
getUserInput();

}

start()
