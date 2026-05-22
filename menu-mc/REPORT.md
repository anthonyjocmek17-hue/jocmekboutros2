# Project Report — Menu MC

## 1. Executive summary
**Menu MC** is a full-stack web application that digitizes the menu and order workflow of a small food-service business. It serves customers (browsing the menu, building a cart, ordering from their table) and staff (waiters, kitchen, and administrators) from a single Next.js application backed by a SQLite database. The system additionally exposes an in-page **chat assistant** that answers menu questions and recommends items based on the customer’s cart or active order.

The codebase is approximately 30+ application files across UI pages, server actions, REST handlers, and shared libraries, and is implemented in TypeScript on Next.js 15 (App Router) with React 19.

---

## 2. Technology stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 15.5** (App Router, React Server Components, server actions, route handlers) |
| Language | **TypeScript 5.9** |
| UI / Styling | **React 19**, **Tailwind CSS 3.4**, custom theming (`ThemeSwitch`, dark mode) |
| Authentication | **NextAuth 4** (credentials provider, role-based session) |
| Persistence | **Prisma 6** ORM over **SQLite** (`file:./dev.db`) |
| Validation | **Zod 4** |
| Password hashing | **bcryptjs** |
| AI integration (optional) | OpenAI Chat Completions or Anthropic Messages, behind a thin provider abstraction |
| Tooling | ESLint, PostCSS, Autoprefixer, custom Node scripts (`seed-admin.mjs`, `import-menu-md.mjs`) |

NPM scripts wrap the common workflows: `dev`, `build`, `start`, `prisma:generate`, `prisma:migrate`, `prisma:studio`, `seed`, `import:menu`.

---

## 3. Domain model
Defined in `prisma/schema.prisma`:

- **`User`** — `email`, `passwordHash`, `role` (`ADMIN | KITCHEN | WAITER | TABLE`), optional `tableId` link to a physical table.
- **`Table`** — labeled physical tables (e.g. *Table 1*); 1-to-many with users and orders.
- **`Category`** — menu sections with `sortOrder` (Breakfast, Kaak, Sandwiches, Salads, Burgers, Platters, Coffee, Cold Beverages, etc.).
- **`MenuItem`** — `name`, `description`, `price`, `isAvailable`, `isOutOfStock`, `prepTimeMinutes`, `sortOrder`, FK `categoryId`.
- **`Order`** — `status` (`NEW | IN_PROGRESS | READY | COMPLETED | CANCELLED`), timestamps for each stage (`startedAt`, `readyAt`, `completedAt`, `deliveredAt`), totals (`totalCents`, `voucherDiscountCents`, `manualDiscountCents`, `finalTotalCents`, `finalTotalOverrideCents`), payment flags (`isPaid`, `paidAt`), and FKs to `Table` and `User`.
- **`OrderItem`** — line items with **soft FK** to `MenuItem` (`onDelete: SetNull`) so historical orders survive menu edits; carries denormalized `name` and `price`.
- **`Voucher`** — code-based discounts, either fixed `AMOUNT` (cents) or `PERCENT` (1–100), with optional expiry and max-use cap.

Indexes are defined on common access patterns (`status, createdAt`, `tableId, createdAt`, `userId, createdAt`, `categoryId`, etc.).

---

## 4. Architecture

### 4.1 High-level structure
```
menu-mc/
├─ app/                    # Next.js App Router (pages, layouts, route handlers, server actions)
├─ components/             # Shared React components (cart, chat, theme, nav, toast)
├─ lib/                    # Cross-cutting modules (db, auth, money, discounts, ai/provider)
├─ prisma/                 # schema.prisma + migrations + dev.db
├─ scripts/                # seed-admin.mjs, import-menu-md.mjs
├─ public/                 # Static assets
└─ package.json / tsconfig / tailwind / postcss configs
```

### 4.2 Routing surface (`app/`)
- **Public**
  - `/` — server component homepage that loads categories + available items and hands them to `MenuClient`.
  - `/cart` — cart review and checkout entry point.
  - `/login` — credentials sign-in.
  - `/assistant` — standalone assistant page (companion to the floating widget).
- **Customer (TABLE role)**
  - `/order` — place orders linked to the user’s table.
- **Staff**
  - `/waiter`, `/waiter/orders/[orderId]` — waiter dashboard, manual order form, order detail.
  - `/kitchen` — kitchen ticket queue (`KitchenClient`).
  - `/admin`, `/admin/items`, `/admin/categories`, `/admin/orders`, `/admin/vouchers` — admin tooling.
