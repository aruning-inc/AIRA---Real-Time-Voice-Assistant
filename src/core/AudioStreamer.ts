export class AudioStreamer {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onAudioChunk: ((buffer: ArrayBuffer) => void) | null = null;

  constructor(onAudioChunk: (buffer: ArrayBuffer) => void) {
    this.onAudioChunk = onAudioChunk;
  }

  async start() {
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = 1024;
          this.buffer = new Float32Array(this.bufferSize);
          this.bytesWritten = 0;
        }

        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input.length > 0) {
            const channelData = input[0];
            for (let i = 0; i < channelData.length; i++) {
              this.buffer[this.bytesWritten++] = channelData[i];
              if (this.bytesWritten >= this.bufferSize) {
                this.port.postMessage(this.buffer);
                this.buffer = new Float32Array(this.bufferSize);
                this.bytesWritten = 0;
              }
            }
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
    `;

    const blob = new Blob([workletCode], { type: "application/javascript" });
    const workletUrl = URL.createObjectURL(blob);

    await this.audioCtx.audioWorklet.addModule(workletUrl);

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioCtx, "pcm-processor");

    this.workletNode.port.onmessage = (event) => {
      const float32Array = event.data as Float32Array;
      const pcm16 = this.floatTo16BitPCM(float32Array);
      if (this.onAudioChunk) {
        this.onAudioChunk(pcm16);
      }
    };

    this.source.connect(this.workletNode);
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  private floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
    }
    return buffer;
  }
}
