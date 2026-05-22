# Frontend (Detailed) — Menu MC

This document explains the **frontend UI** (screens, components, client state, and user flows).

## Tech + structure

- **Framework**: Next.js App Router (React)
- **Styling**: Tailwind CSS
- **Session context**: `next-auth` client provider
- **Cart state**: client-side provider + persistence (localStorage)

Key layout/providers:

- `app/layout.tsx`: global shell (nav, footer) and server session handoff into the client provider tree.
- `app/providers.tsx`: wraps the app in:
  - `SessionProvider` (NextAuth)
  - `ToastProvider` (UI feedback)
  - `CartProvider` (cart state)

## Navigation + pages

### Public menu

- **Route**: `app/page.tsx`
- **Goal**: browse items by category, add to cart, then check out.

UI concepts:

- Category “tabs” rendered as a row of buttons/links.
- Menu item cards show name/description/price and availability/out-of-stock state.
- “Add to cart” triggers cart state updates and UI feedback.

Main supporting UI:

- `components/AppNav.tsx`: navigation links appropriate for roles.
- `components/cart/FloatingCartBar.tsx`: persistent cart summary/action (appears when cart has items).
- `app/cart/page.tsx`: cart edit view (quantity adjustments, remove lines).

### Checkout

- **Route**: `app/cart/page.tsx` (checkout action typically initiated here)
- **Inputs**:
  - cart line items (from `CartProvider`)
  - optional note
  - optional voucher code
- **Result**: creates an order and navigates to the table’s order tracking screen.

#### API call used by checkout

- Endpoint: `POST /api/orders` (`app/api/orders/route.ts`)
- Payload fields:
  - `lines[]`: `{ menuItemId, name, price, quantity }` (server validates `menuItemId` and uses live menu prices)
  - `note`: optional
  - `voucherCode`: optional

Client responsibilities:

- Convert cart lines into `lines[]`.
- Handle common failures:
  - `401/403`: session/role problem (table must be logged in)
  - `400`: invalid payload or unavailable menu items
  - `500`: schema mismatch (migration not run)

UX behaviors:

- Shows computed totals (subtotal + any discount impact once applied).
- Displays API errors as toast/inline messaging.

### Table order tracking

- **Route**: `app/order/page.tsx` (and/or table status routes under `app/table/...` depending on build)
- **Goal**: show order status transitions (NEW → IN_PROGRESS → READY → COMPLETED) and ETA if present.

### Kitchen screen

- **Route**: `app/kitchen/**`
- **Goal**: a “production view” with active orders and a simple workflow to advance statuses.

Frontend behaviors:

- Polls kitchen orders endpoint periodically.
- Buttons advance status and optimistically refresh list.

### Waiter screen

- **Route**: `app/waiter/page.tsx`
- **Goal**: mark orders paid/unpaid, create manual orders, and view basic totals (admin-only KPIs).

### Admin screens

#### Admin menu builder (categories + items)

- **Routes**:
  - `app/admin/items/page.tsx`: category switch + menu builder UI
  - `app/admin/items/ui/AdminMenuBuilder.tsx`: primary admin builder component

Key UI responsibilities:

- Category selection (via query param `?categoryId=...`).
- Item CRUD (create/delete/toggle availability/out-of-stock, set prep time).
- Reorders/sorting controls where supported.

#### Admin orders (bill editing)

- **Route**: `app/admin/orders/page.tsx`
- **Goal**: edit bills directly:
  - edit individual line items (name/price/qty)
  - add ad-hoc lines
  - delete lines
  - save discounts (voucher + manual)
  - set/clear a custom final price
  - edit metadata (status/note/paid)

Important UI design choices:

- Each bill is rendered as a standalone **block** (not one mega table), because HTML form submission + Server Actions are unreliable when forms are nested inside `<table>` rows.
- Discount and final-price saves are separated into two forms so they can be updated **independently**.

#### Bill editing UI layout (what’s on the page)

Route: `app/admin/orders/page.tsx`

Each order renders as a **bill block** with:

- **Order header**: table label, status, timestamps, item count, and an “order meta” form (status/note/paid).
- **Discounts form**: voucher code + manual discount + “Save discounts”.
- **Final price form**: custom final charged total + “Save final price”.
- **Line items table**:
  - each row can be saved/deleted
  - a final “Add line” row creates ad-hoc lines (not linked to a menu item)
- **Bill totals**: read-only view of subtotal and stored totals/final.

Why this layout:

- Discount/final forms are **not inside the line-items `<table>`**, because form submission + Server Actions can be unreliable when nested inside table rows across browsers.

Scroll/return-to-bill:

- `app/admin/orders/AdminOrdersScrollRestore.tsx`: after a save, server actions redirect to
  ` /admin/orders?bill=<orderId>&part=<section> `
  and this component scrolls back to the relevant bill section, then cleans the URL.

Return-to-bill details:

- Redirect URLs are built in `app/admin/orders/nav.ts` by `adminOrdersReturnUrl(...)`.
- Sections supported:
  - `part=meta` (order status/note/paid)
  - `part=discounts` (voucher/manual)
  - `part=final` (final override)
  - `part=lines` (+ optional `row=<orderItemId>` to return to the edited row)
  - `part=add` (add line section)

## Client state

### Cart state

- **Provider**: `components/cart/useCart` (CartProvider + hook)
- **Persistence**: localStorage (so refresh doesn’t wipe cart)
- **Data**: list of cart lines (menu item id/name/price/qty) + derived totals

Common operations:

- add item
- remove item
- increment/decrement qty
- clear cart after successful order

### Session state

- **Provider**: `SessionProvider` from `next-auth/react` in `app/providers.tsx`
- **Pattern used**: `app/layout.tsx` fetches the session server-side and passes it to the provider to avoid noisy initial client session fetches.

## UI feedback patterns

- Toasts for success/failure.
- Disabled buttons/spinners during submits (where applicable).
- “Stored total/final” summary for bills to show persisted values after recomputation.

## How frontend ties to server actions + routes

Frontend submits data either via:

- **Server Actions**: forms with `action={...}` on admin pages (fast, simple, no client fetch boilerplate).
- **Route handlers**: `fetch(...)` from client for table checkout/order tracking flows.

Admin bill editing uses server actions in:

- `app/admin/orders/actions.ts`

Server actions used by admin orders UI:

- `updateOrder` (order meta)
- `saveBillDiscounts` (voucher + manual)
- `saveBillFinal` (final override)
- `updateOrderLine`, `deleteOrderLine`, `addOrderLine` (line edits)

## Glossary (UI terms)

- **Bill**: an `Order` plus its `OrderItem[]` lines and applied discounts/final override.
- **Manual discount**: a dollar amount applied after voucher discount, clamped so totals never go below zero.
- **Final price override**: a manually set charged total that takes precedence over computed final.