- **REST route handlers (`app/api/*`)**
  - `auth/[...nextauth]` — NextAuth.
  - `orders`, `table/order`, `waiter/orders`, `kitchen/orders` — order lifecycle endpoints.
  - `chat` — chat assistant (detailed below).
- **Server actions (`actions.ts` files)** — used by admin, waiter, categories, items, vouchers, and orders pages for mutations without explicit REST endpoints.

### 4.3 Layout and global UI
`app/layout.tsx` wires every page through:
- `Providers` (`SessionProvider`, `ToastProvider`, `CartProvider`).
- `InteractiveBackground`, `ThemeSwitch`, `AppNav`, `FloatingCartBar`, `ChatWidget`, and a footer.

`AppNav` reveals navigation entries conditionally based on the session’s `role` (e.g. *Admin* only for ADMIN, *Kitchen* for KITCHEN/ADMIN, etc.).

### 4.4 Shared libraries (`lib/`)
- `lib/db.ts` — singleton Prisma client.
- `lib/auth.ts` — NextAuth `authOptions`, credentials provider, role / table linkage on the session.
- `lib/money.ts` — currency parsing/formatting in cents.
- `lib/discounts.ts` — voucher application logic.
- `lib/ai/provider.ts` — provider-agnostic `generateAssistantReply(messages)` selecting OpenAI or Anthropic based on which API key is present in the environment, with sensible defaults (`gpt-4o-mini`, `claude-3-5-sonnet-latest`).

---

## 5. Key feature areas

### 5.1 Cart and checkout
Implemented client-side with a React context (`components/cart/useCart.tsx`) that keeps `lines: { menuItemId, name, price, quantity }[]` in state, persists to local storage (`cartStorage`), and exposes `addLine`, `setQuantity`, `removeLine`, `clear`, and a `totalItems` selector. UI affordances include `CartButton` in the nav and a sticky `FloatingCartBar`.

### 5.2 Order lifecycle
Orders move through `NEW → IN_PROGRESS → READY → COMPLETED` (or `CANCELLED`) with per-stage timestamps. The waiter UI supports manual order creation, line edits, and bill adjustments (vouchers, manual discounts, total overrides). The kitchen UI surfaces tickets in real time. The admin orders view aggregates everything for management and reconciles totals on the server.

### 5.3 Authentication and roles
Sign-in uses NextAuth credentials. The session carries `role` (`ADMIN | KITCHEN | WAITER | TABLE`) and, for table accounts, `tableId`. Authorization is enforced both in UI (`AppNav` role gating) and on the server (route handlers and actions check `session.role`).

### 5.4 Chat assistant (`app/api/chat/route.ts` + `components/chat/ChatWidget.tsx`)
A focused RAG-style assistant grounded in the live menu:

1. **Input.** Accepts `{ message, cart? }` validated with Zod (`cart` capped at 80 lines).
2. **Customer context.** For TABLE users, loads the latest order (statuses `NEW/IN_PROGRESS/READY/COMPLETED`). The client cart and the persisted order lines are merged via `mergeCustomerLines` (sums duplicate names case-insensitively).
3. **Intent detection.** `isRecommendationIntent` and `isMetaAssistantQuestion` short-circuit canned flows (recommendations and identity questions), preventing the model from being asked to invent dishes or disclose implementation details.
4. **Menu retrieval.** A single `findMany` of available items powers two paths:
   - **Recommendation:** `suggestFromCustomerContext` matches the customer’s lines to menu items, gathers their categories, and returns other available items in those categories (with drinks/coffee categories appended if the pool is sparse). When the cart and order are empty, `generalMenuPicks` returns one item per category as starter ideas.
   - **General Q&A:** a token-based filter (`tokenize` + `tokenMatchesItemWords`) matches keywords (with simple plural/singular handling) against item words.
