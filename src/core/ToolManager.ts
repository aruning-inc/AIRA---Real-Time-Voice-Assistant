export class ToolManager {
  private tools: Map<string, (args: any) => Promise<any>> = new Map();

  constructor() {
    this.registerTool("openWebsite", async ({ url }) => {
      console.log("Tool openWebsite called with", url);
      window.open(url, "_blank");
      return { success: true };
    });

    this.registerTool("openApp", async ({ appName }) => {
      console.log("Tool openApp called with", appName);
      alert(`Opening App: ${appName}`);
      return { success: true };
    });

    this.registerTool("browserAction", async ({ action }) => {
      console.log("Tool browserAction called with", action);
      if (action.toLowerCase() === "back") {
        window.history.back();
      } else if (action.toLowerCase() === "forward") {
        window.history.forward();
      } else if (action.toLowerCase() === "reload") {
        window.location.reload();
      }
      return { success: true };
    });
  }

  registerTool(name: string, handler: (args: any) => Promise<any>) {
    this.tools.set(name, handler);
  }

  async executeToolCall(toolCall: any): Promise<any> {
    const responses = [];
    for (const call of toolCall.functionCalls) {
      const handler = this.tools.get(call.name);
      if (handler) {
        try {
          const result = await handler(call.args);
          responses.push({
            id: call.id,
            name: call.name,
            response: result,
          });
        } catch (error: any) {
          responses.push({
            id: call.id,
            name: call.name,
            response: { error: error.message },
          });
        }
      }
    }
    return { functionResponses: responses };
  }
}

export const toolManager = new ToolManager();
