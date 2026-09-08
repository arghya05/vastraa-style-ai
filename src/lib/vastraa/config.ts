const STORAGE_KEY = "vastraa_api_base_url";

const envBase = (import.meta.env['VITE_VASTRAA_API_BASE_URL'] as string | undefined) ?? "";

function normalize(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalize(stored);
  }
  return normalize(envBase);
}

export function setApiBaseUrl(url: string) {
  if (typeof window === "undefined") return;
  const next = normalize(url);
  if (next) window.localStorage.setItem(STORAGE_KEY, next);
  else window.localStorage.removeItem(STORAGE_KEY);
}

export const SESSION_STORAGE_KEY = "vastraa_session_id";
