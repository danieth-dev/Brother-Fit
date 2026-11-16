/* Sesión de voz de Bía en el navegador: micrófono, audio de respuesta y conexión en directo
 * con Gemini Live (WebSocket) u OpenAI Realtime (WebRTC). Es un adaptador del navegador,
 * no un servicio: usa <audio>, AudioContext y SpeechRecognition. Las reglas viven en services/bia/. */

import { buildSystemInstruction } from '../services/bia/prompt.js';
import { isAthleteTurn } from '../services/bia/text.js';
import { TOOL_DECLARATIONS } from '../services/bia/tool-declarations.js';
import { executeToolCall } from '../services/bia/tools.js';
import { captureSpokenEffort } from '../services/effort.js';

const LIVE_MODEL = 'models/gemini-3.8-live';
const WS_URL = (apiKey) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

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

/* --- FitAgent Class (Multi-Provider: Gemini Live Aoede & OpenAI Realtime Coral) --- */
export class FitAgent {
  #provider = 'gemini';
  #apiKey = '';
  #model = '';
  #voice = 'Aoede';
  #ws = null;
  #pc = null;
  #dc = null;
  #mediaStream = null;
  #audioEl = null;
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

  constructor(config) {
    if (typeof config === 'string') {
      this.#apiKey = config.trim();
      this.#provider = 'gemini';
      this.#model = LIVE_MODEL;
      this.#voice = 'Aoede';
    } else if (config && typeof config === 'object') {
      this.#provider = config.provider || 'gemini';
      this.#apiKey = (config.activeKey || config.apiKey || '').trim();
      this.#model = config.model || (this.#provider === 'openai' ? (config.openaiModel || 'gpt-4o-mini-realtime-preview') : LIVE_MODEL);
      this.#voice = this.#provider === 'openai' ? 'coral' : 'Aoede';
    }
    currentAgentInstance = this;
  }

