/* Reproduce el audio que manda Gemini Live: trozos PCM16 a 24 kHz en base64, en cola y sin huecos. */

const SAMPLE_RATE = 24000;
const PCM16_MAX = 32768;

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  }
  return audioCtx;
}

function base64ToFloat32(base64Data) {
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / PCM16_MAX;
  }
  return float32;
}

export class PcmPlayer {
  #playbackTime = 0;
  #sources = [];
  #onIdle;

  /* onIdle: se llama cuando termina de sonar el último trozo de la cola. */
  constructor({ onIdle } = {}) {
    this.#onIdle = onIdle;
  }

  /* El navegador solo deja arrancar el audio tras un toque: se llama desde ese gesto. */
  async resume() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  enqueue(base64Data) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const float32 = base64ToFloat32(base64Data);
    const buffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    if (this.#playbackTime < ctx.currentTime) this.#playbackTime = ctx.currentTime;
    source.start(this.#playbackTime);
    this.#playbackTime += buffer.duration;
    this.#sources.push(source);

    source.onended = () => {
      const idx = this.#sources.indexOf(source);
      if (idx !== -1) this.#sources.splice(idx, 1);
      if (this.#sources.length === 0) this.#onIdle?.();
    };
  }

  stop() {
    for (const src of this.#sources) {
      try { src.stop(); } catch {}
    }
    this.#sources = [];
    this.#playbackTime = getAudioContext().currentTime;
  }
}