5. **Response.** With an AI key set, the route prompts the provider with a strict system message (answer only from MENU CONTEXT, treat empty cart as starter ideas, never reveal model/provider). Without a key, `fallbackReplyWithoutAi` returns a deterministic, menu-only response.
6. **Operational diagnostics.** A development warning instructs the operator to set `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) in `menu-mc/.env.local`/`.env` and restart, since pasted keys outside env files are not loaded.

The widget itself (`ChatWidget.tsx`) is a lightweight floating panel hidden on certain routes, that posts the current cart state alongside the message.

---

## 6. Data flow (representative path: place an order)
1. The customer browses `/`, which is a server component loading `Category` and `MenuItem` rows directly via Prisma.
2. The cart context (`useCart`) collects items client-side and persists them to local storage.
3. On checkout (`/cart` or `/order`), a server action / route handler authenticates the user, validates the payload with Zod, creates an `Order` and `OrderItem` rows, and recomputes totals (`lib/money.ts`, `lib/discounts.ts`).
4. The kitchen view (`/kitchen`) and waiter view (`/waiter`) read pending orders and transition status via their dedicated handlers (`api/kitchen/orders`, `api/waiter/orders`).
5. The admin view (`/admin/orders`) supports bill edits, vouchers, manual discounts, and overrides, persisting deltas through `app/admin/orders/actions.ts`.

---

## 7. Configuration and operations

### 7.1 Environment variables (`menu-mc/.env`)
- `DATABASE_URL` — SQLite path (`file:./dev.db`).
- `NEXTAUTH_URL` — origin used by NextAuth callbacks (must match the browser origin exactly).
- `NEXTAUTH_SECRET` — session signing secret.
- `OPENAI_API_KEY` *(optional)* — enables the AI-backed chat path. Alternatives: `ANTHROPIC_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `ANTHROPIC_MODEL`.

### 7.2 Local setup
```
npm i
npm run prisma:generate
npm run prisma:migrate
npm run seed          # creates default admin: admin@menu.local / admin12345
npm run dev
```
Optional: `npm run import:menu` populates the database from a markdown menu file.

---

## 8. Quality and conventions
- **Type safety** — All application code is TypeScript with strict typing through Prisma-generated types; chat-route helpers (`MenuWithCat`, `CartLineIn`) explicitly model the data shape.
- **Validation at the edge** — Every untrusted boundary (request bodies, form data) is validated with Zod schemas before being passed to Prisma.
- **Separation of concerns** — UI in `app/` and `components/`, persistence and cross-cutting concerns in `lib/`, schema and migrations in `prisma/`.
- **Defensive AI integration** — The AI path is optional and behind a feature flag (presence of an API key); the system gracefully degrades to a deterministic menu-only assistant.
- **Auditability of orders** — `OrderItem` keeps denormalized `name`/`price` and a nullable `menuItemId` to preserve order history when menu items change.

---

## 9. Notable design decisions
1. **SQLite + Prisma** keeps the dev environment friction-free; Prisma queries avoid PostgreSQL-only flags such as `mode: "insensitive"` to remain SQLite-compatible.
2. **Cents-based money** (`lib/money.ts`) avoids floating-point drift in totals, vouchers, and overrides.
3. **Soft FK on `OrderItem.menuItemId`** (`onDelete: SetNull`) allows admins to remove items without breaking historical orders.
4. **Dual context for the assistant** (server-fetched table order + client-supplied cart) means the assistant works for both authenticated table users and anonymous browsers.
5. **Provider-agnostic AI layer** lets the deployment swap models without touching route logic.

---

## 10. Limitations and forward work
- **SQLite** is appropriate for single-instance deployments; multi-server or high-concurrency deployments would benefit from migrating to PostgreSQL and adopting Prisma’s `mode: "insensitive"` where needed.
- **Real-time updates** for kitchen and waiter dashboards rely on polling/refresh patterns; introducing SSE or WebSockets would reduce latency.
- **Test coverage** is not yet present in this iteration of the repo; adding unit tests for `lib/discounts.ts`, `lib/money.ts`, and the chat route’s recommendation logic is a high-leverage next step.
- **Internationalization** and **payments** are stubs: prices are stored as strings and totals as cents, but no payment provider is integrated, and copy is English-only.

---

## 11. Conclusion
Menu MC is a coherent, role-aware ordering platform with a clean separation between domain (Prisma schema + lib helpers), application logic (App Router pages, server actions, REST handlers), and presentation (Tailwind-styled React components). Its standout feature is a grounded chat assistant that combines a server-side view of the customer’s order with a client-side view of their cart to deliver context-aware menu recommendations, while degrading gracefully when no AI provider is configured. The architecture is small enough to reason about end-to-end and modular enough to scale into a production deployment with relatively localized changes (database backend, real-time transport, payments).
