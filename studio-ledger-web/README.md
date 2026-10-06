# Studio Ledger — Web

A web/PWA build of Studio Ledger, sharing the same Supabase backend (database,
auth, RLS policies) as the `studio-ledger` React Native app in this repo.
Open it in a phone's browser and use "Add to Home Screen" to install it like
an app — no App Store/Play Store, no Expo Go.

## Setup

```
cp .env.example .env
```

Fill in `.env` with the **same** `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
values from `studio-ledger/.env` (same Supabase project, just different
environment variable names — `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).

```
npm install
npm run dev
```

## Status

Owner-facing screens only so far (Clients/Members, Financials, Expenses,
Employees, Settings), restyled with a bottom tab bar and card-based layout.
A member-facing portal (self check-in, streaks, membership status) is
planned next, alongside deploying this to a public URL for phone testing.
