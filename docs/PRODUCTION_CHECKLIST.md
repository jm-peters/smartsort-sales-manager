# Production readiness checklist

## 1. Supabase project

- [ ] Add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` to local `.env.local` and Vercel.
- [ ] Never add `SUPABASE_SERVICE_ROLE_KEY` to a `PUBLIC_*` variable or frontend code.
- [ ] Apply migrations in order from `supabase/migrations`.
- [ ] Confirm database backups and retention in Supabase.
- [ ] Confirm the production project is separate from development data.

## 2. Authentication

Recommended first release: Supabase email/password or magic link for owners, with invited cashier accounts. This avoids SMS fees and does not require an SMS vendor. Keep the shop phone as contact information, not as the login identity.

- [ ] Enable Email provider in Supabase Authentication > Providers.
- [ ] Set Site URL and redirect URLs for local development and the production Vercel URL.
- [ ] Implement sign-up/sign-in/sign-out using `supabase.auth`.
- [ ] Create the authenticated user's shop membership after onboarding.
- [ ] Replace `loginDemo` and the hard-coded demo session.
- [ ] Add password reset and expired-session handling.
- [ ] Add SMS OTP only if owners specifically need phone login.

## 3. Authorization and data

- [ ] Apply the membership/RLS migration.
- [ ] Verify an owner can only read and write their own shop's rows.
- [ ] Verify a cashier cannot change shop settings, prices, or owner membership.
- [ ] Move stock changes and sale creation into validated database transactions or RPC functions.
- [ ] Add server-side validation for prices, quantities, payment totals, and sale status.
- [ ] Replace `demo-shop`, `demo-user`, and `demo-device` identifiers with authenticated values.
- [ ] Implement real Supabase push/pull sync and conflict handling.

## 4. Deployment

- [ ] Configure Vercel build command: `npm run build`.
- [ ] Configure Vercel output directory: `dist`.
- [ ] Add only `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` to browser deployment variables.
- [ ] Run database migrations from a protected CI job or Supabase CLI workflow.
- [ ] Add preview and production redirect URLs in Supabase Auth.
- [ ] Add error tracking, uptime monitoring, and deployment rollback instructions.

## 5. Business operations

- [ ] Test sales, stock receiving, debts, expenses, cash close, receipts, and low-stock alerts on real devices.
- [ ] Test offline sale, reconnect, duplicate retry, and conflict scenarios.
- [ ] Test multiple users and two devices in the same shop.
- [ ] Add CSV export and a data recovery process.
- [ ] Confirm tax, receipt, M-Pesa, privacy, and record-retention requirements for the operating country.

## SMS provider decision

Start without SMS using email/password or magic links. If SMS becomes necessary in Kenya, compare Africa's Talking for local delivery/support and Twilio for the simplest managed integration. SMS requires provider credentials, sender configuration, delivery monitoring, rate limits, abuse prevention, and a recurring budget.
