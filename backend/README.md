# CARDEX online backend — Supabase

**Status: browser client configured for the Supabase project, schema execution and secure game services pending.** The game integrates optional online authentication and serial-number viewing into **Profile**, and a read-only daily leaderboard into **Showdown**; there is no separate Online tab. Local gameplay and save files remain separate; online issuance and competitive submissions are not enabled.

## Setup

1. Create a **Free** project at [Supabase](https://supabase.com/).
2. Open **SQL Editor** and execute [`schema.sql`](./schema.sql), then [`leaderboard-migration.sql`](./leaderboard-migration.sql), then [`cloud-saves.sql`](./cloud-saves.sql), then [`authoritative-game.sql`](./authoritative-game.sql). The migration assumes no existing score above 100 or incompatible first-clear constraint.
3. Under **Authentication → URL Configuration**, add `https://kevin-oulai.github.io/cardex/` as an allowed redirect URL. Configure the site URL and email confirmation behavior.
4. The **Project URL** and **publishable key** are already configured in `backend/client.js` for this public browser application. **Never** share or commit the `service_role` key, database password, or other secret.
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
2. Test the implemented sign-up/sign-in/sign-out flows after applying SQL and setting authentication URLs. Check confirmation email delivery and account profile creation.
3. Add trusted backend pack issuance and serials.
4. Deploy a trusted UTC daily-boss publisher and server-validated Showdown submission; the frontend currently reads both tables but does not mint bosses or submit scores.
5. Test with multiple accounts, malicious requests, and existing guest saves.

## Leaderboard ranking rules

For each UTC day: **verified 100% boss clears rank first in order of their first verified clear timestamp**; everyone else ranks by **highest percentage**, with earlier best-result update breaking ties. A first-clear timestamp must be written once by the trusted score service and never changed. The frontend sorts read-only database results; it does not currently upload scores.

The same UTC day is used for local boss fallback on every client. A server-published boss row overrides the fallback when present. The global boss and verified rankings are not yet guaranteed operational until trusted server endpoints are deployed.

**Launch blocker:** The website is deployed to GitHub Pages, but the game economy is still local. Accounts alone do not establish online ownership or a secure competitive leaderboard. Do not describe local card inventory, serial issuance, or scores as fully synchronized until server-authoritative services are deployed and tested.

## Cloud account transition (31 October 2026)

The Profile page now uses one Supabase account for login, public display name and account-bound cloud saves. Manual JSON import/export and the standalone serial-number section have been removed. The app requires a signed-in session to open packs or enter Showdown. Existing guest saves are intentionally **not** imported into verified accounts; preserve browser data until a separate migration decision is made.

**Important limits:** The cloud save is synchronized browser game state, not a server-authoritative economy. It can be modified by a technically capable user and must **never** be used to mint global serials or qualify for ranked scores. Pack issuance, rewards, recycling, balances, and Showdown still need trusted transactional RPC/Edge Function implementations. There is currently no automatic account deletion flow, and simultaneous sessions may overwrite one another's save. Do not call the migration fully complete.

## Server-issued booster milestone

`authoritative-game.sql` seeds the 96-vehicle server catalog, creates account wallets, and defines authenticated `cardex_get_wallet`, `cardex_open_pack`, and `cardex_publish_boss` RPCs. Pack openings are executed in database transactions, decrement server tickets, and allocate permanent serial IDs in `global_card_serials`. The frontend now calls these RPCs when available and renders issued cards with serials.

**New accounts start with a fresh authoritative inventory and 10 tickets.** Browser-generated cards and currency from earlier cloud saves are not imported. The earlier `player_saves` record remains for non-authoritative profile preferences. Until server-side rewards and recycling are implemented, those actions are intentionally unavailable in server mode. The verified Showdown submission endpoint and leaderboard population remain pending.

**Before public release:** Test database migrations and two independent accounts, concurrent pack requests, ticket regeneration, serial uniqueness, sign-out, and cross-device state. The migration has not been run or verified against the live Supabase project from this session. Ensure legal pages describe account data and complete publisher identification and account-deletion process.

## Verified daily Showdown

Run [`verified-showdown.sql`](./verified-showdown.sql) after the preceding migrations. The `cardex_submit_showdown(p_serial_id)` authenticated RPC validates card ownership from `global_card_serials`, obtains the shared UTC boss, calculates power/speed/weight percentages from the server catalog, and upserts the daily best result. The first verified 100% timestamp is preserved on subsequent attempts. The frontend now submits a server-issued card serial and refreshes the daily leaderboard.

Current limitations: Showdown milestone rewards are not yet issued server-side; local progress indicators can be stale across devices. Browser cloud-save data remains untrusted for competitive ranking. Confirm the RPC exists in Supabase and test with two accounts before declaring the leaderboard production-ready.
