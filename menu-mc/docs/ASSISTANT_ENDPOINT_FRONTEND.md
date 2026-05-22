# Frontend Integration Guide — `POST /assistant/chat`

This document explains what the frontend needs to know to call the “fake AI” menu assistant endpoint.

## What it does

When the frontend sends a customer message, the backend:

1. Reads all Markdown files in `knowledge-base/*.md`.
2. Normalizes the user message and menu text (lowercase, remove punctuation, split into words).
3. Scores paragraphs by word overlap.
4. Picks the best matching paragraph and returns it as a friendly reply.

Important constraints:

- The reply is generated **only from the local Markdown knowledge base**.
- If nothing matches, it returns a fixed fallback sentence (see below).
- No external AI APIs are used.

## Endpoint

- **Method**: `POST`
- **Path**: `/assistant/chat`
- **Content-Type**: `application/json`

## Request body

```json
{
  "message": "Do you have chicken sandwiches?"
}
```

### Field rules

- `message`:
  - required
  - string
  - 1–1000 characters

## Response body (success)

```json
{
  "reply": "Yes, we have chicken sandwiches. The Crispy Chicken Sandwich comes with...",
  "matchedFiles": ["sandwiches.md"]
}
```

### Response fields

- `reply` (string)
  - A conversational answer derived from the best matching menu paragraph.
  - The backend strips most Markdown formatting before returning.
- `matchedFiles` (string[])
  - The knowledge-base Markdown filename(s) used to answer.
  - Currently this endpoint returns the single best file match (one element array).

## Response body (fallback)

If no paragraph matches the message well enough, the endpoint returns:

```json
{
  "reply": "I’m not seeing that on the menu right now, but I can help you find something else.",
  "matchedFiles": []
}
```

Frontend behavior recommendation:

- Treat this as a normal 200 OK response and display it as the assistant reply.

## Error responses

### 400 Invalid payload

If the body is missing `message` or it’s empty/too long:

```json
{ "error": "Invalid payload" }
```

Status code: `400`

## Example calls

### `fetch` from the browser

```ts
async function askAssistant(message: string) {
  const res = await fetch("/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });

  if (!res.ok) {
    // You can show a toast or inline error here.
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Request failed (${res.status})`);
  }

  return (await res.json()) as { reply: string; matchedFiles: string[] };
}
```

### `curl` (local dev)

```bash
curl -X POST http://localhost:3000/assistant/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Do you have chicken sandwiches?\"}"
```

## How matching works (practical notes for UI)

The backend works best when the customer message includes a few menu keywords, e.g.:

- “burger”, “chicken”, “wrap”, “dessert”, “opening hours”, “allergens”

If a message is vague (e.g. “what do you have?”), the endpoint may match a generic paragraph or fall back.

## Knowledge base content (what the assistant is allowed to say)

Folder:

- `knowledge-base/`

Files:

- `burgers.md`
- `sandwiches.md`
- `drinks.md`
- `desserts.md`
- `specials.md`
- `allergens.md`
- `opening-hours.md`

To update what the assistant can answer, edit these `.md` files.

## Implementation location (for developers)

Backend code:

- `app/assistant/chat/route.ts`

Runtime:

- Node.js (`export const runtime = "nodejs";`) because it reads local files via `fs`.

