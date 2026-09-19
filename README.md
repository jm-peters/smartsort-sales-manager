# SmartSort Sales Manager

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_ANON_KEY` to the public anon key from Supabase Project Settings > API.
3. Run `npm install` and `npm run dev`.

## Supabase setup

The Supabase project URL is configured through `VITE_SUPABASE_URL`. Apply the SQL migration in `supabase/migrations/202609190001_initial_schema.sql` from the Supabase SQL Editor or with the Supabase CLI.

The migration creates the core shop, product, sales, sale item, and stock movement tables and enables row-level security. Policies and authenticated user mapping must be added before production data is exposed.

## Deployment

GitHub can build and deploy the frontend, but a frontend deployment does not automatically run database migrations. Configure the hosting provider's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` variables, and run Supabase migrations separately through the Supabase CLI or a protected CI job.

Useful checks:

```bash
npm run build
npm run lint
```