  get provider() { return this.#provider; }
  get voice() { return this.#voice; }
  get model() { return this.#model; }

  on(event, fn) { this.#handlers[event] = fn; return this; }
  #emit(event, ...args) { this.#handlers[event]?.(...args); }

  async connect() {
    const sysInstruction = await buildSystemInstruction();

    if (this.#provider === 'openai') {
      return this.#connectOpenAI(sysInstruction);
    }
    return this.#connectGemini(sysInstruction);
  }

  /* Conexión nativa OpenAI Realtime WebRTC con voz Coral (equivalente gemela de Aoede) */
  async #connectOpenAI(sysInstruction) {
    const openaiTools = TOOL_DECLARATIONS.map((t) => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: t.parameters.properties,
        required: t.parameters.required || [],
      },
    }));

    const sessionRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.#apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.#model || 'gpt-4o-mini-realtime-preview',
        voice: 'coral',
        instructions: sysInstruction,
        modalities: ['audio', 'text'],
        input_audio_transcription: {
          model: 'whisper-1',
        },
        tools: openaiTools,
        tool_choice: 'auto',
      }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error ${sessionRes.status} al autenticar con OpenAI`);
    }

    const sessionData = await sessionRes.json();
    const ephemeralKey = sessionData.client_secret.value;

    const pc = new RTCPeerConnection();
    this.#pc = pc;

    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    this.#audioEl = audioEl;

    pc.ontrack = (e) => {
      audioEl.srcObject = e.streams[0];
      audioEl.play().catch(() => {});
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.#mediaStream = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (e) {
      console.warn('Microfono WebRTC no accesible:', e);
    }

    const dc = pc.createDataChannel('oai-events');
    this.#dc = dc;

    dc.onmessage = async (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      await this.#handleOpenAIMessage(msg);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${this.#model || 'gpt-4o-mini-realtime-preview'}`, {
      method: 'POST',
      body: offer.sdp,
      headers: {
        'Authorization': `Bearer ${ephemeralKey}`,
        'Content-Type': 'application/sdp',
      },
    });

    if (!sdpRes.ok) {
      throw new Error('Fallo al conectar canal de audio WebRTC con OpenAI');
    }

    const answer = {
      type: 'answer',
      sdp: await sdpRes.text(),
    };
    await pc.setRemoteDescription(answer);

    this.#sessionReady = true;
    this.#emit('ready');
  }

  async #handleOpenAIMessage(msg) {
    if (msg.type === 'response.audio_transcript.delta') {
      this.#emit('bot_text_chunk', msg.delta);
      this.#emit('speaking_start');
      this.#isSpeaking = true;
      return;
    }

    if (msg.type === 'response.audio_transcript.done') {
      this.#emit('bot_text', msg.transcript);
      this.#emit('speaking_end');
      this.#isSpeaking = false;
      return;
    }

    if (msg.type === 'conversation.item.input_audio_transcription.completed') {
      const text = (msg.transcript || '').trim();
      if (text) {
        this.#emit('user_speaking_finished', text);
      }
      return;
    }

    if (msg.type === 'input_audio_buffer.speech_started') {
      this.#isUserSpeaking = true;
      this.#stopCurrentAudio();
      this.#emit('user_speaking_start');
      return;
    }

    if (msg.type === 'input_audio_buffer.speech_stopped') {
      this.#isUserSpeaking = false;
      return;
    }

    if (msg.type === 'response.output_item.done' && msg.item?.type === 'function_call') {
      const { name, call_id } = msg.item;
      let args = {};
      try { args = JSON.parse(msg.item.arguments || '{}'); } catch {}
      const result = await executeToolCall(name, args);
      if (result?.exercise) {
        this.#emit('exercise_selected', result.exercise);
      }
      this.#emit('memory_updated', name, args, result);

      this.#sendOpenAI({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: call_id,
          output: JSON.stringify(result),
        },
      });
      this.#sendOpenAI({ type: 'response.create' });
    }
  }

  #sendOpenAI(payload) {
    if (this.#dc?.readyState === 'open') {
      this.#dc.send(JSON.stringify(payload));
    }
  }

  /* Conexión nativa Google Gemini Live WebSocket con voz Aoede */
  async #connectGemini(sysInstruction) {
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
    if (this.#ws) {
      try { this.#ws.close(); } catch {}
      this.#ws = null;
    }
    if (this.#pc) {
      try { this.#pc.close(); } catch {}
      this.#pc = null;
    }
    if (this.#mediaStream) {
      try { this.#mediaStream.getTracks().forEach((t) => t.stop()); } catch {}
      this.#mediaStream = null;
    }
    if (this.#audioEl) {
      try { this.#audioEl.srcObject = null; } catch {}
      this.#audioEl = null;
    }
    this.#sessionReady = false;
    if (currentAgentInstance === this) currentAgentInstance = null;
  }

  get connected() {
    if (this.#provider === 'openai') {
      return this.#sessionReady && (this.#pc?.connectionState === 'connected' || this.#pc?.iceConnectionState === 'connected');
    }
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
    if (this.#provider === 'openai') {
      this.#sendOpenAI({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: `[CONTEXTO DE ENTRENAMIENTO - NO LO DIGAS EN VOZ ALTA]: ${note}. Usa esto únicamente como contexto para tus próximas intervenciones.` }],
        },
      });
      return;
    }
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

  /* Historial de la charla tras cerrar la app. Una sola vez al abrir sesión nueva. */
  seedPriorChat(transcript) {
    const note = String(transcript || '').trim();
    if (!note) return;
    this.sendContext(
      `Conversación previa de esta charla:\n${note}\n\nNo la repitas ni la contestes. Espera la siguiente frase del atleta.`
    );
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
    if (this.#provider === 'openai') {
      this.#sendOpenAI({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: `[EVENTO DEL SISTEMA]: ${instruction}` }],
        },
      });
      this.#sendOpenAI({ type: 'response.create' });
      return;
    }
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
    if (!this.connected) throw new Error('Bía no está conectado');
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
    if (this.#provider === 'openai') {
      this.#sendOpenAI({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      });
      this.#sendOpenAI({ type: 'response.create' });
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
        // Cuando Bía termina de hablar, reactivamos automáticamente el micrófono para responderle
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
          // part.text en modo audio es pensamiento o una llamada escrita, no lo que Bía dice.
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
        if (call.name === 'usar_ejercicio' && result.ok && result.exercise) {
          this.#emit('exercise_selected', result.exercise);
        }
        this.#emit('memory_updated', call.name, call.args, result);
      }
      this.#send({ toolResponse: { functionResponses: responses } });
    }
  }
}
