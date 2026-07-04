# Brewable

A multi-user web app that answers **"what can I brew now?"** Each signed-in
user connects their own [Brewfather](https://brewfather.app) account with a
read-only API key (stored encrypted in Supabase Vault); Brewable pulls their
live **inventory** and **saved recipes**, runs a deterministic **matching
engine**, and renders a ranked dashboard:

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
- Every user's Brewfather API key is **verified against Brewfather before it is
  stored**, encrypted at rest in **Supabase Vault**, and used **only
  server-side** (BFF route handlers) — it never reaches the browser.
- Matching is **rules-based and deterministic** — no AI.

## Prerequisites

- **Node.js 20+** and npm.
- A **Supabase project** (auth + Vault-encrypted per-user keys + cache).
- Each user needs a **Brewfather account with Premium** (required to mint an
  API key) — but that key is entered in the app's Settings page, not in env
  vars.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure Supabase (the only required environment): copy `.env.example` to
   `.env.local` and fill in the `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_*` values
   (see [Authentication](#authentication-v1) below).

3. Apply the SQL migrations in `supabase/migrations/` to your project (in
   order) — they create the Vault-backed credential store, the per-user data
   cache, and their RLS policies.

> **Dev scripts only:** `BF_USER_ID` / `BF_API_KEY` in `.env` are read solely
> by the offline matching spike (`npm run spike`). The app itself never uses
> them — every request runs with the signed-in user's own key from Vault.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account (or sign
in), then connect your Brewfather key under **Dashboard → Settings** — the page
walks you through generating a read-only key (Brewfather **Settings → API**)
and verifies it against Brewfather before saving. Your saved recipes then show
up ranked by what you can brew right now.

## Authentication (v1)

The dashboard is gated by [Supabase](https://supabase.com) Auth: unauthenticated
visitors are redirected to `/login` (email + password sign-up / sign-in). To run
it locally, add your Supabase project values to `.env.local` (see `.env.example`
for the variable names):

```ini
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...            # server-only
SUPABASE_JWKS_URL=.../auth/v1/.well-known/jwks.json
```

In the Supabase dashboard → **Authentication → URL Configuration**, set the
**Site URL** (e.g. `http://localhost:3000` for dev, your Vercel URL in prod).
Under **Authentication → Sign In / Providers → Email**, turn **Confirm email
OFF** — sign-ups are password-based and create a session instantly, so no auth
emails are ever sent (the hosted project has no custom SMTP and is capped at
2 emails/hour). Mirror the same env vars in Vercel → Project → Settings →
Environment Variables.

> Session handling uses `@supabase/ssr` (cookie-based) with the Next.js `proxy`
> convention (`proxy.ts`) refreshing the session on each request.

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
