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
import { now } from '../utils/clock.js';
import { getActiveWorkout, lastSetFor, saveActiveRest, listExercises, matchExercise } from './workouts.js';
import { registerSet, anotarRpe, captureSpokenEffort } from './effort.js';

const LIVE_MODEL = 'models/gemini-3.8-live';
const WS_URL = (apiKey) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const TOOL_DECLARATIONS = [
  {
    name: 'registrar_serie',
    description:
      'Registra una serie en el entrenamiento en curso. Úsala cuando el atleta diga las repeticiones y el peso que acaba de hacer. El esfuerzo, si lo dice, responde a «¿Cuántas repeticiones más podrías haber hecho?». No uses RPE.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reps: { type: 'NUMBER', description: 'Número de repeticiones completadas.' },
        ejercicio: { type: 'STRING', description: 'Nombre del ejercicio si el atleta lo dice, con sus palabras. Si no lo dice, no lo envíes: se usa el de la pantalla. No inventes ni elijas un id.' },
        peso: { type: 'NUMBER', description: 'Peso añadido. Si no se indica, usa el de la serie anterior de ese ejercicio. Nunca el peso de la báscula.' },
        corporal: { type: 'BOOLEAN', description: 'True si dice peso corporal o sin peso extra. El peso añadido queda en 0, salvo que también diga un disco o unos kilos: entonces peso es solo ese número.' },
        tipo: { type: 'STRING', description: 'trabajo o calentamiento. Si no lo dice, es trabajo.' },
        rir: { type: 'NUMBER', description: 'Respuesta a «¿Cuántas repeticiones más podrías haber hecho?»: 0 es no salía otra, 1, 2, 3, o 4 o más. No conviertas un RPE a este número.' },
      },
      required: ['reps'],
    },
  },
  {
    name: 'usar_ejercicio',
    description:
      'Deja Entreno en el ejercicio que el atleta nombra, sin anotar una serie. Úsala en cuanto diga cuál va a hacer, antes de las repeticiones. No confirma el de la pantalla.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ejercicio: { type: 'STRING', description: 'Nombre dicho por el atleta, con sus palabras. No inventes otro.' },
      },
      required: ['ejercicio'],
    },
  },
  {
    name: 'anotar_rpe',
    description:
      'Anota la respuesta a «¿Cuántas repeticiones más podrías haber hecho?» en la pregunta abierta. No crea series y no elige cuál: la marca lo dice. No resta ni convierte a RPE.',
    parameters: {
      type: 'OBJECT',
      properties: {
        marca: { type: 'NUMBER', description: 'La marca de la pregunta vigente. No reutilices una marca anterior.' },
        rir: { type: 'NUMBER', description: 'Respuesta a «¿Cuántas repeticiones más podrías haber hecho?»: 0 es no salía otra, 1, 2, 3, o 4 o más.' },
        omitir: { type: 'BOOLEAN', description: 'True solo si el atleta dice que no sabe. No anota esfuerzo.' },
      },
      required: ['marca'],
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

function restSeconds(reps) {
  if (state.settings.descansoMode !== 'auto') return state.settings.descanso || 90;
  if (reps <= 5) return 180;
  if (reps <= 8) return 120;
  if (reps <= 12) return 90;
  return 60;
}

async function resolveSpokenExercise(spoken) {
  const found = matchExercise(spoken, await listExercises());
  if (found.status === 'none') {
    return { ok: false, preguntar: false, mensaje: 'Ese ejercicio no está en la lista. Dilo y no lo anotes en otro.' };
  }
  if (found.status === 'many') {
    const nombres = found.exercises.map((e) => e.nombre).join(', ');
    return { ok: false, preguntar: false, mensaje: `No anotado. Hay varios: ${nombres}. Pregunta cuál, una sola vez.` };
  }
  const ex = found.exercise;
  state.activeExercise = { id: ex.id, nombre: ex.nombre, grupo: ex.grupo };
  document.dispatchEvent(new CustomEvent('bf-exercise', { detail: { id: ex.id } }));
  return { ok: true, exercise: ex };
}

/* Lo que Fit dice. Un comentario interno no se muestra. */
export function visibleFitText(raw) {
  const text = String(raw || '');
  if (text.includes('<!--') && !text.includes('-->')) return '';
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
}

export function isAthleteTurn(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/[0-9]/.test(t)) return true;
  if (/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]{3,}/.test(t)) return true;
  return /^(si|sí|no|ok)$/i.test(t);
}

