const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const Logger = require("./logger.js");

const SERVER_URL ="https://learn.microsoft.com/api/mcp";

let client;
let connected = false;


async function connectMicrosoftLearn() {
    try {
        Logger.info("Connecting to Microsoft Learn MCP...");

        client = new Client({
            name: "my-ai-agent",
            version: "0.2.0"
        });

        const transport = new StreamableHTTPClientTransport(
            new URL(SERVER_URL)
        );

        await client.connect(transport);

        connected = true;

        Logger.info("Microsoft Learn MCP connected");
        //Logger.log(client)
        // Dynamically discover available tools
        const response = await client.listTools();

        Logger.info("Microsoft Learn tools discovered:",
            response.tools.map(tool => tool.name)
        );

        return response.tools;

    } catch (error) {
        connected = false;

        Logger.error("Microsoft Learn MCP connection failed:",
            error.message
        );

        throw error;
    }
}


async function callMicrosoftTool(name, args = {}) {
    if (!connected || !client) {
        throw new Error("Microsoft Learn MCP is not connected");
    }

    Logger.tool(name, args);

    const startTime = Date.now();

    try {
        const result = await client.callTool({
            name,
            arguments: args
        });

        Logger.info("Microsoft MCP tool completed:", {
            name,
            durationMs: Date.now() - startTime
        });
        console.log(result)
        return result;

    } catch (error) {
        Logger.error("Microsoft MCP tool failed:", {
            name,
            error: error.message
        });

        throw error;
    }
}



async function disconnectMicrosoftLearn() {
    if (client) {
        await client.close();
        client = undefined;
        connected = false;

        Logger.info("Microsoft Learn MCP disconnected");
    }
}



//connectMicrosoftLearn().catch(console.error)


module.exports = {
  connectMicrosoftLearn,
  callMicrosoftTool,
  disconnectMicrosoftLearn
};
