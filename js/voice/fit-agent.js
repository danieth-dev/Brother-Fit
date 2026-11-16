/* Sesión de voz de Bía en el navegador: estado de la charla, micrófono (SpeechRecognition),
 * avisos del entreno y herramientas. La conexión con cada proveedor vive en su archivo
 * (gemini-live.js, openai-realtime.js) y el audio de Gemini en pcm-player.js.
 * Es un adaptador del navegador, no un servicio: las reglas viven en services/bia/. */

import { buildSystemInstruction } from '../services/bia/prompt.js';
import { isAthleteTurn } from '../services/bia/text.js';
import { executeToolCall } from '../services/bia/tools.js';
import { captureSpokenEffort } from '../services/effort.js';
import { GeminiLiveTransport } from './gemini-live.js';
import { OpenAIRealtimeTransport } from './openai-realtime.js';
import { PcmPlayer } from './pcm-player.js';

/* Tiempos del micrófono, en milisegundos. */
const RELISTEN_DELAY = 500;
const RELISTEN_AFTER_SPEECH = 400;
const RETRY_BASE_DELAY = 400;
const RETRY_MAX_DELAY = 4000;
/* Si el reconocedor oye voz pero no cierra la frase en este tiempo, era ruido: no retiene el aviso. */
const SPEECH_NOISE_TIMEOUT = 4000;
const MAX_MIC_FAILURES = 5;
const MIC_BLOCKED_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

const MIC_CLOSED_MSG = 'El micrófono se cerró. Toca Iniciar para volver a abrirlo.';
const MIC_STUCK_MSG = 'El micrófono se trabó. Toca Iniciar para volver a abrirlo.';

const contextNote = (note) =>
  `[CONTEXTO DE ENTRENAMIENTO - NO LO DIGAS EN VOZ ALTA]: ${note}. Usa esto únicamente como contexto para tus próximas intervenciones.`;
const systemEvent = (instruction) => `[EVENTO DEL SISTEMA]: ${instruction}`;

const speechRecognitionClass = () => window.SpeechRecognition || window.webkitSpeechRecognition;

let currentAgentInstance = null;

export function getActiveAgent() {
  return currentAgentInstance;
}

export class FitAgent {
  #provider;
  #transport;
  #player;
  #handlers = {};
  #isLiveMode = false;
  #isSpeaking = false;
  #isMuted = false;
  #isUserSpeaking = false;
  #pendingCheckIn = null;
  #speechRec = null;
  #listenGen = 0;
  #restartTimer = null;
  #speakingTimeout = null;
  #micFailures = 0;

  /* config: el resultado de getAgentConfig(). */
  constructor(config) {
    this.#provider = config.provider === 'openai' ? 'openai' : 'gemini';
    this.#player = new PcmPlayer({ onIdle: () => this.#onPlaybackIdle() });
    const hooks = this.#transportHooks();
    const apiKey = (config.activeKey || '').trim();
    this.#transport = this.#provider === 'openai'
      ? new OpenAIRealtimeTransport(apiKey, config.openaiModel, hooks)
      : new GeminiLiveTransport(apiKey, hooks);
    currentAgentInstance = this;
  }

