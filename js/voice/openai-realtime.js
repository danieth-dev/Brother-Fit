/* Conexión con OpenAI Realtime por WebRTC: el audio va y vuelve por el canal de medios (voz Coral)
 * y los eventos por el canal de datos. Solo traduce el protocolo; el estado de la charla vive en fit-agent.js. */

import { TOOL_DECLARATIONS } from '../services/bia/tool-declarations.js';

const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini-realtime-preview';
const OPENAI_VOICE = 'coral';

const API = 'https://api.openai.com/v1/realtime';
const CLOSED_STATES = new Set(['failed', 'closed']);

const OPENAI_TOOLS = TOOL_DECLARATIONS.map((t) => ({
  type: 'function',
  name: t.name,
  description: t.description,
  parameters: { type: 'object', properties: t.parameters.properties, required: t.parameters.required || [] },
}));

/* hooks: emit (eventos para la vista), runTool, stopAudio, setSpeaking, setUserSpeaking, onClosed. */
export class OpenAIRealtimeTransport {
  #apiKey;
  #model;
  #hooks;
  #pc = null;
  #dc = null;
  #mediaStream = null;
  #audioEl = null;
  #ready = false;

  constructor(apiKey, model, hooks) {
    this.#apiKey = apiKey;
    this.#model = model || OPENAI_DEFAULT_MODEL;
    this.#hooks = hooks;
  }

  get connected() {
    return this.#ready && (this.#pc?.connectionState === 'connected' || this.#pc?.iceConnectionState === 'connected');
  }

  async connect(systemInstruction) {
    const ephemeralKey = await this.#createSession(systemInstruction);

    const pc = new RTCPeerConnection();
    this.#pc = pc;
    this.#audioEl = document.createElement('audio');
    this.#audioEl.autoplay = true;
    pc.ontrack = (e) => {
      this.#audioEl.srcObject = e.streams[0];
      this.#audioEl.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (this.#ready && CLOSED_STATES.has(pc.connectionState)) {
        this.#ready = false;
        this.#hooks.onClosed();
      }
    };

    await this.#attachMicrophone(pc);

    this.#dc = pc.createDataChannel('oai-events');
    this.#dc.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.#handleMessage(msg);
    };

    await this.#negotiate(pc, ephemeralKey);
    this.#ready = true;
    this.#hooks.emit('ready');
  }

  close() {
    this.#ready = false;
    try { this.#pc?.close(); } catch {}
    this.#pc = null;
    this.#dc = null;
    this.#mediaStream?.getTracks().forEach((t) => t.stop());
    this.#mediaStream = null;
    if (this.#audioEl) this.#audioEl.srcObject = null;
    this.#audioEl = null;
  }

  /* Nota que Bía lee sin contestar. */
  sendContext(text) {
    this.#send(this.#userItem(text));
  }

  /* Turno que Bía contesta. */
  sendUserTurn(text) {
    this.#send(this.#userItem(text));
    this.#send({ type: 'response.create' });
  }

  /* El micrófono de WebRTC no tiene cierre de flujo aparte. */
  endAudioStream() {}

  /* La clave del atleta solo se usa aquí; WebRTC trabaja con una clave temporal. */
  async #createSession(systemInstruction) {
    const res = await fetch(`${API}/sessions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.#apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.#model,
        voice: OPENAI_VOICE,
        instructions: systemInstruction,
        modalities: ['audio', 'text'],
        input_audio_transcription: { model: 'whisper-1' },
        tools: OPENAI_TOOLS,
        tool_choice: 'auto',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error ${res.status} al autenticar con OpenAI`);
    }
    return (await res.json()).client_secret.value;
  }

  /* Sin micrófono la charla sigue por texto. */
  async #attachMicrophone(pc) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.#mediaStream = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (e) {
      console.warn('Micrófono WebRTC no accesible:', e);
    }
  }

  async #negotiate(pc, ephemeralKey) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch(`${API}?model=${encodeURIComponent(this.#model)}`, {
      method: 'POST',
      body: offer.sdp,
      headers: { 'Authorization': `Bearer ${ephemeralKey}`, 'Content-Type': 'application/sdp' },
    });
    if (!res.ok) throw new Error('No se pudo abrir el canal de audio con OpenAI');
    await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
  }

  #userItem(text) {
    return {
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    };
  }

  #send(payload) {
    if (this.#dc?.readyState === 'open') this.#dc.send(JSON.stringify(payload));
  }

  async #handleMessage(msg) {
    switch (msg.type) {
      /* Mismos eventos que Gemini: la vista arma la burbuja con transcript_chunk y la guarda en turn_complete. */
      case 'response.audio_transcript.delta':
        this.#hooks.setSpeaking(true);
        this.#hooks.emit('transcript_chunk', msg.delta);
        return;
      case 'response.audio_transcript.done':
        this.#hooks.setSpeaking(false);
        this.#hooks.emit('turn_complete');
        return;
      case 'input_audio_buffer.speech_started':
        this.#hooks.setUserSpeaking(true);
        this.#hooks.stopAudio();
        return;
      case 'input_audio_buffer.speech_stopped':
        this.#hooks.setUserSpeaking(false);
        return;
      case 'response.output_item.done':
        if (msg.item?.type === 'function_call') await this.#answerToolCall(msg.item);
        return;
      default:
    }
  }

  async #answerToolCall({ name, call_id: callId, arguments: rawArgs }) {
    let args = {};
    try { args = JSON.parse(rawArgs || '{}'); } catch {}
    const result = await this.#hooks.runTool(name, args);
    this.#send({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) },
    });
    this.#send({ type: 'response.create' });
  }
}
