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
import { state } from '../store.js';
import { getActiveWorkout, addSet, lastSetFor } from './workouts.js';

const LIVE_MODEL = 'models/gemini-3.8-live';
const WS_URL = (apiKey) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const TOOL_DECLARATIONS = [
  {
    name: 'registrar_serie',
    description:
      'Registra una serie en el entrenamiento en curso. Llama a esta función cuando el atleta indique repeticiones, peso y/o RPE de la serie que acaba de hacer (ej: "anótame 8 reps", "hice 100 kg por 3 reps a RPE 9").',
    parameters: {
      type: 'OBJECT',
      properties: {
        reps: { type: 'NUMBER', description: 'Número de repeticiones completadas.' },
        peso: { type: 'NUMBER', description: 'Peso levantado en kg o lb. Si no se indica, usa el de la serie anterior.' },
        rpe: { type: 'NUMBER', description: 'RPE opcional de 1 a 10 indicado por el atleta.' },
      },
      required: ['reps'],
    },
  },
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

let lastRegisteredSetCall = { workoutId: null, exerciseId: null, reps: null, peso: null, time: 0, setId: null };

async function executeToolCall(name, args) {
  if (name === 'registrar_serie') {
    const active = await getActiveWorkout();
    if (!active) return { error: 'No hay entrenamiento activo en este momento. Inicia una sesión primero.' };

    const exId = state.activeExercise?.id;
    if (!exId) return { error: 'No hay un ejercicio seleccionado en la pantalla de entrenamiento.' };

    // Validar reps: número entero positivo entre 1 y 100 indicado por el atleta
    const reps = Math.round(Number(args.reps));
    if (!Number.isFinite(reps) || reps < 1 || reps > 100) {
      return { error: 'Número de repeticiones no válido o no indicado por el atleta.' };
    }

    // Validar RPE si fue proporcionado: entre 1 y 10
    let rpe = null;
    if (args.rpe != null) {
      const parsedRpe = Number(args.rpe);
      if (Number.isFinite(parsedRpe) && parsedRpe >= 1 && parsedRpe <= 10) {
        rpe = parsedRpe;
      }
    }

    // Kilos: si la frase del atleta trajo carga válida, se usa esa; si no, la de la serie pendiente
    let peso = null;
    if (args.peso != null && Number.isFinite(Number(args.peso)) && Number(args.peso) >= 0 && Number(args.peso) <= 600) {
      peso = Number(args.peso);
    } else {
      const last = await lastSetFor(exId);
      peso = last?.peso ?? 0;
    }

    // Idempotencia: una segunda llamada sobre la misma serie abierta no escribe de nuevo
    const now = Date.now();
    if (
      lastRegisteredSetCall.workoutId === active.id &&
      lastRegisteredSetCall.exerciseId === exId &&
      lastRegisteredSetCall.reps === reps &&
      lastRegisteredSetCall.peso === peso &&
      (now - lastRegisteredSetCall.time) < 8000
    ) {
      return {
        ok: true,
        setId: lastRegisteredSetCall.setId,
        mensaje: `La serie de ${peso} ${state.settings.unidad} × ${reps} reps ya fue anotada previamente.`,
      };
    }

    const setObj = {
      workoutId: active.id,
      exerciseId: exId,
      peso,
      reps,
    };
    if (rpe != null) setObj.rpe = rpe;

    const setId = await addSet(setObj);
    lastRegisteredSetCall = {
      workoutId: active.id,
      exerciseId: exId,
      peso,
      reps,
      time: now,
      setId,
    };

    return {
      ok: true,
      setId,
      mensaje: `Serie registrada: ${peso} ${state.settings.unidad} × ${reps} reps${rpe ? ` (RPE ${rpe})` : ''}.`,
    };
  }
  if (name === 'guardar_recuerdo') {
    const raw = (args.contenido || '').trim();
    if (!raw) return { error: 'Contenido vacío.' };

    // Conservar siempre molestias físicas, lesiones, técnica/cues, agarre o metas
    const isSubjectiveOrGoal = /\b(duele|dolor|molestia|lesi[oó]n|molestias|hombro|rodilla|espalda|codo|cuello|agarre|codos|postura|t[eé]cnica|cue|forma|meta|objetivo|aspiraci[oó]n|apunto|llegar a)\b/i.test(raw);

    // Solo descartar si tiene forma explícita de serie de entrenamiento (kilos + repeticiones juntos como registro de carga)
    const isSetLogPattern = /\b\d+\s*(?:kg|kilos?|lb|libras?)\s*(?:[x×y]|por|,)?\s*\d+\s*(?:reps?|repeticiones)?\b/i.test(raw) ||
                            /\b(?:serie\s*\d+|hice|anot[aá]me?)\b.*?\b\d+\s*reps?\b/i.test(raw);

    if (isSetLogPattern && !isSubjectiveOrGoal) {
      return { ok: true, mensaje: 'Las marcas de series y peso se gestionan automáticamente en el cuaderno local.' };
    }
    const id = await saveMemory(raw);
    return { ok: true, id, mensaje: `Preferencia o nota técnica guardada con ID ${id}.` };
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

  const activeEx = state.activeExercise;
  const currentCtx = activeEx
    ? `\n\nESTADO ACTUAL DEL ATLETA EN EL GYM:\n- Ejercicio actual en pantalla: ${activeEx.nombre} (${activeEx.grupo})\n`
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
    '- REGLA DE DESCANSOS: Prohibido hablar por iniciativa propia durante los descansos entre series. Respirar no es un silencio que tengas que llenar. Solo hablas si el atleta te hace una pregunta o si la app te inyecta una orden explícita.\n' +
    '- Una sola corrección o foco técnico (cue) por turno, para que pueda aplicarlo en su siguiente serie sin sobrecarga mental.\n' +
    '- Tienes la herramienta registrar_serie: si el atleta pide registrar una serie (reps, peso, RPE), úsala inmediatamente.\n' +
    '- El atleta manda el tema: tus objetivos de registro jamás pisan lo que él decida consultar.\n' +
    '- Si menciona datos personales (peso, marcas, objetivos, molestias, suplementación), llama inmediatamente a guardar_recuerdo.\n' +
    '- Usa los recuerdos guardados de forma natural, sin recitarlos como un informe.\n' +
    '- NUNCA muestres planificación, títulos, borradores ni razonamiento interno. Nada de inglés ni de markdown. Tu única salida es la frase hablada al atleta, en español, en 1 o 2 oraciones.' +
    currentCtx +
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

let currentAgentInstance = null;

export function getActiveAgent() {
  return currentAgentInstance;
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
  #isMuted = false;
  #isUserSpeaking = false;
  #pendingCheckIn = null;
  #speakingTimeout = null;

  constructor(apiKey) {
    this.#apiKey = apiKey.trim();
    currentAgentInstance = this;
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
              outputAudioTranscription: {},
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
    if (currentAgentInstance === this) currentAgentInstance = null;
  }

  get connected() {
    return this.#sessionReady && this.#ws?.readyState === WebSocket.OPEN;
  }

  get isLiveMode() {
    return this.#isLiveMode;
  }

  get isMuted() {
    return this.#isMuted;
  }

  cancelPendingCheckIn() {
    this.#pendingCheckIn = null;
  }

  muteMic() {
    this.#isMuted = true;
    if (this.#speakingTimeout) {
      clearTimeout(this.#speakingTimeout);
      this.#speakingTimeout = null;
    }
    this.#speechRec?.abort?.();
    this.#speechRec = null;
    this.#isUserSpeaking = false;

    // Enviar audioStreamEnd para que Gemini Live cierre formalmente el stream de audio
    if (this.connected) {
      this.#send({
        realtimeInput: {
          audioStreamEnd: true,
        },
      });
    }
    this.#emit('mic_muted');
  }

  unmuteMic() {
    this.#isMuted = false;
    this.#emit('mic_unmuted');
    if (this.#isLiveMode && !this.#isSpeaking) {
      this.#listenCycle();
    }
  }

  /* --- Inyección 2: Nota de estado invisible (turnComplete: false, no genera habla) --- */
  sendContext(note) {
    if (!this.connected) return;
    this.#send({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: `[CONTEXTO DE ENTRENAMIENTO - NO LO DIGAS EN VOZ ALTA]: ${note}. Usa esto únicamente como contexto para tus próximas intervenciones.` }],
        }],
        turnComplete: false,
      },
    });
  }

  /* --- Inyección 3: Aviso de fin de descanso (turnComplete: true) --- */
  triggerCheckIn(instruction) {
    if (!this.connected) return;
    // Si el atleta está hablando en este momento, retenemos la orden para no pisarlo
    if (this.#isUserSpeaking) {
      this.#pendingCheckIn = instruction;
      return;
    }
    this.#stopCurrentAudio();
    this.#send({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: `[EVENTO DEL SISTEMA]: ${instruction}` }],
        }],
        turnComplete: true,
      },
    });
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
    if (!this.#isLiveMode || !this.connected || this.#isMuted) return;

    // Si Fit está hablando, no escuchamos aún para evitar feedback de audio
    if (this.#isSpeaking) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.#speechRec = new SpeechRec();
    this.#speechRec.lang = 'es';
    this.#speechRec.continuous = false;
    this.#speechRec.interimResults = true;

    let finalTranscript = '';

    this.#speechRec.onstart = () => {
      this.#isUserSpeaking = false;
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
      const rawText = (interim || finalTranscript).trim();
      // #isUserSpeaking debe ser transcripción real (palabras legibles), no nivel de ruido
      const hasRealWords = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]{3,}/.test(rawText);
      if (hasRealWords) {
        this.#isUserSpeaking = true;
        if (this.#speakingTimeout) clearTimeout(this.#speakingTimeout);
        // Timeout de seguridad: si tras 4s no se finaliza texto, tratar como ruido para no bloquear el check-in
        this.#speakingTimeout = setTimeout(() => {
          if (this.#isUserSpeaking) {
            this.#isUserSpeaking = false;
            if (this.#pendingCheckIn) {
              const checkIn = this.#pendingCheckIn;
              this.#pendingCheckIn = null;
              this.triggerCheckIn(checkIn);
            }
          }
        }, 4000);
      }
      this.#emit('interim_speech', rawText);
    };

    this.#speechRec.onerror = (e) => {
      // Si no hubo habla (no-speech) simplemente reiniciamos el ciclo si no está muteado
      if (e.error === 'no-speech' && this.#isLiveMode && !this.#isSpeaking && !this.#isMuted) {
        this.#listenCycle();
      }
    };

    this.#speechRec.onend = () => {
      if (this.#speakingTimeout) clearTimeout(this.#speakingTimeout);
      this.#isUserSpeaking = false;
      const text = finalTranscript.trim();
      const hasRealWords = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]{3,}/.test(text);

      if (hasRealWords) {
        // Frase real del atleta: cancela el aviso de descanso automático porque ya está dialogando
        this.#pendingCheckIn = null;
        this.#emit('user_speaking_finished', text);
        this.sendText(text);
      } else {
        // Ruido sin palabras o silencio: liberar aviso retenido inmediatamente si existía
        if (this.#pendingCheckIn) {
          const checkIn = this.#pendingCheckIn;
          this.#pendingCheckIn = null;
          this.triggerCheckIn(checkIn);
        } else if (this.#isLiveMode && !this.#isSpeaking && !this.#isMuted) {
          setTimeout(() => this.#listenCycle(), 300);
        }
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
          // part.text en modo audio es pensamiento o una llamada escrita, no lo que Fit dice.
        }
      }

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
