import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import * as http from "http";

async function startServer() {
  const app = express();
  const PORT = 3000;

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/live" });

  if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY environment variable is missing.");
    // We don't throw here to prevent the whole pod from crashing before serving the frontend, 
    // but we can send an error message to clients attempting to connect.
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "missing_key",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  wss.on("connection", async (clientWs: WebSocket) => {
    if (!process.env.GEMINI_API_KEY) {
      clientWs.send(JSON.stringify({ error: "GEMINI_API_KEY is missing on the server." }));
      clientWs.close();
      return;
    }

    let session: any = null;

    try {
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction:
            "You are AIRA. A young, confident, witty, charming female AI assistant. Playful, warm, emotionally intelligent, smart. Respond as if talking to a friend. Support interruptions naturally. Maintain conversational memory during active session.",
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Open a website by URL",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The URL of the website to open",
                      },
                    },
                    required: ["url"],
                  },
                },
                {
                  name: "openApp",
                  description: "Open an app by name",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      appName: {
                        type: Type.STRING,
                        description: "The name of the app to open",
                      },
                    },
                    required: ["appName"],
                  },
                },
                {
                  name: "browserAction",
                  description: "Perform a browser action",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "The action to perform",
                      },
                    },
                    required: ["action"],
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio =
              message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && clientWs.readyState === WebSocket.OPEN) {
              const buffer = Buffer.from(audio, "base64");
              clientWs.send(buffer);
            }
            if (
              message.serverContent?.interrupted &&
              clientWs.readyState === WebSocket.OPEN
            ) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            
            const toolCall = message.toolCall;
            if (toolCall && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ toolCall }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close();
            }
          },
        },
      });

      clientWs.on("message", (data: any, isBinary: boolean) => {
        try {
          if (isBinary) {
            const base64Audio = data.toString("base64");
            session.sendRealtimeInput({
              audio: { data: base64Audio, mimeType: "audio/pcm;rate=16000" },
            });
          } else {
            const msg = JSON.parse(data.toString());
            if (msg.toolResponse) {
               session.sendToolResponse({
                  functionResponses: msg.toolResponse.functionResponses
               });
            }
          }
        } catch (err) {
          console.error("Error processing client message:", err);
        }
      });

      clientWs.on("close", () => {
        try {
          // Send close message or let it drop
        } catch (e) {}
      });
    } catch (error) {
      console.error("Failed to start Gemini Live Session:", error);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
