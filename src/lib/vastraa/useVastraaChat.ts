import { useCallback, useEffect, useRef, useState } from "react";
import { addToCart, createSession, ensureSession, fetchCart, streamChat } from "./client";
import { getApiBaseUrl } from "./config";
import type { Cart, ChatMessage, MessagePart, SessionInfo } from "./types";

let idCounter = 0;
const nextId = () => `m${++idCounter}-${Date.now()}`;

export type Activity = { id: string; label: string };

// Friendly labels for the live activity trail; falls back to the tool name when a tool
// isn't listed here, so a new backend tool never breaks the UI.
const TOOL_LABELS: Record<string, string> = {
  search_products: "Searching the catalog…",
  get_product_details: "Looking up product details…",
  get_cart: "Checking your bag…",
  add_to_cart: "Adding to your bag…",
  update_cart_item: "Updating your bag…",
  remove_from_cart: "Updating your bag…",
  get_orders: "Checking your orders…",
  get_order_status: "Checking your order status…",
  search_policies: "Checking store policies…",
  get_fulfillment_options: "Checking delivery options…",
  save_memory: "Remembering that for next time…",
  recall_memories: "Checking what I remember about you…",
  present_products: "Preparing product cards…",
  present_comparison: "Building the comparison…",
  present_plan: "Putting together a plan…",
  present_guide: "Writing a buying guide…",
  present_order_status: "Preparing your order status…",
  checkout: "Preparing checkout…",
  present_suggestions: "Thinking of follow-ups…",
  present_disclosure: "Pulling up the details…",
  web_search: "Searching the web…",
};

function labelFor(tool: string, explicitLabel?: string): string {
  return explicitLabel || TOOL_LABELS[tool] || `Using ${tool}…`;
}

export function useVastraaChat() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cart, setCart] = useState<Cart>({ items: [], item_count: 0, subtotal: 0, currency: "INR" });
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>("");
  const sessionRef = useRef<SessionInfo | null>(null);

  useEffect(() => {
    setBaseUrl(getApiBaseUrl());
  }, []);

  const boot = useCallback(async () => {
    if (!getApiBaseUrl()) return;
    try {
      const info = await ensureSession();
      sessionRef.current = info;
      setSession(info);
      setConnectionError(null);
      const existingCart = await fetchCart(info.session_id);
      if (existingCart) setCart(existingCart);
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : "Could not reach the Vastraa backend.");
    }
  }, []);

  useEffect(() => {
    if (baseUrl) void boot();
  }, [baseUrl, boot]);

  const appendToAssistant = useCallback((id: string, part: MessagePart) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== id) return msg;
        const parts = [...msg.parts];
        const last = parts[parts.length - 1];
        if (part.type === "text" && last && last.type === "text") {
          parts[parts.length - 1] = { type: "text", text: last.text + part.text };
        } else {
          parts.push(part);
        }
        return { ...msg, parts };
      }),
    );
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isStreaming) return;

      let info = sessionRef.current;
      if (!info) {
        try {
          info = await createSession();
          sessionRef.current = info;
          setSession(info);
        } catch (err) {
          setConnectionError(err instanceof Error ? err.message : "Could not start a session.");
          return;
        }
      }

      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", parts: [{ type: "text", text: content }] },
        { id: assistantId, role: "assistant", parts: [] },
      ]);
      setIsStreaming(true);
      setProgress(null);
      setActivities([]);

      try {
        for await (const frame of streamChat(content, info.session_id, (fresh) => {
          sessionRef.current = fresh;
          setSession(fresh);
        })) {
          const data = (frame.data ?? {}) as Record<string, unknown>;
          switch (frame.event) {
            case "text_delta": {
              const t = typeof data['text'] === "string" ? (data['text'] as string) : "";
              if (t) {
                setProgress(null);
                appendToAssistant(assistantId, { type: "text", text: t });
              }
              break;
            }
            case "ui": {
              setProgress(null);
              appendToAssistant(assistantId, {
                type: "ui",
                component: String(data['component'] ?? "unknown"),
                payload: data['payload'],
              });
              break;
            }
            case "cart_update": {
              const c = data['cart'] as Cart | undefined;
              if (c) setCart(c);
              break;
            }
            case "progress": {
              setProgress(typeof data['message'] === "string" ? (data['message'] as string) : null);
              break;
            }
            case "tool_call": {
              const tool = typeof data['tool'] === "string" ? (data['tool'] as string) : "unknown";
              const id = typeof data['id'] === "string" ? (data['id'] as string) : nextId();
              const explicitLabel = typeof data['label'] === "string" ? (data['label'] as string) : undefined;
              setActivities((prev) => [...prev, { id, label: labelFor(tool, explicitLabel) }]);
              break;
            }
            case "tool_result": {
              const id = typeof data['id'] === "string" ? (data['id'] as string) : null;
              setActivities((prev) => (id ? prev.filter((a) => a.id !== id) : prev));
              break;
            }
            case "error": {
              const msg =
                typeof data['message'] === "string"
                  ? (data['message'] as string)
                  : "Something went wrong.";
              setMessages((prev) => [
                ...prev,
                { id: nextId(), role: "error", parts: [{ type: "text", text: msg }] },
              ]);
              break;
            }
            case "turn_complete":
              setProgress(null);
              setActivities([]);
              break;
            default:
              break;
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "error",
            parts: [
              {
                type: "text",
                text: err instanceof Error ? err.message : "The stylist couldn't be reached.",
              },
            ],
          },
        ]);
      } finally {
        setIsStreaming(false);
        setProgress(null);
        setActivities([]);
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantId || m.parts.length > 0),
        );
      }
    },
    [appendToAssistant, isStreaming],
  );

  const add = useCallback(async (productId: string, quantity = 1) => {
    const info = sessionRef.current;
    if (!info) return { ok: false as const, error: "No active session yet." };
    try {
      const { cart: nextCart } = await addToCart(info.session_id, productId, quantity);
      if (nextCart) setCart(nextCart);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Could not add item." };
    }
  }, []);

  return {
    session,
    messages,
    cart,
    isStreaming,
    progress,
    activities,
    connectionError,
    baseUrl,
    setBaseUrl,
    sendMessage,
    addToCart: add,
    reconnect: boot,
  };
}
