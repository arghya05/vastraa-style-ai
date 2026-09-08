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

/** Records from the mic until stop() is called, then transcribes the clip via the
 * backend's Sarvam proxy. onResult fires once with the transcript; onEnd always
 * fires after (success or failure) so the caller can reset its "listening" state. */
export function startListening(
  onResult: (transcript: string) => void,
  onEnd: () => void,
  onError: (message: string) => void,
): RecognitionHandle | null {
  if (!isVoiceInputSupported()) {
    onError("Voice input isn't supported in this browser.");
    return null;
  }

  let cancelled = false;
  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void transcribe(new Blob(chunks, { type: "audio/webm" }), onResult, onError).finally(onEnd);
      };
      recorder.start();
    })
    .catch(() => {
      onError("Microphone access was blocked.");
      onEnd();
    });

  return {
    stop: () => {
      cancelled = true;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    },
  };
}

async function transcribe(
  audio: Blob,
  onResult: (transcript: string) => void,
  onError: (message: string) => void,
): Promise<void> {
  if (audio.size < 500) {
    onError("Didn't catch that — try again.");
    return;
  }
  const base = getApiBaseUrl();
  if (!base) {
    onError("Set the backend URL first.");
    return;
  }
  try {
    const form = new FormData();
    form.append("file", audio, "speech.webm");
    const res = await fetch(`${base}/api/voice/stt`, { method: "POST", body: form });
    if (!res.ok) {
      onError(res.status === 503 ? "Voice isn't set up on the backend yet." : "Voice input failed — try again.");
      return;
    }
    const body = (await res.json()) as { transcript?: string; language_code?: string };
    if (body.language_code) lastLanguageCode = body.language_code;
    if (body.transcript?.trim()) onResult(body.transcript.trim());
    else onError("Didn't catch that — try again.");
  } catch {
    onError("Voice input failed — try again.");
  }
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
