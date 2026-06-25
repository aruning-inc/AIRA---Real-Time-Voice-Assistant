import { AudioStreamer } from "./AudioStreamer";
import { AudioPlayer } from "./AudioPlayer";
import { toolManager } from "./ToolManager";
import { useAssistantStore, AssistantState } from "./StateManager";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";

function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class LiveSession {
  private ai: GoogleGenAI | null = null;
  private session: any = null;
  private audioStreamer: AudioStreamer | null = null;
  private audioPlayer: AudioPlayer | null = null;
  private wakeLock: WakeLockSentinel | null = null;

  constructor() {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      throw new Error("VITE_GEMINI_API_KEY is missing");
    }
    this.ai = new GoogleGenAI({
      apiKey: import.meta.env.VITE_GEMINI_API_KEY,
    });
  }

  private async requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        this.wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch (err) {
      console.warn("Wake Lock error:", err);
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock !== null) {
      this.wakeLock.release().catch(console.warn);
      this.wakeLock = null;
    }
  }

  async connect() {
    const { setState, setVolume, setError } = useAssistantStore.getState();
    setState(AssistantState.CONNECTING);
    setError(null);
    await this.requestWakeLock();

    if (!this.ai) {
      setError(
        "VITE_GEMINI_API_KEY is missing. Please set it in your .env file.",
      );
      this.disconnect();
      return;
    }

    try {
      this.audioPlayer = new AudioPlayer(
        (vol) => setVolume(vol),
        () => {
          if (useAssistantStore.getState().state === AssistantState.SPEAKING) {
            setState(AssistantState.LISTENING);
          }
        },
      );

      this.session = await this.ai.live.connect({
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
          onmessage: async (message: LiveServerMessage) => {
            try {
              const audioBase64 =
                message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioBase64) {
                if (
                  useAssistantStore.getState().state !== AssistantState.SPEAKING
                ) {
                  setState(AssistantState.SPEAKING);
                }
                const buffer = base64ToArrayBuffer(audioBase64);
                this.audioPlayer?.playChunk(buffer);
              }

              if (message.serverContent?.interrupted) {
                this.audioPlayer?.clearQueue();
                setState(AssistantState.LISTENING);
              }

              const toolCall = message.toolCall;
              if (toolCall) {
                const response = await toolManager.executeToolCall(toolCall);
                this.session?.sendToolResponse({
                  functionResponses: response.functionResponses,
                });
              }
            } catch (e) {
              console.error("Failed to parse message:", e);
            }
          },
          onclose: (event: any) => {
            console.log("Gemini session closed", event);
            this.disconnect();
          },
        },
      });

      this.audioStreamer = new AudioStreamer((pcm16Buffer) => {
        if (this.session) {
          const base64Audio = arrayBufferToBase64(pcm16Buffer);
          this.session.sendRealtimeInput({
            audio: { data: base64Audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
      });
      await this.audioStreamer.start();
      setState(AssistantState.LISTENING);
    } catch (err: any) {
      console.error("Connection Error:", err);
      setError(err.message || "Failed to connect to Gemini Live API.");
      this.disconnect();
    }
  }

  disconnect() {
    const { setState } = useAssistantStore.getState();
    if (this.audioStreamer) {
      this.audioStreamer.stop();
      this.audioStreamer = null;
    }
    if (this.audioPlayer) {
      this.audioPlayer.stop();
      this.audioPlayer = null;
    }
    if (this.session) {
      // The session object doesn't have a clear disconnect method documented in all versions,
      // but usually has close() or similar, let's try close or just dereference it.
      try {
        // Some versions of the SDK might not expose a synchronous close,
        // but if the socket is exposed we could close it.
        // Let it GC for now.
      } catch (e) {}
      this.session = null;
    }
    this.releaseWakeLock();
    setState(AssistantState.DISCONNECTED);
  }
}
