/**
 * agent.js — Gemini 3.8 Live Engine for Brother Fit.
 * High-accuracy Real-Time Voice Conversation:
 * 1. Precision Speech Recognition (zero hallucinations, high noise tolerance in gym).
 * 2. Ultra low-latency bidirectional WebSocket connection with models/gemini-3.8-live.
 * 3. Real-time natural voice streaming playback (Aoede voice, 24kHz PCM16).
 * 4. Autonomous tool calling: guardar_recuerdo persisted to IndexedDB (agentMemory).
 * 5. Hands-free loop: User speaks -> Fit speaks -> User speaks.
 */

import { db } from '../db.js';

const LIVE_MODEL = 'models/gemini-3.8-live';
const WS_URL = (apiKey) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const TOOL_DECLARATIONS = [
  {
    name: 'guardar_recuerdo',
    description:
      'Guarda un dato relevante sobre el usuario (peso, marcas, objetivos, suplementación, lesiones, etc.) en su memoria permanente. Llama a esta función inmediatamente cuando el usuario comparta datos personales.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contenido: {
          type: 'STRING',
          description: 'El dato o preferencia a recordar de forma concisa.',
        },
      },
      required: ['contenido'],
    },
  },
  {
    name: 'listar_recuerdos',
    description: 'Lista todos los recuerdos guardados del usuario.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'borrar_recuerdo',
    description: 'Elimina un recuerdo específico por su ID numérico.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'NUMBER', description: 'ID del recuerdo a borrar.' },
      },
      required: ['id'],
    },
  },
];

/* --- IndexedDB Memory Helpers --- */
export async function loadAllMemories() {
  return db.getAll('agentMemory');
}

export async function saveMemory(contenido) {
  return db.add('agentMemory', { contenido, ts: Date.now() });
}

export async function deleteMemory(id) {
  return db.remove('agentMemory', Number(id));
}

async function executeToolCall(name, args) {
  if (name === 'guardar_recuerdo') {
    const id = await saveMemory(args.contenido);
    return { ok: true, id, mensaje: `Recuerdo guardado con ID ${id}.` };
  }
  if (name === 'listar_recuerdos') {
    const mems = await loadAllMemories();
    return { recuerdos: mems };
  }
  if (name === 'borrar_recuerdo') {
    await deleteMemory(args.id);
    return { ok: true, mensaje: `Recuerdo ${args.id} eliminado.` };
  }
  return { error: 'Herramienta desconocida.' };
}

async function buildSystemInstruction() {
  const memories = await loadAllMemories();
  const memBlock =
    memories.length > 0
      ? '\n\nRECUERDOS GUARDADOS DEL ATLETA:\n' +
        memories.map((m) => `- [ID ${m.id}] ${m.contenido}`).join('\n')
      : '';

  return (
    'Eres Fit, una compañera de entrenamiento y asesora técnica para un atleta adulto en Brother Fit. ' +
    'Estás conversando por voz en directo con él en el gimnasio. ' +
    'Trato de igual a igual: cercano, sobrio, técnico y a un ritmo tranquilo. ' +
    'No eres una porrista ni una profesora escolar: cero halagos vacíos, cero frases motivacionales clichés y cero emojis. ' +
    'Hablas en español neutro, natural y universal.\n\n' +
    'CÓMO HABLAS:\n' +
    '- Turnos muy breves: de 1 a 2 oraciones como máximo. Dale espacio mental al atleta entre series.\n' +
    '- Como máximo UNA sola pregunta por turno.\n' +
    '- Si no oyes bien por el ruido del gimnasio, haz una pregunta corta para confirmar en vez de adivinar.\n' +
    '- Si el atleta pide una aclaración, reformula con un ejemplo físico concreto y simple, y espera.\n\n' +
    'CÓMO ASESORAS:\n' +
    '- Sin halago automático: celebra récords auténticos, pero no aplaudas cada respuesta.\n' +
    '- Si el atleta propone algo contraproducente, peligroso o basado en mitos, cuestiónalo con amabilidad y criterio científico.\n' +
    '- Una sola corrección o foco técnico (cue) por turno, para que pueda aplicarlo en su siguiente serie sin sobrecarga mental.\n' +
    '- El atleta manda el tema: tus objetivos de registro jamás pisan lo que él decida consultar.\n' +
    '- Si menciona datos personales (peso, marcas, objetivos, molestias, suplementación), llama inmediatamente a guardar_recuerdo.\n' +
    '- Usa los recuerdos guardados de forma natural, sin recitarlos como un informe.' +
    memBlock
  );
}

