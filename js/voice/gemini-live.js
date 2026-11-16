/* Conexión con Gemini Live por WebSocket: Bía responde con audio (voz Aoede) y su transcripción.
 * Solo traduce el protocolo de Google; el estado de la charla vive en fit-agent.js. */

import { TOOL_DECLARATIONS } from '../services/bia/tool-declarations.js';

const GEMINI_MODEL = 'models/gemini-3.8-live';
const GEMINI_VOICE = 'Aoede';

const wsUrl = (apiKey) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

async function frameToText(data) {
  if (data instanceof Blob) return data.text();
  if (typeof data === 'string') return data;
  return new TextDecoder().decode(data);
}

/* hooks: emit (eventos para la vista), runTool, playAudio, stopAudio, onClosed. */
export class GeminiLiveTransport {
  #apiKey;
  #hooks;
  #ws = null;
  #ready = false;

  constructor(apiKey, hooks) {
    this.#apiKey = apiKey;
    this.#hooks = hooks;
  }

  get connected() {
    return this.#ready && this.#ws?.readyState === WebSocket.OPEN;
  }

  connect(systemInstruction) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl(this.#apiKey));
      ws.binaryType = 'arraybuffer';
      this.#ws = ws;

      ws.onopen = () => this.#send(this.#setupMessage(systemInstruction));

      ws.onmessage = async (ev) => {
        let msg;
        try { msg = JSON.parse(await frameToText(ev.data)); } catch { return; }
        if (msg.setupComplete) {
          this.#ready = true;
          this.#hooks.emit('ready');
          resolve();
          return;
        }
        this.#handleMessage(msg);
      };

      ws.onerror = (e) => {
        this.#hooks.emit('error', new Error('Error al conectar con Gemini Live'));
        reject(e);
      };

      ws.onclose = () => {
        this.#ready = false;
        this.#hooks.onClosed();
      };
    });
  }

  close() {
    this.#ready = false;
    try { this.#ws?.close(); } catch {}
    this.#ws = null;
  }

  /* Nota que Bía lee sin contestar (turnComplete: false). */
  sendContext(text) {
    this.#sendTurn(text, false);
  }

  /* Turno que Bía contesta. */
  sendUserTurn(text) {
    this.#sendTurn(text, true);
  }

  /* Cierra el flujo de audio al silenciar el micrófono. */
  endAudioStream() {
    this.#send({ realtimeInput: { audioStreamEnd: true } });
  }

  #setupMessage(systemInstruction) {
    return {
      setup: {
        model: GEMINI_MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } },
        },
        systemInstruction: { parts: [{ text: systemInstruction }] },
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      },
    };
  }

  #sendTurn(text, turnComplete) {
    this.#send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete } });
  }

  #send(payload) {
    if (this.#ws?.readyState !== WebSocket.OPEN) return;
    this.#ws.send(JSON.stringify(payload));
  }

  async #handleMessage(msg) {
    const sc = msg.serverContent;
    if (sc) {
      /* part.text en modo audio es pensamiento o una llamada escrita, no lo que Bía dice. */
      for (const part of sc.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) this.#hooks.playAudio(part.inlineData.data);
      }
      if (sc.outputTranscription?.text) this.#hooks.emit('transcript_chunk', sc.outputTranscription.text);
      if (sc.interrupted) {
        this.#hooks.stopAudio();
        this.#hooks.emit('interrupted');
      }
      if (sc.turnComplete) this.#hooks.emit('turn_complete');
    }

    if (msg.toolCall) {
      const responses = [];
      for (const call of msg.toolCall.functionCalls ?? []) {
        const result = await this.#hooks.runTool(call.name, call.args ?? {});
        responses.push({ id: call.id, name: call.name, response: { output: result } });
      }
      this.#send({ toolResponse: { functionResponses: responses } });
    }
  }
}
