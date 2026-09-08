# Vastraa Style Chat

Here's the prompt — copy everything in the block below into Lovable (swap <YOUR_BACKEND_URL> for your tunnel's HTTPS URL first, e.g. from cloudflared tunnel --url http://localhost:8000):

Build a chat-first shopping assistant web app for "Vastraa", a fictional Indian apparel

brand (kurtas, sarees, jeans, shirts, footwear, activewear, kidswear). It is NOT

e-commerce with browsing-first UX — the primary interaction is a chat conversation with

an AI stylist that shows product cards, comparisons, and a cart inline as it replies. No

checkout or payment flow is needed — the flow ends at "added to cart".

## Screens / layout

Single page, two-pane desktop layout (stacked on mobile):

- Left/main pane: chat transcript + message composer at the bottom. Show a suggested

  starter prompt or two on first load (e.g. "Show me cotton kurtas under ₹1500", "I need

  something for a wedding").

- Right pane (or a slide-over drawer on mobile): cart summary — line items with image,

  title, size/color (option_values), quantity, price, a running subtotal, and item count.

  A small cart icon with a badge count should also live in the header.

Within the chat transcript, render structured content inline with the assistant's text,

not just plain text:

- Product results → a horizontal-scrolling card carousel (or a grid — see `layout` field

  below): each card shows image, tid in INR, rating, and an

  "Add to cart" button.

- Product comparisons → a side-by-s showing each product's

  pros/cons and a "best for" line, with the recommended one visually highlighted.

- A lightweight streaming indicatoryping".

## Backend API contract

Base URL: `<YOUR_BACKEND_URL>` — purable constant/env var, not

hardcoded in multiple places, since it'll change when the backend is redeployed.

All requests are JSON. All endpoints are under the base URL directly (e.g.

`<YOUR_BACKEND_URL>/api/session`).

### 1. Start a session (call once o

`POST /api/session`, body `{}` (no

Response:

```json

{"session_id": "abc123...", "user_iPriya", "tier": "Vastraa Plus

member"}

Store session_id in localStorage. Every other request below must include it as a

header: X-Session-Id: <session_id>., call /api/session

again and retry with the new id.

2. Chat — send a message, get a streamed reply

POST /api/chat, headers {"Content-Type": "application/json", "X-Session-Id": "..."},

body {"message": "show me cotton ku

The response is text/event-stream (it must be read with a

raw fetch() + response.body.getReader(), NOT the browser's EventSource API,

because EventSource can't send a PO both of which are

required here. Read the stream, decode it as text, split on double-newlines into frames,

and parse each frame's event: line  line (JSON payload).

Each frame looks like:

event: text_delta

data: {"text": "Here are a few cott

Event types to handle, and what to do with each (unknown types should be ignored, not

crash the UI):

- text_delta — {"text": string}. Aprrent streaming message

  bubble.

- ui — {"component": string, "paylotured content:

  - component === "present_products": payload is

    {"title"?: string, "layout": "ctems": [{"product": {...},

    "reason"?: string}]}.

    Render one card per item from ihape below); layout

    hints whether to lay the cards out as a carousel, grid, or list.

  - component === "present_comparis

    {"title"?: string, "dimensions": string[], "recommended_product_id"?: string, "entries":

    [{"product_id": string, "pros":], "best_for"?: string, "product":

    {...}}], "price_delta"?: {"amount": number, "low_product_id": string, "low_price": number,

    "high_product_id": string, "hig

    Render a comparison card per entry; highlight the one matching

    recommended_product_id.

  - Any other component value: render its payload as a simple text/JSON fallback

    card rather than breaking.

- cart_update — {"cart": {"items": [...], "item_count": number, "subtotal": number, "currency":

  "INR"}}.

  Replace the cart panel's state with this. Each cart item has

  {product_id, title, price, quanties, variant_of, line_total}.

- progress — {"message": string}. Show as a transient status line ("Searching the

  catalog...") in place of the typiaced by the next event.

- turn_complete — {"stop_reason": string, ...}. Stop the streaming/typing indicator;

  the turn is done.

- error — {"message": string}. Show this message as an inline error bubble in the

  transcript (these are already wrirectly to the user).

- tool_call / tool_result — internal bookkeeping events; safe to ignore in the UI, or

  optionally show a subtle "Vastraaile a tool_call is

  in-flight until its matching tool_result arrives.

Product shape (appears inside present_products/present_comparison payloads and cart

items reference its product_id):

{

  "product_id": "VS-2002-M",

  "title": "Vastraa Straight Cotton Kurta",

  "brand": "Vastraa",

  "price": 999.0,

  "currency": "INR",

  "rating": 4.2,

  "review_count": 1340,

  "image_url": "https://...",

  "category": "womens-kurtas",

  "labels": ["bestseller"],

  "attributes": {"fabric": "cotton"r": "mustard"},

  "in_stock": true,

  "short_description": "Everyday stbreathable cotton.",

  "options": {},

  "option_values": {"size": "M"},

  "variant_of": "VS-2002"

}

Format price/currency with Intl.NumberFormat('en-IN', {style: 'currency', currency:

product.currency}) so it renders as non-empty options

object is a "family" (e.g. sizes S–XXL) — don't show a bare "Add to cart" button for it

in a card; if you want to support iadds the specific

variant's product_id instead (each size is its own product_id, already shown

individually in normal search resuljust treat every card as a

single addable product and skip family cards entirely).

3. Add to cart (the card's "Add to cart" button)

POST /api/cart/add, headers include X-Session-Id, body

{"product_id": "VS-2002-M", "quanti

{"ok": true, "cart": {...same shape as cart_update.cart...}}.

Important: this only works for a product_id that has already appeared in a ui event

during the current session's chat (nd — it refuses ids the

assistant hasn't actually shown). If the button returns a 400 with a detail message,

show that message as a small inlineher than failing silently.

4. Read-only helpers (optional, nic

- GET /api/cart (header X-Session-Iape as above. Useful to

  restore the cart panel on page reload without re-sending the whole chat history.

- GET /api/products?category=womenscts": [...]}, no session

  header needed. Not required for the chat flow, but usable for a "browse all" fallback

  view if you want one.

- GET /api/orders (header X-Session-Id) → {"orders": [...]}, useful only if you add

  an order-history view later (not

Non-goals for this build

No checkout, no payment form, no losion is anonymous and

started automatically). Don't build any of these — stop at "item added to cart".

Visual style

Warm, modern Indian fashion-retail feel — not corporate. Vastraa's palette can lean into

warm earthy or jewel tones (terracoather than a generic blue

SaaS look. Keep the chat transcript the visual centerpiece; the cart panel should feel

secondary/supporting.

This is also saved at `docs/lovable reference it later. Once you've got the backend running and tunneled (per `README.md`), swap in the real URL and paste this in.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f6951985-b879-468b-8b51-018ad014eb49).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
