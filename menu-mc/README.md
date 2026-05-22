# Menu MC — Full‑stack menu website (Next.js + Auth + DB)

This is a full-stack menu site with:
- A public menu page with **section buttons** and a menu-style layout.
- **Login** (credentials) for an admin user.
- An **admin backend** to manage categories + menu items.
- SQLite database via Prisma.

## Quick start

Install:

```bash
npm i
```

Set up DB:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Create an admin login (defaults below):

```bash
npm run seed
```

Run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Default admin credentials (after seeding)

- Email: `admin@menu.local`
- Password: `admin12345`

You can change these in `scripts/seed-admin.mjs`.

