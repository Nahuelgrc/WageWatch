# WageWatch

Track worked hours, set your hourly rate and company paydays, log what you actually got paid, and see if there's a shortfall — built with Next.js, Drizzle ORM, and Neon Postgres.

## Getting started

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — your Neon Postgres connection string
   - `AUTH_SECRET` — generate with `npx auth secret`
2. Push the schema to your database:
   ```bash
   npm run db:push
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Drizzle ORM + `@neondatabase/serverless`
- Auth.js (NextAuth v5) with credentials-based username/password login

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build and start
- `npm run lint` — lint the codebase
- `npm run db:push` — push the Drizzle schema to the database
- `npm run db:studio` — open Drizzle Studio