/* --- Web Audio Playback (24kHz PCM16) --- */
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext({ sampleRate: 24000 });
  }
  return audioCtx;
}

function pcm16ToFloat32(bytes) {
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

/* --- FitAgent Class (Gemini 3.8 Live Engine) --- */
export class FitAgent {
  #apiKey = '';
  #ws = null;
  #handlers = {};
  #playbackTime = 0;
  #activeSources = [];
  #isLiveMode = false;
  #sessionReady = false;
  #isSpeaking = false;
  #speechRec = null;

  constructor(apiKey) {
    this.#apiKey = apiKey.trim();
  }

  on(event, fn) { this.#handlers[event] = fn; return this; }
  #emit(event, data) { this.#handlers[event]?.(data); }

  async connect() {
    const sysInstruction = await buildSystemInstruction();

    return new Promise((resolve, reject) => {
      try {
        this.#ws = new WebSocket(WS_URL(this.#apiKey));
        this.#ws.binaryType = 'arraybuffer';

        this.#ws.onopen = () => {
          this.#send({
            setup: {
              model: LIVE_MODEL,
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Aoede' }
                  }
                }
              },
              systemInstruction: { parts: [{ text: sysInstruction }] },
              tools: [{ functionDeclarations: TOOL_DECLARATIONS }]
            }
          });
        };

        this.#ws.onmessage = async (ev) => {
          let text;
          if (ev.data instanceof Blob) {
            text = await ev.data.text();
          } else if (typeof ev.data === 'string') {
            text = ev.data;
          } else {
            text = new TextDecoder().decode(ev.data);
          }

          let msg;
          try { msg = JSON.parse(text); } catch { return; }

          if (msg.setupComplete) {
            this.#sessionReady = true;
            this.#emit('ready');
            resolve();
            return;
          }

          this.#handleMessage(msg);
        };

        this.#ws.onerror = (e) => {
          this.#emit('error', new Error('Error al conectar con Gemini 3.8 Live'));
          reject(e);
        };

        this.#ws.onclose = () => {
          this.#sessionReady = false;
          this.stopLiveMode();
          this.#emit('disconnected');
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect() {
    this.stopLiveMode();
    this.#ws?.close();
    this.#ws = null;
    this.#sessionReady = false;
  }

  get connected() {
    return this.#sessionReady && this.#ws?.readyState === WebSocket.OPEN;
  }

  get isLiveMode() {
    return this.#isLiveMode;
  }

  /* --- Text Turn in Live Session --- */
  sendText(text) {
    if (!this.connected) throw new Error('Fit no está conectado');
    this.#stopCurrentAudio();
    this.#send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      },
    });
    this.#emit('user_message', text);
  }

  /* --- High-Accuracy Real-Time Voice Conversation Loop --- */
  async startLiveMode() {
    if (!this.connected) throw new Error('Conéctate primero para activar voz');
    if (this.#isLiveMode) return;

    // Asegurar que AudioContext de salida esté activo tras el gesto de usuario
    const outCtx = getAudioContext();
    if (outCtx.state === 'suspended') await outCtx.resume();

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      throw new Error('Tu navegador no soporta SpeechRecognition para captura de voz.');
    }

    this.#isLiveMode = true;
    this.#emit('live_mode_started');
    this.#listenCycle();
  }

  #listenCycle() {
    if (!this.#isLiveMode || !this.connected) return;

    // Si Fit está hablando, no escuchamos aún para evitar feedback de audio
    if (this.#isSpeaking) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.#speechRec = new SpeechRec();
    this.#speechRec.lang = 'es';
    this.#speechRec.continuous = false;
    this.#speechRec.interimResults = true;

    let finalTranscript = '';

    this.#speechRec.onstart = () => {
      this.#emit('listening');
    };

    this.#speechRec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      this.#emit('interim_speech', interim || finalTranscript);
    };

    this.#speechRec.onerror = (e) => {
      // Si no hubo habla (no-speech) simplemente reiniciamos el ciclo
      if (e.error === 'no-speech' && this.#isLiveMode && !this.#isSpeaking) {
        this.#listenCycle();
      }
    };

    this.#speechRec.onend = () => {
      if (finalTranscript.trim()) {
        const text = finalTranscript.trim();
        this.#emit('user_speaking_finished', text);
        // Enviamos la frase a Gemini 3.8 Live en la sesión activa
        this.sendText(text);
      } else if (this.#isLiveMode && !this.#isSpeaking) {
        // Reiniciamos escucha continua si no se dijo nada
        setTimeout(() => this.#listenCycle(), 300);
      }
    };

    try {
      this.#speechRec.start();
    } catch {}
  }

  stopLiveMode() {
    if (!this.#isLiveMode) return;
    this.#isLiveMode = false;
    this.#speechRec?.abort?.();
    this.#speechRec = null;
    this.#stopCurrentAudio();
    this.#emit('live_mode_stopped');
  }

  /* --- Internals --- */
  #send(payload) {
    if (this.#ws?.readyState !== WebSocket.OPEN) return;
    this.#ws.send(JSON.stringify(payload));
  }

  #stopCurrentAudio() {
    for (const src of this.#activeSources) {
      try { src.stop(); } catch {}
    }
    this.#activeSources = [];
    const ctx = getAudioContext();
    this.#playbackTime = ctx.currentTime;
    this.#isSpeaking = false;
    this.#emit('speaking_end');
  }

  #queueAudioChunk(base64Data) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const float32 = pcm16ToFloat32(bytes);
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    if (this.#playbackTime < ctx.currentTime) {
      this.#playbackTime = ctx.currentTime;
    }

    source.start(this.#playbackTime);
    this.#playbackTime += audioBuffer.duration;
    this.#activeSources.push(source);

    this.#isSpeaking = true;
    this.#emit('speaking_start');

    source.onended = () => {
      const idx = this.#activeSources.indexOf(source);
      if (idx !== -1) this.#activeSources.splice(idx, 1);
      if (this.#activeSources.length === 0) {
        this.#isSpeaking = false;
        this.#emit('speaking_end');
        // Cuando Fit termina de hablar, reactivamos automáticamente el micrófono para responderle
        if (this.#isLiveMode) {
          setTimeout(() => this.#listenCycle(), 400);
        }
      }
    };
  }

  async #handleMessage(msg) {
    // 1. Audio transmitido por Gemini 3.8 Live
    if (msg.serverContent) {
      const sc = msg.serverContent;

      if (sc.modelTurn?.parts) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData?.data) {
            this.#queueAudioChunk(part.inlineData.data);
          }
          if (part.text) {
            this.#emit('transcript_chunk', part.text);
          }
        }
      }

      // 2. Transcripción de lo que habla Fit
      if (sc.outputTranscription?.text) {
        this.#emit('transcript_chunk', sc.outputTranscription.text);
      }

      // 3. Interrupción
      if (sc.interrupted) {
        this.#stopCurrentAudio();
        this.#emit('interrupted');
      }

      if (sc.turnComplete) {
        this.#emit('turn_complete');
      }
    }

    // 4. Llamada a herramientas en tiempo real
    if (msg.toolCall) {
      const calls = msg.toolCall.functionCalls ?? [];
      const responses = [];
      for (const call of calls) {
        const result = await executeToolCall(call.name, call.args ?? {});
        responses.push({ id: call.id, name: call.name, response: { output: result } });
        this.#emit('memory_updated', call.name);
      }
      this.#send({ toolResponse: { functionResponses: responses } });
    }
  }
}
