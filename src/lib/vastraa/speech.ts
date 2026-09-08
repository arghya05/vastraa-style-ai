// Voice input/output via Sarvam AI, proxied through our own backend (SARVAM_API_KEY
// stays server-side — see backend/apparel/api/voice.py). Speech-to-text auto-detects
// the spoken language (English or any major Indian language); the detected language
// is remembered here so the following spoken reply comes back in the same language.
import { getApiBaseUrl } from "./config";

export function isVoiceInputSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export function isVoiceOutputSupported(): boolean {
  return typeof Audio !== "undefined";
}

export type RecognitionHandle = { stop: () => void };

let lastLanguageCode = "en-IN";

function wsBaseUrl(): string | null {
  const base = getApiBaseUrl();
  if (!base) return null;
  return base.replace(/^http/, "ws");
}

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// Sarvam's realtime stream is fixed at 16kHz; the mic's AudioContext runs at
// whatever the OS gives it (usually 44.1/48kHz), so every chunk is decimated down
// here. Nearest-neighbour is good enough for speech-to-text, not hi-fi audio.
function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const outLength = Math.round(input.length / ratio);
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) output[i] = input[Math.floor(i * ratio)] ?? 0;
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Streams the mic live to Sarvam's realtime STT (via the backend's WebSocket relay)
 * until stop() is called. onPartial fires repeatedly with the in-progress transcript
 * for live captioning; onResult fires once at the end with the final combined text.
 * onEnd always fires after, so the caller can reset its "listening" state. */
export function startListening(
  onResult: (transcript: string) => void,
  onEnd: () => void,
  onError: (message: string) => void,
  onPartial?: (text: string) => void,
): RecognitionHandle | null {
  if (!isVoiceInputSupported()) {
    onError("Voice input isn't supported in this browser.");
    return null;
  }
  const base = wsBaseUrl();
  if (!base) {
    onError("Set the backend URL first.");
    return null;
  }

  let stopped = false;
  let stream: MediaStream | null = null;
  let finalText = "";
  const socket = new WebSocket(`${base}/api/voice/stream?language_code=auto`);

  // Created synchronously, inside the click handler's call stack (startListening is
  // called directly from the mic button's onClick) — Chrome's autoplay policy can
  // silently leave an AudioContext "suspended" (onaudioprocess never fires, no error)
  // if it's instead created later inside an async .then() callback, which is outside
  // that gesture. Creating and resuming it here, before anything async happens, avoids
  // that trap.
  const audioCtx = new AudioContext();
  void audioCtx.resume();

  const cleanup = () => {
    stream?.getTracks().forEach((t) => t.stop());
    void audioCtx.close();
    stream = null;
  };

  socket.onopen = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        void audioCtx.resume();
        // ScriptProcessorNode is deprecated but universally supported and far less
        // code than an AudioWorklet — fine for a short-lived push-to-talk capture.
        const source = audioCtx.createMediaStreamSource(s);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        const silence = audioCtx.createGain();
        silence.gain.value = 0; // processor must connect to a destination to fire, but must not be heard
        processor.onaudioprocess = (e) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          const down = downsampleTo16k(e.inputBuffer.getChannelData(0), audioCtx.sampleRate);
          const pcm = floatTo16BitPCM(down);
          socket.send(JSON.stringify({ event: "audio_input", audio: arrayBufferToBase64(pcm) }));
        };
        source.connect(processor);
        processor.connect(silence);
        silence.connect(audioCtx.destination);
      })
      .catch(() => {
        onError("Microphone access was blocked.");
        socket.close();
      });
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as {
        event?: string;
        text?: string;
        language?: string;
        message?: string;
      };
      if (msg.event === "transcript.partial" && msg.text) {
        onPartial?.((finalText + " " + msg.text).trim());
      } else if (msg.event === "transcript.final" && msg.text) {
        finalText = (finalText + " " + msg.text).trim();
        onPartial?.(finalText);
      } else if (msg.event === "error") {
        onError(msg.message || "Voice input failed — try again.");
      } else if (msg.event === "session.end") {
        // Sarvam doesn't always close the socket itself after this — close it from
        // our side so onclose (which reports the result) actually fires promptly.
        socket.close();
      }
    } catch {
      // Ignore malformed frames rather than crash the session.
    }
  };

  socket.onerror = () => {
    onError("Voice input failed — try again.");
  };

  socket.onclose = () => {
    cleanup();
    if (finalText) onResult(finalText);
    else if (!stopped) onError("Didn't catch that — try again.");
    onEnd();
  };

  return {
    stop: () => {
      stopped = true;
      cleanup();
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: "end" }));
      else socket.close();
    },
  };
}

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  currentAudio?.pause();
  currentAudio = null;
}

/** Speaks text aloud in the last language a customer spoke in (English by default),
 * via the backend's Sarvam proxy. Cancels anything already playing first. Fails
 * silently — a broken voice reply shouldn't break the (still-visible) text reply. */
export async function speak(text: string): Promise<void> {
  if (!isVoiceOutputSupported() || !text.trim()) return;
  const base = getApiBaseUrl();
  if (!base) return;
  try {
    const res = await fetch(`${base}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language_code: lastLanguageCode }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    stopSpeaking();
    const audio = new Audio(URL.createObjectURL(blob));
    currentAudio = audio;
    audio.onended = () => URL.revokeObjectURL(audio.src);
    await audio.play();
  } catch {
    // Silent — the text reply already rendered; a voice failure isn't worth surfacing.
  }
}