  get provider() { return this.#provider; }
  get connected() { return this.#transport.connected; }
  get isLiveMode() { return this.#isLiveMode; }
  get isMuted() { return this.#isMuted; }

  on(event, fn) { this.#handlers[event] = fn; return this; }
  #emit(event, ...args) { this.#handlers[event]?.(...args); }

  async connect() {
    await this.#transport.connect(await buildSystemInstruction());
  }

  disconnect() {
    this.stopLiveMode();
    this.#transport.close();
    if (currentAgentInstance === this) currentAgentInstance = null;
  }

  /* --- Lo que el entreno le dice a Bía --- */

  /* Nota invisible: Bía la usa de contexto y no habla. */
  sendContext(note) {
    if (!this.connected) return;
    this.#transport.sendContext(contextNote(note));
  }

  /* Historial de la charla tras cerrar la app. Una sola vez al abrir sesión nueva. */
  seedPriorChat(transcript) {
    const note = String(transcript || '').trim();
    if (!note) return;
    this.sendContext(
      `Conversación previa de esta charla:\n${note}\n\nNo la repitas ni la contestes. Espera la siguiente frase del atleta.`
    );
  }

  /* Aviso de fin de descanso: Bía habla. Si el atleta está hablando, espera a que termine. */
  triggerCheckIn(instruction) {
    if (!this.connected) return;
    if (this.#isUserSpeaking) {
      this.#pendingCheckIn = instruction;
      return;
    }
    this.#stopAudio();
    this.#transport.sendUserTurn(systemEvent(instruction));
  }

  cancelPendingCheckIn() {
    this.#pendingCheckIn = null;
  }

  sendText(text) {
    if (!this.connected) throw new Error('Bía no está conectada');
    this.#stopAudio();
    this.#emit('user_message', text);
    this.#deliverText(text);
  }

  /* Si la frase es solo un esfuerzo («fácil», «8»), se anota sin pasar por la IA. */
  async #deliverText(text) {
    const saved = await captureSpokenEffort(text);
    if (saved) {
      this.#emit('effort_saved', saved);
      this.sendContext('El esfuerzo ya quedó anotado. No hables, no preguntes y no escribas comentarios.');
      return;
    }
    this.#transport.sendUserTurn(text);
  }

  /* --- Micrófono --- */

  muteMic() {
    this.#isMuted = true;
    this.#listenGen += 1;
    this.#quietMic();
    if (this.connected) this.#transport.endAudioStream();
    this.#emit('mic_muted');
  }

  unmuteMic() {
    this.#isMuted = false;
    this.#emit('mic_unmuted');
    if (this.#isLiveMode && !this.#isSpeaking) this.#listenCycle();
  }

  async startLiveMode() {
    if (!this.connected) throw new Error('Conéctate primero para activar voz');
    if (this.#isLiveMode) return;
    await this.#player.resume();
    if (!speechRecognitionClass()) {
      throw new Error('Este navegador no puede escuchar tu voz. Escríbele a Bía.');
    }
    this.#isLiveMode = true;
    this.#emit('live_mode_started');
    this.#listenCycle();
  }

  stopLiveMode() {
    if (!this.#isLiveMode) return;
    this.#isLiveMode = false;
    this.#listenGen += 1;
    this.#micFailures = 0;
    this.#quietMic();
    this.#stopAudio();
    this.#emit('live_mode_stopped');
  }

  #canListen() {
    return this.#isLiveMode && this.connected && !this.#isMuted && !this.#isSpeaking;
  }

  /* Un reconocedor por frase: Chrome corta solo tras un silencio y aquí se abre el siguiente. */
  #listenCycle() {
    if (!this.#canListen()) return;
    const SpeechRec = speechRecognitionClass();
    if (!SpeechRec) return;
    this.#clearRestart();
    this.#releaseRecognizer();

    const gen = ++this.#listenGen;
    const isCurrent = () => gen === this.#listenGen;
    const rec = new SpeechRec();
    this.#speechRec = rec;
    rec.lang = 'es';
    rec.continuous = false;
    rec.interimResults = true;

    let finalTranscript = '';
    let error = '';

    rec.onstart = () => {
      if (!isCurrent()) return;
      this.#micFailures = 0;
      this.#isUserSpeaking = false;
      this.#emit('listening');
    };

    rec.onresult = (e) => {
      if (!isCurrent()) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      const rawText = (interim || finalTranscript).trim();
      if (isAthleteTurn(rawText)) this.#markUserSpeaking(isCurrent);
      this.#emit('interim_speech', rawText);
    };

    /* onerror siempre va seguido de onend. Reiniciar aquí abría un segundo micrófono. */
    rec.onerror = (e) => {
      if (isCurrent()) error = e?.error || '';
    };

    rec.onend = () => {
      if (!isCurrent()) return;
      this.#clearSpeakingTimeout();
      this.#isUserSpeaking = false;
      if (this.#speechRec === rec) this.#speechRec = null;
      this.#afterPhrase(finalTranscript.trim(), error);
    };

    try {
      rec.start();
    } catch {
      if (isCurrent()) this.#retryMic();
    }
  }

  #markUserSpeaking(isCurrent) {
    this.#isUserSpeaking = true;
    this.#clearSpeakingTimeout();
    this.#speakingTimeout = setTimeout(() => {
      if (!isCurrent() || !this.#isUserSpeaking) return;
      this.#isUserSpeaking = false;
      this.#flushPendingCheckIn();
    }, SPEECH_NOISE_TIMEOUT);
  }

  /* Qué hacer cuando el reconocedor cierra: mandar la frase, soltar el aviso retenido o volver a escuchar. */
  #afterPhrase(text, error) {
    if (isAthleteTurn(text)) {
      this.#micFailures = 0;
      this.#pendingCheckIn = null;
      this.#emit('user_speaking_finished', text);
      this.sendText(text);
      return;
    }
    if (this.#pendingCheckIn && !error) {
      this.#flushPendingCheckIn();
      return;
    }
    if (!this.#canListen() || error === 'aborted') return;
    if (MIC_BLOCKED_ERRORS.has(error)) {
      this.#giveUpMic(MIC_CLOSED_MSG);
      return;
    }
    if (error && error !== 'no-speech') {
      this.#retryMic();
      return;
    }
    this.#scheduleListen(RELISTEN_DELAY);
  }

  #flushPendingCheckIn() {
    const checkIn = this.#pendingCheckIn;
    if (!checkIn) return;
    this.#pendingCheckIn = null;
    this.triggerCheckIn(checkIn);
  }

  /* Reintento con espera creciente; tras varios fallos seguidos se rinde y avisa. */
  #retryMic() {
    this.#micFailures += 1;
    if (this.#micFailures >= MAX_MIC_FAILURES) {
      this.#giveUpMic(MIC_STUCK_MSG);
      return;
    }
    this.#scheduleListen(Math.min(RETRY_BASE_DELAY * 2 ** (this.#micFailures - 1), RETRY_MAX_DELAY));
  }

  #giveUpMic(message) {
    this.stopLiveMode();
    this.#emit('mic_paused', message);
  }

  #scheduleListen(delay) {
    this.#clearRestart();
    this.#restartTimer = setTimeout(() => {
      this.#restartTimer = null;
      this.#listenCycle();
    }, delay);
  }

  #clearRestart() {
    if (!this.#restartTimer) return;
    clearTimeout(this.#restartTimer);
    this.#restartTimer = null;
  }

  #clearSpeakingTimeout() {
    if (!this.#speakingTimeout) return;
    clearTimeout(this.#speakingTimeout);
    this.#speakingTimeout = null;
  }

  /* Apaga el reconocedor y sus temporizadores sin cambiar el modo de voz. */
  #quietMic() {
    this.#clearRestart();
    this.#clearSpeakingTimeout();
    this.#releaseRecognizer();
    this.#isUserSpeaking = false;
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

  /* --- Voz de Bía y respuestas del proveedor --- */

  #transportHooks() {
    return {
      emit: (event, ...args) => this.#emit(event, ...args),
      runTool: (name, args) => this.#runTool(name, args),
      playAudio: (base64) => {
        this.#player.enqueue(base64);
        this.#setSpeaking(true);
      },
      stopAudio: () => this.#stopAudio(),
      setSpeaking: (speaking) => this.#setSpeaking(speaking),
      setUserSpeaking: (speaking) => { this.#isUserSpeaking = speaking; },
      onClosed: () => {
        this.stopLiveMode();
        this.#emit('disconnected');
      },
    };
  }

  #setSpeaking(speaking) {
    this.#isSpeaking = speaking;
    this.#emit(speaking ? 'speaking_start' : 'speaking_end');
  }

  #stopAudio() {
    this.#player.stop();
    this.#setSpeaking(false);
  }

  /* Cuando Bía termina de hablar, el micrófono vuelve a abrirse para responderle. */
  #onPlaybackIdle() {
    this.#setSpeaking(false);
    if (this.#isLiveMode) setTimeout(() => this.#listenCycle(), RELISTEN_AFTER_SPEECH);
  }

  async #runTool(name, args) {
    const result = await executeToolCall(name, args);
    if (name === 'usar_ejercicio' && result?.ok && result.exercise) {
      this.#emit('exercise_selected', result.exercise);
    }
    this.#emit('memory_updated', name, args, result);
    return result;
  }
}
