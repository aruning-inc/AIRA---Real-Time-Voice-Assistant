export class AudioPlayer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onVolumeUpdate: ((volume: number) => void) | null = null;
  private onPlaybackEnd: (() => void) | null = null;
  private animationFrameId: number | null = null;
  private isPlaying = false;

  constructor(onVolumeUpdate?: (volume: number) => void, onPlaybackEnd?: () => void) {
    this.onVolumeUpdate = onVolumeUpdate || null;
    this.onPlaybackEnd = onPlaybackEnd || null;
  }

  private async init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      const workletCode = `
        class PlaybackProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferQueue = [];
            this.wasEmpty = true;
            this.port.onmessage = (e) => {
              if (e.data.type === 'chunk') {
                this.bufferQueue.push(e.data.data);
                this.wasEmpty = false;
              } else if (e.data.type === 'clear') {
                this.bufferQueue = [];
              }
            };
          }

          process(inputs, outputs, parameters) {
            const output = outputs[0];
            const channel = output[0];
            
            let channelIndex = 0;
            while (channelIndex < channel.length) {
              if (this.bufferQueue.length === 0) {
                for (let i = channelIndex; i < channel.length; i++) {
                  channel[i] = 0;
                }
                if (!this.wasEmpty) {
                  this.wasEmpty = true;
                  this.port.postMessage({ type: 'empty' });
                }
                break;
              }
              
              const currentBuffer = this.bufferQueue[0];
              const spaceRemaining = channel.length - channelIndex;
              
              if (currentBuffer.length <= spaceRemaining) {
                channel.set(currentBuffer, channelIndex);
                channelIndex += currentBuffer.length;
                this.bufferQueue.shift();
              } else {
                channel.set(currentBuffer.subarray(0, spaceRemaining), channelIndex);
                this.bufferQueue[0] = currentBuffer.subarray(spaceRemaining);
                channelIndex += spaceRemaining;
              }
            }
            return true;
          }
        }
        registerProcessor('playback-processor', PlaybackProcessor);
      `;

      const blob = new Blob([workletCode], { type: "application/javascript" });
      const workletUrl = URL.createObjectURL(blob);
      await this.audioCtx.audioWorklet.addModule(workletUrl);

      this.workletNode = new AudioWorkletNode(this.audioCtx, "playback-processor");
      this.workletNode.port.onmessage = (e) => {
        if (e.data.type === 'empty') {
          this.isPlaying = false;
          if (this.onPlaybackEnd) {
            this.onPlaybackEnd();
          }
        }
      };

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.workletNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      
      this.updateVolume();
    }
  }

  private updateVolume = () => {
    if (this.analyser && this.onVolumeUpdate) {
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      this.onVolumeUpdate(avg / 255); // Normalize between 0 and 1
    }

    this.animationFrameId = requestAnimationFrame(this.updateVolume);
  };

  async playChunk(buffer: ArrayBuffer) {
    if (!this.audioCtx) {
      await this.init();
    }
    if (!this.audioCtx || !this.workletNode) return;

    this.isPlaying = true;

    // It's PCM16 little-endian
    const int16Array = new Int16Array(buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    this.workletNode.port.postMessage({ type: 'chunk', data: float32Array });
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.onVolumeUpdate) {
      this.onVolumeUpdate(0);
    }
  }

  clearQueue() {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'clear' });
    }
  }
}
