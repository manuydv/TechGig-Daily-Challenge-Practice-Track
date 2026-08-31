# Studio Ledger

A React Native (Expo, TypeScript) app for a local shop — a yoga/fitness
studio, gym, barbershop, or salon — to track its members or clients, backed
by Supabase (Postgres + Auth + Row Level Security).

Two tracking modes, picked per shop at setup:

- **Membership** (yoga studios, gyms): monthly fee per member, mark
  paid/unpaid, payment history.
- **Visit-based** (barbershops, salons): no recurring fee — log each visit,
  and see who's overdue for a "come back for a cut" nudge based on days
  since their last visit.

This started as Phase 1 from the product spec (single studio, membership
tracking, owner auth) and was extended to support visit-based shops.
Reminders are *not* actually sent yet (no SMS/email wiring — see "What's
next"); the app currently shows who is due for one. Billing and multi-studio
onboarding are also intentionally out of scope for now.

## What's included

- **Database schema** (`supabase/migrations/`): `studios`, `staff_users`,
  `members`, `payments`, `visits` tables, all scoped by `studio_id` with Row
  Level Security so one shop can never see another's data.
- **Auth**: email/password sign-up and sign-in for the shop owner.
- **Onboarding**: a "create your shop" screen — pick a name and a business
  type (Yoga/Fitness Studio, Gym, Barbershop, Salon, Other), which decides
  which tracking mode the rest of the app uses.
- **Member/client management**: searchable/filterable list, add, edit,
  delete.
- **Membership mode**: mark a member paid/unpaid for the current month, with
  6-month payment history. Due dates are derived from each member's join
  date.
- **Visit mode**: log a visit (service + amount, optional), see a "days
  since last visit" badge and recent visit history per client.
- **Settings screen**: change business type, the reminder threshold (days
  since last visit) and message, and turn on a public self-serve sign-up
  link for walk-in clients.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run the migrations **in order**:
   `supabase/migrations/0001_phase1_schema.sql`, then
   `supabase/migrations/0002_business_types_and_visits.sql`. (Or, with the
   [Supabase CLI](https://supabase.com/docs/guides/cli), `supabase db push`
   from this directory once you've linked the project.)
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
2. **Create your shop** — pick a name and a business type. This is a
   one-time step per owner account.
3. **Membership-mode shops** (yoga studio/gym): add members, tap into one to
   mark them paid for the current month and see payment history.
4. **Visit-mode shops** (barbershop/salon): add clients, tap into one to log
   a visit (service + amount). The list badges show who's overdue for a
   reminder based on the shop's configured threshold.
5. **Settings** (link at the bottom of the list screen): adjust the reminder
   threshold/message and turn on the self-serve sign-up link.

## Notes on the data model

- Every shop-owned table (`members`, `payments`, `visits`, and `staff_users`
  itself) carries a `studio_id`. Row Level Security policies restrict every
  query to rows in the caller's own shop, using a `current_studio_id()`
  helper function that looks up the shop for `auth.uid()`.
- `staff_users.id` **is** the Supabase Auth user id (not a separate foreign
  key column), which is what makes the RLS policies straightforward.
- `payments.studio_id` and `visits.studio_id` are set server-side by a
  trigger (derived from the row's `member_id`), so a client can never write
  a payment or visit into a shop it doesn't own.
- A shop owner is created via the `create_studio(studio_name, business_type)`
  Postgres function rather than direct table inserts, so the client never
  needs insert access to `studios`/`staff_users` directly.
- **Public self-serve intake** (walk-in clients filling in their own info)
  does *not* use an RLS policy for anonymous writes. Instead, two
  `SECURITY DEFINER` functions — `get_intake_studio` and
  `public_intake_add_client` — are the only door in, so an anonymous caller
  can create at most a name+contact client record for a shop that has
  explicitly opted in (`public_intake_enabled = true`), and can read nothing
  else. There's no rate limiting or CAPTCHA on it — fine for a shop's own
  front desk, not hardened against public abuse.
- The self-serve link is an **in-app deep link** (`expo-linking`'s
  `createURL`), which only opens correctly on a phone that already has
  Studio Ledger installed. A real walk-in QR code (someone with no app
  installed scanning a code at the counter) needs a hosted **web** version
  of the form — not built, since there's no marketing/web deployment yet.
  Staff-entered visits work today regardless of this.

## Known dependency pins

- `@supabase/supabase-js` is pinned to `2.54.0` (not a caret range). Newer
  2.5x+ releases shipped a TypeScript typing regression that collapses typed
  `.from(...)` query results to `never` under this project's Expo/TypeScript
  module resolution settings, even though the schema types are correct. If
  you bump this dependency, run `npx tsc --noEmit` and confirm it's still
  clean before committing the upgrade.
- **Expo SDK is pinned to 56**, one behind the newest (57). The Expo Go app
  on the App Store/Play Store hadn't picked up SDK 57 support yet, which
  shows as *"Project is incompatible with this version of Expo Go"* on
  device even after updating Expo Go. Before bumping to SDK 57 (or later),
  confirm the current Expo Go release actually supports it — otherwise
  everyone testing via Expo Go breaks.

## What's next (later phases, not built here)

- **Reminders that actually send**: the "days since last visit" / "overdue
  membership" logic is built, but no SMS/email is wired up yet. Needs
  Twilio (SMS) + Resend/SendGrid (email) and a daily cron Edge Function.
- **A hosted web sign-up page**: so a walk-in with no app installed can
  scan a QR code and fill in their info, instead of needing the app.
- **Phase 3 — Multi-studio onboarding**: proper multi-tenant sign-up flow,
  staff invites with roles, dashboards (status breakdown, gender split,
  joins over time).
  - In-app onboarding checklist for a new shop's first session (e.g. "Add
    your first client → Log your first visit").
  - Product analytics (e.g. PostHog) to see which features shops actually
    use and where they drop off.
- **Phase 4 — Billing**: Razorpay/Stripe subscriptions, trial period, paywall.
- **Phase 5 — Polish and store submission**: app icons, onboarding screens,
  push notification permissions, iOS App Store + Google Play submission.

A marketing website (with its own social preview image, subdomain, and
sitemap.xml) is intentionally not on this roadmap yet — the app is
distributed through app stores, not a website, though the "hosted web
sign-up page" above would need one.
