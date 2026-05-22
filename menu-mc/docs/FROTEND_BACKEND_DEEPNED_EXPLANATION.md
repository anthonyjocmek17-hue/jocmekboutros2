# Frotend Backend Deepned Explanation — Menu MC

This file is a **deeper technical appendix** to `docs/SYSTEM_BACKEND_AND_FRONTEND.md`.

It focuses on:

- exact validation rules (Zod schemas / server parsing behavior)
- detailed status codes + edge cases
- security model (what is enforced where)
- performance characteristics and trade-offs

## 1) Security and authorization model (where enforcement happens)

There are two layers of protection:

### A) Route-level access control (middleware)

File: `middleware.ts`

- `/admin/**` requires `role === "ADMIN"`
- `/kitchen/**` requires `role === "KITCHEN" || role === "ADMIN"`
- `/waiter/**` requires `role === "WAITER" || role === "ADMIN"`

This prevents unauthorized users from even reaching those pages/routes.

### B) Backend handler checks (defense in depth)

Even with middleware, each backend entry point checks:

- `getServerSession(authOptions)` exists → otherwise **401**
- role is correct for that endpoint (table checkout, kitchen patch, waiter create) → otherwise **403**

This matters because:

- APIs can be called directly (not only through pages)
- middleware matchers may not cover every API path if patterns change later

## 2) Validation details (Zod + parsing)

### Table checkout — `POST /api/orders`

File: `app/api/orders/route.ts`

Zod shape (conceptual):

```ts
{
  note?: string | "",
  voucherCode?: string | "",
  lines: Array<{
    menuItemId: string,
    name: string,
    price: string | null,
    quantity: number (int 1..99)
  }> (min length 1)
}
```

Important server-side rules:

- The client provides `lines[].name/price`, but the server:
  - **validates** `menuItemId` exists and is available
  - then **persists live menu values** (`MenuItem.name`, `MenuItem.price`)
- Availability enforced at order time:
  - `isAvailable === true`
  - `isOutOfStock === false`

### Kitchen status — `PATCH /api/kitchen/orders`

File: `app/api/kitchen/orders/route.ts`

Zod shape:

```ts
{
  id: string,
  next: "NEW" | "IN_PROGRESS" | "READY" | "COMPLETED" | "CANCELLED"
}
```

Notes:

- Handler updates timestamps based on `next`:
  - IN_PROGRESS → `startedAt = now`
  - READY → `readyAt = now`
  - COMPLETED → `completedAt = now`
- No strict “previous state” validation is enforced; it trusts the kitchen UI workflow.

### Waiter manual order — `POST /api/waiter/orders`

File: `app/api/waiter/orders/route.ts`

Zod shape (conceptual):

```ts
{
  tableId: string,
  note?: string | "",
  voucherCode?: string | "",
  manualDiscount?: string | number,
  lines: Array<{ menuItemId: string, quantity: number (int 1..99) }> (min length 1)
}
```

Key parsing behaviors:

- `manualDiscount` is treated as **dollars** and converted via `parsePriceToCents`.
- `manualDiscountCents` is clamped after voucher:
  - remaining = total - voucherDiscount
  - manualDiscountCents = min(remaining, manualDiscountCents)

### Admin bill server actions (FormData)

File: `app/admin/orders/actions.ts`

Why these actions parse `FormData` directly:

- In practice, browser `FormData` can be inconsistent with optional fields (missing vs empty string).
- Parsing directly allows “empty string clears override” or “missing means unchanged” semantics.

Actions:

- `saveBillDiscounts(formData)`
  - reads: `orderId`, `voucherCode`, `manualDiscount`
  - stores the fields and runs `recomputeOrderTotals(orderId)`
  - does **not** modify `finalTotalOverrideCents`
- `saveBillFinal(formData)`
  - reads: `orderId`, `finalPriceOverride`
  - empty string → clears override (`null`)
  - does **not** modify voucher/manual discount fields

## 3) Status codes and error payloads (per endpoint)

### `/api/orders` (table checkout)

- **401**: `{ "error": "Unauthorized" }`
- **403**: `{ "error": "Only tables can place orders" }`
- **400**:
  - `{ "error": "Invalid payload" }`
  - `{ "error": "No table assigned to this login" }`
  - `{ "error": "One or more items are unavailable" }`
- **500**:
  - `{ "error": "Server error creating order. If you recently updated the schema, run prisma migrate. (...)" }`

Edge cases:

- Voucher usage increment is best-effort; order still succeeds if increment fails.
- ETA is a simple additive model (sum of prep times), not a queueing simulation.

### `/api/kitchen/orders`

- **GET**
  - **401**: plain text `"Unauthorized"`
  - **200**: `{ "orders": [...] }` (latest 50)
- **PATCH**
  - **401**: `"Unauthorized"`
  - **400**: `"Invalid payload"`
  - **200**: `{ "ok": true }`

### `/api/waiter/orders` (manual creation)

- **401**: `{ "error": "Unauthorized" }`
- **403**: `{ "error": "Forbidden" }`
- **400**:
  - `{ "error": "Invalid payload" }`
  - `{ "error": "Unknown table" }`
  - `{ "error": "One or more items are unavailable" }`
- **200**: `{ "id": "<orderId>" }`

### `/api/table/order`

- **401**: plain text `"Unauthorized"`
- **403**: plain text `"Forbidden"`
- **200**: `{ "order": <Order|null> }`

## 4) Performance notes (what the code currently does)

### Query limits (intentional)

- Kitchen list: `take: 50` orders (`app/api/kitchen/orders/route.ts`)
- Admin orders view: `take: 100` orders (`app/admin/orders/page.tsx`)

### Bill recomputation cost

Admin bill editing recomputes totals after every line change:

- reads all `OrderItem[]` for the order
- recomputes subtotal, voucher discount, clamped manual discount
- applies final override precedence if set

This is appropriate for small tickets; if orders become very large, you’d consider:

- computing per-line delta updates, or
- maintaining cached sums updated transactionally

### Polling vs push

Kitchen/table tracking views typically poll to refresh state.

For a more scalable deployment you would consider:

- server-sent events (SSE)
- websockets
- a message queue / pub-sub for kitchen “READY” notifications

## 5) “Bill math” truth table (summary)

Let:

- subtotal = `totalCents`
- voucher = `voucherDiscountCents`
- manual = clamped `manualDiscountCents`
- override = `finalTotalOverrideCents` (nullable)

Then:

- if `override != null` → `finalTotalCents = max(0, override)`
- else → `finalTotalCents = max(0, subtotal - voucher - manual)`

