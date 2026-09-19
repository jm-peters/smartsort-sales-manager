# SmartSort Sales Manager

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `PUBLIC_SUPABASE_ANON_KEY` to the public publishable or anon key from Supabase Project Settings > API.
3. Run `npm install` and `npm run dev`.

## Supabase setup

The Supabase project URL is configured through `PUBLIC_SUPABASE_URL`. Apply the SQL migration in `supabase/migrations/202609190001_initial_schema.sql` from the Supabase SQL Editor or with the Supabase CLI.

The migration creates the core shop, product, sales, sale item, and stock movement tables and enables row-level security. Policies and authenticated user mapping must be added before production data is exposed.

See [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) for the ordered production work.

## Deployment

GitHub can build and deploy the frontend, but a frontend deployment does not automatically run database migrations. Configure the hosting provider's `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` variables. Keep `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ACCESS_TOKEN` server/CI-only, and run Supabase migrations separately through the Supabase CLI or a protected CI job.

## Authentication recommendation

For the first production release, use Supabase email/password or magic-link authentication for owners and invite cashiers. It avoids SMS provider fees and is supported directly by Supabase. Add phone OTP later when the workflow proves it is necessary. For Kenya, Africa's Talking is a strong local SMS option, but it requires a custom OTP service; Twilio is the simplest provider supported directly by Supabase Phone Auth but has recurring SMS costs.

Useful checks:

```bash
npm run build
npm run lint
```