export async function executeToolCall(name, args) {
  if (name === 'registrar_serie') {
    const active = await getActiveWorkout();
    if (!active) return { error: 'No hay entrenamiento activo en este momento. Inicia una sesión primero.' };

    const reps = Math.round(Number(args.reps));
    if (!Number.isFinite(reps) || reps < 1 || reps > 100) {
      return { error: 'Número de repeticiones no válido o no indicado por el atleta.' };
    }

    const spoken = String(args.ejercicio || '').trim();
    let ex = null;
    if (spoken) {
      const resolved = await resolveSpokenExercise(spoken);
      if (!resolved.ok) return resolved;
      ex = resolved.exercise;
    } else if (state.activeExercise?.id) {
      ex = state.activeExercise;
    } else {
      return { error: 'No hay un ejercicio seleccionado en la pantalla de entrenamiento.' };
    }

    let peso = null;
    const said = Number(args.peso);
    const hasAdded = Number.isFinite(said) && said > 0 && said <= 600;
    if (args.corporal === true) {
      peso = hasAdded ? said : 0;
    } else if (args.peso != null && Number.isFinite(said) && said >= 0 && said <= 600) {
      peso = said;
    } else {
      const last = await lastSetFor(ex.id);
      peso = last?.peso ?? 0;
    }

    state.activeExercise = { id: ex.id, nombre: ex.nombre, grupo: ex.grupo };
    document.dispatchEvent(new CustomEvent('bf-exercise', { detail: { id: ex.id } }));

    const restEnd = now() + restSeconds(reps) * 1000;
    const res = await registerSet({
      workoutId: active.id,
      exerciseId: ex.id,
      peso,
      reps,
      tipo: args.tipo,
      rir: args.rir,
      restEnd,
    }, { guard: true });
    if (res) res.ejercicio = ex.nombre;
    if (!res?.duplicada) {
      await saveActiveRest(restEnd, reps);
      document.dispatchEvent(new CustomEvent('bf-set', { detail: { restEnd, lastReps: reps } }));
    }
    return res;
  }
  if (name === 'usar_ejercicio') {
    const spoken = String(args.ejercicio || '').trim();
    if (!spoken) return { ok: false, preguntar: false, mensaje: 'Falta el nombre. Pregunta cuál, una sola vez.' };
    const resolved = await resolveSpokenExercise(spoken);
    if (!resolved.ok) return resolved;
    return {
      ok: true,
      preguntar: false,
      ejercicio: resolved.exercise.nombre,
      mensaje: `Entreno quedó en ${resolved.exercise.nombre}. No lo confirmes otra vez. Espera la serie.`,
    };
  }
  if (name === 'anotar_rpe') {
    return anotarRpe({ rir: args.rir, mark: args.marca, omitir: args.omitir === true });
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
    ? `\n\nSI NO NOMBRA EJERCICIO, EL DE ENTRENO ES: ${activeEx.nombre} (${activeEx.grupo}). No lo recites ni pidas confirmarlo.\n`
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
    '- Tu criterio de fondo son cuatro pilares: dormir bien, comer bien, hacer ejercicio y no estresarse. Úsalos solo si el atleta saca el tema o propone algo que los rompe. No los recites, no preguntes por ellos y no los pongas por delante de anotar la serie.\n' +
    '- REGLA DE DESCANSOS: No hables por iniciativa propia durante el descanso. Si acabas de preguntar cuántas repeticiones más podía hacer, su respuesta sí se atiende: llama a anotar_rpe, también si dice 0, cero o ninguna, y también si está descansando.\n' +
    '- Una sola corrección o foco técnico (cue) por turno, para que pueda aplicarlo en su siguiente serie sin sobrecarga mental.\n' +
    '- Si nombra un ejercicio, llama a usar_ejercicio enseguida con sus palabras, aunque todavía no haya serie. No preguntes si confirmamos el de Entreno y no digas «en pantalla tengo». Si ya lo dijo, no vuelvas a preguntar cuál.\n' +
    '- Si pide anotar una serie, llama a registrar_serie enseguida. Si nombra el ejercicio, envía ese texto en ejercicio. Si no lo nombra, no envíes ejercicio. tipo es trabajo si no dice que es calentamiento. El esfuerzo responde a «¿Cuántas repeticiones más podrías haber hecho?». Si habla en RPE, no lo conviertas: haz esa misma pregunta. 0 es que no salía otra.\n' +
    '- No preguntes el peso antes de la serie y no digas «lastre». Peso corporal es corporal true y 0 kg añadidos. Si dice un disco o unos kilos, peso es solo ese número.\n' +
    '- Si la herramienta dice que el ejercicio no está o que hay varios, obedécela: no anotes en otro y, si hay varios, pregunta cuál una sola vez.\n' +
    '- Si la herramienta responde preguntar true, haz la pregunta del esfuerzo con la marca que viene y espera. Si preguntar es false, no vuelvas a preguntar el esfuerzo.\n' +
    '- La respuesta del atleta se anota con anotar_rpe: la marca vigente y el rir. 0 y cero son rir 0. Si dice que no sabe, omitir true. Una marca vieja no sirve: pregunta de nuevo y no reutilices la respuesta anterior.\n' +
    '- No sugieras pesos, no cambies el descanso y no inventes el esfuerzo.\n' +
    '- El atleta manda el tema: tus objetivos de registro jamás pisan lo que él decida consultar.\n' +
    '- Si menciona datos personales (peso, marcas, objetivos, molestias, suplementación), llama inmediatamente a guardar_recuerdo.\n' +
    '- Usa los recuerdos guardados de forma natural, sin recitarlos como un informe.\n' +
    '- Nunca escribas HTML, comentarios, inglés ni instrucciones internas. Si no hay nada que decir, no generes texto. Tu única salida es la frase hablada al atleta, en español, en 1 o 2 oraciones.' +
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
  #listenGen = 0;
  #restartTimer = null;
  #micFailures = 0;
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
    this.#listenGen += 1;
    this.#clearRestart();
    if (this.#speakingTimeout) {
      clearTimeout(this.#speakingTimeout);
      this.#speakingTimeout = null;
    }
    this.#releaseRecognizer();
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
    this.#emit('user_message', text);
    this.#deliverText(text);
  }

  async #deliverText(text) {
    const saved = await captureSpokenEffort(text);
    if (saved) {
      this.#emit('effort_saved', saved);
      this.sendContext('El esfuerzo ya quedó anotado. No hables, no preguntes y no escribas comentarios.');
      return;
    }
    this.#send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      },
    });
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

  #clearRestart() {
    if (!this.#restartTimer) return;
    clearTimeout(this.#restartTimer);
    this.#restartTimer = null;
  }

  /* Quita los avisos antes de abortar. Si no, el cierre del anterior pide otro micrófono. */
  #releaseRecognizer() {
    const rec = this.#speechRec;
    this.#speechRec = null;
    if (!rec) return;
    rec.onstart = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try { rec.abort(); } catch {}
  }

  #scheduleListen(delay) {
    this.#clearRestart();
    this.#restartTimer = setTimeout(() => {
      this.#restartTimer = null;
      this.#listenCycle();
    }, delay);
  }

  #giveUpMic(message) {
    this.stopLiveMode();
    this.#emit('mic_paused', message);
  }

  #listenCycle() {
    if (!this.#isLiveMode || !this.connected || this.#isMuted || this.#isSpeaking) return;
    this.#clearRestart();
    this.#releaseRecognizer();

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const gen = ++this.#listenGen;
    const rec = new SpeechRec();
    this.#speechRec = rec;
    rec.lang = 'es';
    rec.continuous = false;
    rec.interimResults = true;

    let finalTranscript = '';
    let error = '';

    rec.onstart = () => {
      if (gen !== this.#listenGen) return;
      this.#micFailures = 0;
      this.#isUserSpeaking = false;
      this.#emit('listening');
    };

    rec.onresult = (e) => {
      if (gen !== this.#listenGen) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      const rawText = (interim || finalTranscript).trim();
      if (isAthleteTurn(rawText)) {
        this.#isUserSpeaking = true;
        if (this.#speakingTimeout) clearTimeout(this.#speakingTimeout);
        // Timeout de seguridad: si tras 4s no se finaliza texto, tratar como ruido para no bloquear el check-in
        this.#speakingTimeout = setTimeout(() => {
          if (gen !== this.#listenGen || !this.#isUserSpeaking) return;
          this.#isUserSpeaking = false;
          if (this.#pendingCheckIn) {
            const checkIn = this.#pendingCheckIn;
            this.#pendingCheckIn = null;
            this.triggerCheckIn(checkIn);
          }
        }, 4000);
      }
      this.#emit('interim_speech', rawText);
    };

    /* onerror siempre va seguido de onend. Reiniciar aquí abría un segundo micrófono. */
    rec.onerror = (e) => {
      if (gen !== this.#listenGen) return;
      error = e?.error || '';
    };

    rec.onend = () => {
      if (gen !== this.#listenGen) return;
      if (this.#speakingTimeout) clearTimeout(this.#speakingTimeout);
      this.#isUserSpeaking = false;
      if (this.#speechRec === rec) this.#speechRec = null;

      const text = finalTranscript.trim();
      if (isAthleteTurn(text)) {
        this.#micFailures = 0;
        this.#pendingCheckIn = null;
        this.#emit('user_speaking_finished', text);
        this.sendText(text);
        return;
      }

      if (this.#pendingCheckIn && !error) {
        const checkIn = this.#pendingCheckIn;
        this.#pendingCheckIn = null;
        this.triggerCheckIn(checkIn);
        return;
      }

      if (!this.#isLiveMode || !this.connected || this.#isMuted || this.#isSpeaking) return;
      if (error === 'aborted') return;
      if (error === 'not-allowed' || error === 'service-not-allowed' || error === 'audio-capture') {
        this.#giveUpMic('El micrófono se cerró. Toca Iniciar para volver a abrirlo.');
        return;
      }

      if (error && error !== 'no-speech') {
        this.#micFailures += 1;
        if (this.#micFailures >= 5) {
          this.#giveUpMic('El micrófono se trabó. Toca Iniciar para volver a abrirlo.');
          return;
        }
        this.#scheduleListen(Math.min(400 * 2 ** (this.#micFailures - 1), 4000));
        return;
      }

      this.#scheduleListen(500);
    };

    try {
      rec.start();
    } catch {
      if (gen !== this.#listenGen) return;
      this.#micFailures += 1;
      if (this.#micFailures >= 5) {
        this.#giveUpMic('El micrófono se trabó. Toca Iniciar para volver a abrirlo.');
        return;
      }
      this.#scheduleListen(Math.min(400 * 2 ** (this.#micFailures - 1), 4000));
    }
  }

  stopLiveMode() {
    if (!this.#isLiveMode) return;
    this.#isLiveMode = false;
    this.#listenGen += 1;
    this.#clearRestart();
    this.#micFailures = 0;
    if (this.#speakingTimeout) {
      clearTimeout(this.#speakingTimeout);
      this.#speakingTimeout = null;
    }
    this.#releaseRecognizer();
    this.#isUserSpeaking = false;
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
