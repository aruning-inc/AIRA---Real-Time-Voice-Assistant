import { AudioStreamer } from "./AudioStreamer";
import { AudioPlayer } from "./AudioPlayer";
import { toolManager } from "./ToolManager";
import { useAssistantStore, AssistantState } from "./StateManager";

export class LiveSession {
  private ws: WebSocket | null = null;
  private audioStreamer: AudioStreamer | null = null;
  private audioPlayer: AudioPlayer | null = null;
  private wakeLock: WakeLockSentinel | null = null;

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

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/live`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = "arraybuffer";

      this.audioPlayer = new AudioPlayer(
        (vol) => setVolume(vol),
        () => {
          if (useAssistantStore.getState().state === AssistantState.SPEAKING) {
            setState(AssistantState.LISTENING);
          }
        }
      );

      this.ws.onopen = async () => {
        try {
          this.audioStreamer = new AudioStreamer((pcm16Buffer) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(pcm16Buffer);
            }
          });
          await this.audioStreamer.start();
          setState(AssistantState.LISTENING);
        } catch (err: any) {
          console.error("Microphone Access Error:", err);
          setError(err.message || "Could not access microphone.");
          this.disconnect();
        }
      };

      this.ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          if (useAssistantStore.getState().state !== AssistantState.SPEAKING) {
            setState(AssistantState.SPEAKING);
          }
          this.audioPlayer?.playChunk(event.data);
        } else {
          try {
            const msg = JSON.parse(event.data);

            if (msg.error) {
              console.error("Server Error:", msg.error);
              setError(`Server Error: ${msg.error}`);
              this.disconnect();
              return;
            }

            if (msg.interrupted) {
              this.audioPlayer?.clearQueue();
              setState(AssistantState.LISTENING);
            }

            if (msg.toolCall) {
              const response = await toolManager.executeToolCall(msg.toolCall);
              if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ toolResponse: response }));
              }
            }
          } catch (e) {
            console.error("Failed to parse message:", e);
          }
        }
      };

      this.ws.onclose = (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          setError("WebSocket connection dropped.");
        }
        this.disconnect();
      };

      this.ws.onerror = (err: any) => {
        console.error("WebSocket Error:", err);
        setError("WebSocket connection failed. Ensure the server is running and supports WebSockets.");
        this.disconnect();
      };
    } catch (err: any) {
      console.error("Connection Error:", err);
      setError(err.message || "Failed to initialize WebSocket.");
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.releaseWakeLock();
    setState(AssistantState.DISCONNECTED);
  }
}

