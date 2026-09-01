# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

WageWatch — a personal time-tracking app. Users log hours worked per day, set an hourly rate and company paydays, log payments actually received, and see whether there's a shortfall. Multi-user, username/password auth.

## Commands

```bash
npm run dev          # dev server (Turbopack)
npm run build         # production build
npm run start          # serve the production build (run build first)
npm run lint            # eslint
npm run db:push          # push src/db/schema.ts to the database (no migration files — this repo doesn't use drizzle migrations, just push)
npm run db:studio         # open Drizzle Studio against the configured DATABASE_URL
```

No test suite exists yet.

`drizzle.config.ts` loads `DATABASE_URL` from `.env.local` manually (via `dotenv`) since drizzle-kit doesn't read `.env.local` by default — only `.env`.

## Architecture

**Data flow / security boundary**: the Neon Postgres connection (`DATABASE_URL`) is only ever touched in `src/db/index.ts`, which is imported exclusively by API routes (`src/app/api/*/route.ts`) and `src/auth.ts` — never by a `"use client"` component. All client pages talk to the database exclusively through `fetch("/api/...")`. Keep it that way; don't import `@/db` from a client component.

**Route protection**: `src/proxy.ts` (Next's renamed `middleware.ts` — see `PROXY_FILENAME` in `next/dist/lib/constants.js`) gates every route except `/login`, `/register`, `/api/*`, and static assets, redirecting unauthenticated users to `/login`. Authenticated pages live under the `src/app/(app)/` route group, which shares a header/nav layout (`src/app/(app)/layout.tsx`). `src/app/page.tsx` just redirects to `/dashboard`; the proxy handles the actual auth gate.

**Auth**: Auth.js v5 (`next-auth@beta`) with a single Credentials provider (`src/auth.ts`), JWT sessions, bcrypt password hashes. Two things here are intentional and non-obvious:
- Failed logins are tracked per-user (`users.failedAttempts`, `users.lockedUntil`) and lock the account for 15 minutes after 5 failures.
- Unknown usernames still run a `bcrypt.compare` against a hardcoded dummy hash (and a no-op DB write) before returning — this exists specifically to keep response timing similar to the real-user path and avoid leaking which usernames exist. Don't "simplify" this away.

**Time storage**: worked time is stored as **total seconds** (`work_entries.seconds`, an integer), not decimal hours. The dashboard's day-entry modal takes separate Hours/Minutes/Seconds inputs and converts via `toSeconds`/`splitHMS`/`formatHMS` in `src/lib/time.ts`. Do not reintroduce a decimal-hours field — an earlier version stored `hours` as `numeric`, which caused ambiguity (is `1.30` one-hour-thirty, or 1.3 decimal hours?) and rounding error; seconds-as-integer avoids both.

**Payments / shortfall**: `expectedAmount` on a `payments` row is computed once at creation time (`src/app/api/payments/route.ts`), by summing `work_entries.seconds` in `[periodStart, periodEnd]` and multiplying by the user's *current* `hourlyRate` — it's a snapshot, not a live-recalculated value. The dashboard's week-total column only sums days that fall within the currently-viewed month (out-of-month calendar padding days are excluded), so it always adds up to the displayed month total.

**Styling**: dark theme only, no light mode / toggle — this was an explicit user choice, not a default. Stick to the existing slate/indigo palette rather than reintroducing the light Tailwind boilerplate colors.

## Conventions

- Write all code, comments, and UI copy in **English** by default, regardless of what language the conversation is in — only use another language if explicitly asked for that specific piece of content.
