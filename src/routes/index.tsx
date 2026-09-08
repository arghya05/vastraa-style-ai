import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Mic, Settings2, ShoppingBag, Sparkle, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CartPanel } from "@/components/vastraa/CartPanel";
import { UiBlock } from "@/components/vastraa/UiBlock";
import { setApiBaseUrl } from "@/lib/vastraa/config";
import {
  isVoiceInputSupported,
  isVoiceOutputSupported,
  startListening,
  stopSpeaking,
  type RecognitionHandle,
} from "@/lib/vastraa/speech";
import { useVastraaChat } from "@/lib/vastraa/useVastraaChat";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vastraa Stylist — Chat your way to the right outfit" },
      {
        name: "description",
        content:
          "Chat with the Vastraa AI stylist for kurtas, sarees, jeans and more. Get picks, comparisons and add to your bag without browsing.",
      },
      { property: "og:title", content: "Vastraa Stylist — Chat your way to the right outfit" },
      {
        property: "og:description",
        content: "An AI stylist for Vastraa apparel: personalised picks, comparisons and instant add-to-bag.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STARTERS = [
  "Show me cotton kurtas under ₹1500",
  "I need something for a wedding",
  "Compare your two best-selling jeans",
];

function Index() {
  const chat = useVastraaChat();
  const [input, setInput] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // Both start false so server and first client render agree; a mount-only effect
  // below flips them once the browser's real support is known, avoiding a hydration
  // mismatch (these APIs don't exist during SSR).
  const [micSupported, setMicSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<RecognitionHandle | null>(null);

  useEffect(() => {
    setMicSupported(isVoiceInputSupported());
    setSpeechSupported(isVoiceOutputSupported());
  }, []);

  useEffect(() => {
    setUrlDraft(chat.baseUrl);
    if (!chat.baseUrl) setShowSettings(true);
  }, [chat.baseUrl]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, chat.progress, chat.isStreaming]);

  const submit = (text: string) => {
    setInput("");
    void chat.sendMessage(text);
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    setVoiceError(null);
    setInput("");
    recognitionRef.current = startListening(
      (transcript) => submit(transcript),
      () => {
        setListening(false);
        recognitionRef.current = null;
      },
      (message) => {
        setVoiceError(message);
        setInput("");
      },
      // Live captioning: shows the in-progress transcript in the composer as the
      // customer speaks, so the mic reads as an active conversation, not a black box.
      (partial) => setInput(partial),
    );
    if (recognitionRef.current) setListening(true);
  };

  const saveUrl = () => {
    setApiBaseUrl(urlDraft);
    chat.setBaseUrl(urlDraft.trim().replace(/\/+$/, ""));
    setShowSettings(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Vastraa</h1>
          <span className="text-xs uppercase tracking-[0.2em] text-brand">Stylist</span>
        </div>
        <div className="flex items-center gap-2">
          {chat.session?.tier && (
            <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground sm:inline">
              {chat.session.name ? `${chat.session.name} · ` : ""}
              {chat.session.tier}
            </span>
          )}
          {speechSupported && (
            <button
              onClick={() => {
                if (chat.autoSpeak) stopSpeaking();
                chat.setAutoSpeak((v) => !v);
              }}
              aria-label={chat.autoSpeak ? "Mute the stylist's voice" : "Unmute the stylist's voice"}
              title={chat.autoSpeak ? "Voice replies on" : "Voice replies off"}
              className="rounded-full border border-border p-2 text-muted-foreground hover:bg-secondary"
            >
              {chat.autoSpeak ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
          )}
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Backend settings"
            className="rounded-full border border-border p-2 text-muted-foreground hover:bg-secondary"
          >
            <Settings2 className="size-4" />
          </button>
          <button
            onClick={() => setCartOpen(true)}
            aria-label="Open bag"
            className="relative rounded-full border border-border p-2 text-foreground hover:bg-secondary lg:hidden"
          >
            <ShoppingBag className="size-4" />
            {chat.cart.item_count > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
                {chat.cart.item_count}
              </span>
            )}
          </button>
          <div className="relative hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 lg:flex">
            <ShoppingBag className="size-4 text-foreground" />
            <span className="text-xs font-semibold text-foreground">{chat.cart.item_count}</span>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="border-b border-border bg-card px-4 py-3">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="base-url">
            Vastraa backend URL (your tunnel's HTTPS address)
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="base-url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://something.trycloudflare.com"
              className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={saveUrl}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {chat.connectionError && (
        <div className="mx-4 mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {chat.connectionError}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-4">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto pb-4">
            {chat.messages.length === 0 && (
              <div className="rounded-3xl border border-border bg-card/70 p-6">
                <Sparkle className="size-5 text-brand" />
                <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                  Tell me what you're dressing for.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Kurtas, sarees, denim, footwear — I'll pull the pieces, compare them, and drop your
                  favourites straight into the bag.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="rounded-full border border-brand/40 bg-background px-4 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chat.messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {msg.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
                    </div>
                  </div>
                );
              }
              if (msg.role === "error") {
                return (
                  <div
                    key={msg.id}
                    className="max-w-[85%] rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                  >
                    {msg.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
                  </div>
                );
              }
              return (
                <div key={msg.id} className="space-y-3">
                  {msg.parts.map((part, i) =>
                    part.type === "text" ? (
                      <p
                        key={i}
                        className="max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                      >
                        {part.text}
                      </p>
                    ) : (
                      <UiBlock key={i} part={part} onAdd={chat.addToCart} />
                    ),
                  )}
                </div>
              );
            })}

            {chat.isStreaming && (
              <div className="space-y-1.5">
                {chat.activities.length > 0 ? (
                  chat.activities.map((activity) => (
                    <p
                      key={activity.id}
                      className="flex items-center gap-2 text-sm italic text-muted-foreground"
                    >
                      <span className="size-1.5 animate-pulse rounded-full bg-jewel" />
                      {activity.label}
                    </p>
                  ))
                ) : (
                  <p className="flex items-center gap-2 text-sm italic text-muted-foreground">
                    <span className="inline-flex gap-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:0ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:120ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:240ms]" />
                    </span>
                    {chat.progress ?? "Stylist is typing…"}
                  </p>
                )}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {voiceError && (
            <p className="mb-1 px-2 text-xs text-destructive">{voiceError}</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="sticky bottom-4 flex items-end gap-2 rounded-3xl border border-border bg-card p-2 shadow-sm"
          >
            {micSupported && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={chat.isStreaming}
                aria-label={listening ? "Stop recording" : "Speak your request"}
                title={listening ? "Listening… tap to stop" : "Speak your request"}
                className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
                  listening
                    ? "animate-pulse border-destructive bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                <Mic className="size-4" />
              </button>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              rows={1}
              placeholder={listening ? "Listening…" : "Ask for kurtas, sarees, denim…"}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim() || chat.isStreaming}
              aria-label="Send message"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <ArrowUp className="size-4" />
            </button>
          </form>
        </main>

        <aside className="hidden w-80 shrink-0 self-start rounded-3xl border border-border bg-sidebar lg:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          <CartPanel cart={chat.cart} />
        </aside>
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-30 flex justify-end bg-foreground/30 lg:hidden">
          <div className="h-full w-80 max-w-[85vw] bg-sidebar">
            <div className="flex justify-end p-2">
              <button
                onClick={() => setCartOpen(false)}
                aria-label="Close bag"
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="h-[calc(100%-3rem)]">
              <CartPanel cart={chat.cart} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
