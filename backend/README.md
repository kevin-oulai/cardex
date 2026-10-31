# CARDEX online backend — Supabase

**Status: database schema prepared, not deployed.** The public game still runs entirely locally until a Supabase project is configured and the authenticated/server-authoritative game flows are implemented.

## Setup

1. Create a **Free** project at [Supabase](https://supabase.com/).
2. Open **SQL Editor** and execute [`schema.sql`](./schema.sql).
3. Under **Authentication → URL Configuration**, add `https://kevin-oulai.github.io/cardex/` as an allowed redirect URL. Configure the site URL and email confirmation behavior.
4. Locate the **Project URL** and **publishable/anon key** in the Supabase dashboard. These are intended for browser clients; **never** share or commit the `service_role` key, database password, or other secret.
5. Implement and deploy authenticated Edge Functions for issuing booster cards, allocating unique serials, and validating daily Showdown submissions **before** switching the browser game to online mode.

## Security model

- Supabase Auth handles accounts and sessions.
- Row-level security (RLS) allows public profile, boss, and leaderboard reads; users can edit only their own display name and read only their own serials.
- The browser is **not** allowed to write serials, daily bosses, or scores.
- Global serial IDs are allocated by a database identity sequence; unique across the whole catalog. These are **global issuance IDs**, not per-model serials.
- One daily boss row is keyed by **UTC date**. A trusted server endpoint must create it idempotently.
- Leaderboard scores must be computed or checked against **server-owned card records**, not submitted as unverified numbers from localStorage.
- A secure pack-opening service also needs rate limiting, server-side ticket balances, rarity selection, and transaction-safe issuance.

## Migration decisions

Existing browser saves cannot safely be imported as authoritative competitive collections: users can edit localStorage. Keep local saves playable offline; decide separately whether to allow **unranked legacy imports** or provide a one-time controlled migration.

## Privacy and legal

Before launching accounts or collecting online results, update `privacy.html`, `terms.html`, and `legal.html` with Supabase as a processor/provider, account data, retention/deletion, rights requests, and accurate publisher contact details. Do not enable public account creation before this review is complete.

## Next steps

1. Create and configure the Supabase project.
2. Add frontend sign-up/sign-in/sign-out and session handling.
3. Add trusted backend pack issuance and serials.
4. Add globally shared daily boss and validated rankings.
5. Test with multiple accounts, malicious requests, and existing guest saves.
