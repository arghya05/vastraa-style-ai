import { getApiBaseUrl, SESSION_STORAGE_KEY } from "./config";
import type { Cart, SessionInfo } from "./types";

export type StreamFrame = { event: string; data: unknown };

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function requireBase() {
  const base = getApiBaseUrl();
  if (!base) throw new Error("No backend URL is set yet.");
  return base;
}

export async function createSession(): Promise<SessionInfo> {
  const res = await fetch(`${requireBase()}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new ApiError(`Could not start a session (${res.status}).`, res.status);
  const info = (await res.json()) as SessionInfo;
  if (typeof window !== "undefined") window.localStorage.setItem(SESSION_STORAGE_KEY, info.session_id);
  return info;
}

export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

export async function ensureSession(): Promise<SessionInfo> {
  const existing = getStoredSessionId();
  if (existing) return { session_id: existing };
  return createSession();
}

async function detailMessage(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { detail?: string; message?: string };
    return body.detail || body.message || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchCart(sessionId: string): Promise<Cart | null> {
  const res = await fetch(`${requireBase()}/api/cart`, {
    headers: { "X-Session-Id": sessionId },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { cart?: Cart } & Partial<Cart>;
  return (body.cart ?? (body as Cart)) || null;
}

export async function addToCart(
  sessionId: string,
  productId: string,
  quantity = 1,
): Promise<{ cart: Cart }> {
  const res = await fetch(`${requireBase()}/api/cart/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
    body: JSON.stringify({ product_id: productId, quantity }),
  });
  if (!res.ok) {
    throw new ApiError(await detailMessage(res, `Couldn't add that item (${res.status}).`), res.status);
  }
  const body = (await res.json()) as { ok?: boolean; cart: Cart };
  return { cart: body.cart };
}

/** Streams chat frames. Retries once with a fresh session on 401/403/404. */
export async function* streamChat(
  message: string,
  sessionId: string,
  onSessionRefresh: (info: SessionInfo) => void,
): AsyncGenerator<StreamFrame> {
  const base = requireBase();

  const send = (sid: string) =>
    fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify({ message }),
    });

  let res = await send(sessionId);
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    const info = await createSession();
    onSessionRefresh(info);
    res = await send(info.session_id);
  }

  if (!res.ok || !res.body) {
    throw new ApiError(await detailMessage(res, `The stylist is unavailable (${res.status}).`), res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const raw of frames) {
      const frame = parseFrame(raw);
      if (frame) yield frame;
    }
  }
  const last = parseFrame(buffer);
  if (last) yield last;
}

function parseFrame(raw: string): StreamFrame | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let event = "message";
  const dataLines: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  const dataText = dataLines.join("\n");
  if (!dataText) return { event, data: null };
  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: dataText };
  }
}
