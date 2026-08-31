# Studio Ledger — Phase 1

A React Native (Expo, TypeScript) app for a single studio to track members and
their monthly membership fees, backed by Supabase (Postgres + Auth + Row
Level Security).

This is Phase 1 from the product spec: owner auth, one studio, and a member
list / add-edit-member / mark-payment flow, all talking to a real Supabase
backend. Reminders, billing, and multi-studio onboarding are intentionally
out of scope here — see the spec's later phases for those.

## What's included

- **Database schema** (`supabase/migrations/0001_phase1_schema.sql`): `studios`,
  `staff_users`, `members`, `payments` tables, all scoped by `studio_id` with
  Row Level Security so one studio can never see another's data.
- **Auth**: email/password sign-up and sign-in for the studio owner.
- **Onboarding**: a "create your studio" screen for a first-time owner
  (creates the `studios` row and links the owner via a Postgres RPC).
- **Member management**: searchable/filterable member list, add member, edit
  member, delete member.
- **Payments**: mark a member paid/unpaid for the current month, with a
  6-month payment history per member. Due dates are derived from each
  member's join date.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run the contents of
   `supabase/migrations/0001_phase1_schema.sql` (or, if you use the
   [Supabase CLI](https://supabase.com/docs/guides/cli), run
   `supabase db push` / `supabase migration up` from this directory once
   you've linked the project).
3. From **Project Settings → API**, copy the **Project URL** and the
   **anon public** key.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Install and run

```bash
npm install
npm start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code
with Expo Go on a physical device.

## Using the app

1. **Sign up** with an email and password. If your Supabase project has
   email confirmation enabled (the default), confirm via the email you
   receive, then sign in.
2. **Create your studio** — this is a one-time step per owner account; it
   creates the `studios` row and links your account to it as the owner.
3. **Add members**, tap into a member to edit their details, mark them paid
   for the current month, and see their recent payment history.

## Notes on the data model

- Every studio-owned table (`members`, `payments`, and `staff_users` itself)
  carries a `studio_id`. Row Level Security policies restrict every query to
  rows in the caller's own studio, using a `current_studio_id()` helper
  function that looks up the studio for `auth.uid()`.
- `staff_users.id` **is** the Supabase Auth user id (not a separate foreign
  key column), which is what makes the RLS policies straightforward.
- `payments.studio_id` is set server-side by a trigger (derived from the
  payment's `member_id`), so a client can never write a payment into a
  studio it doesn't own.
- A studio owner is created via the `create_studio(studio_name)` Postgres
  function rather than direct table inserts, so the client never needs
  insert access to `studios`/`staff_users` directly.

## Known dependency pin

`@supabase/supabase-js` is pinned to `2.54.0` (not a caret range). Newer
2.5x+ releases shipped a TypeScript typing regression that collapses typed
`.from(...)` query results to `never` under this project's Expo/TypeScript
module resolution settings, even though the schema types are correct. If you
bump this dependency, run `npx tsc --noEmit` and confirm it's still clean
before committing the upgrade.

## What's next (later phases, not built here)

- **Phase 2 — Reminders**: Twilio/SMS + email via a daily cron Edge Function.
- **Phase 3 — Multi-studio onboarding**: studio sign-up flow, staff invites
  with roles, dashboards (status breakdown, gender split, joins over time).
  - In-app onboarding checklist for a new studio's first session (e.g. "Add
    your first member → Mark your first payment") — only useful once
    studios are onboarding themselves, so it belongs here, not Phase 1.
  - Product analytics (e.g. PostHog) to see which features studios actually
    use and where they drop off — same reasoning, needs multiple real
    studios to be worth anything.
- **Phase 4 — Billing**: Razorpay/Stripe subscriptions, trial period, paywall.
- **Phase 5 — Polish and store submission**: app icons, onboarding screens,
  push notification permissions, iOS App Store + Google Play submission.

A marketing website (with its own social preview image, subdomain, and
sitemap.xml) is intentionally not on this roadmap yet — the app is
distributed through app stores, not a website, and there's no separate
marketing site planned for now.
