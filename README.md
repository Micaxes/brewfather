# Brewable

A local, single-user web app that answers **"what can I brew now?"** It connects
to your [Brewfather](https://brewfather.app) account with a read-only API key,
pulls your live **inventory** and **saved recipes**, runs a deterministic
**matching engine**, and renders a ranked dashboard:

- ✅ **Brew now** — everything a recipe needs is in stock
- 🟡 **Almost** — a short shopping list away (with the exact shortfalls)
- ⚪ **Not yet** — missing key ingredients

> Recommendations come only from your **own vetted recipes** — nothing is
> generated or invented.
>
> Note: "Brewable"/"Brewfather" is a working title; an existing commercial app
> shares the name, so this may be renamed before any launch.

## How it works

```
Brewfather API ──> /api/brew-candidates (server) ──> matching engine ──> dashboard
   inventory + recipes        BFF, key stays server-side        ranked "what can I brew"
```

- **Next.js (App Router) + TypeScript**, **Tailwind + shadcn/ui**.
- The Brewfather API key is used **only server-side** (BFF route handlers); it
  never reaches the browser.
- Matching is **rules-based and deterministic** — no database, no auth, no AI.

## Prerequisites

- **Node.js 20+** and npm.
- A **Brewfather account with Premium** (required to mint an API key).

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Brewfather API key: in Brewfather, go to **Settings → API**, then
   generate a key with **read** access to `recipes` and `inventory`.

3. Configure your environment. Copy the example file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   ```ini
   # .env
   BF_USER_ID=your-brewfather-user-id
   BF_API_KEY=your-brewfather-api-key
   ```

   `.env` is gitignored — never commit your real credentials. If the variables
   are missing, the dashboard still loads and shows an onboarding hint instead of
   any candidates.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and follow the link to the
dashboard at [http://localhost:3000/dashboard](http://localhost:3000/dashboard).
With your key set, you will see your saved recipes ranked by what you can brew
right now.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

## Project layout

- `lib/brewfather/` — typed, server-only Brewfather API client (auth,
  pagination, rate-limit backoff, normalization).
- `lib/matcher/` — deterministic inventory-to-recipe matching engine.
- `lib/api-contract.ts` — the `/api/brew-candidates` response contract.
- `app/api/brew-candidates/` — BFF route: fetch data, run the matcher, return
  ranked candidates.
- `app/(dashboard)/` + `components/brew/` — the dashboard UI.
- Tests are co-located in `__tests__/` directories and run with Vitest
  (`npm test`), including the route + dashboard integration smoke tests.
