# CARDEX

**A free, mobile-first browser game about collecting real-world cars.**

[Play CARDEX](https://kevin-oulai.github.io/cardex/) · [Source](https://github.com/kevin-oulai/cardex) · [Report a bug](https://github.com/kevin-oulai/cardex/issues)

CARDEX is an independent, unofficial car-card collecting project. The static frontend runs on GitHub Pages; Supabase provides required accounts, cloud preferences, server-issued cards, the virtual economy, verified daily Showdown results, and collector profiles.

> **Development status — 31 October 2026:** Online game features are implemented, including atomic bulk booster opening, versioned cloud preferences, account deletion, privacy controls, and 15 collectible titles. Authenticated end-to-end, multi-device, accessibility, and launch/legal compliance testing remain incomplete. Treat the game as a work in progress.

## Gameplay

### Boosters

- **192 car models**, eight rarity tiers (Common, Uncommon, Rare, Super Rare, Ultra Rare, Legendary, Exotic, Limited).
- Four booster themes: **World Mix, JDM Legends, European Icons, Motorsport**.
- **Five cards per booster**, with the final draw guaranteed **Rare or better**; Legendary pity protection applies.
- Open one booster card by card, or open **5 or 10** in one server transaction with a combined summary. A failed batch rolls back rather than issuing a partial batch.
- Four finishes: **Standard, Foil, Holographic, Collector**.
- Tickets regenerate; credits and tickets are entirely virtual. Tickets can be purchased **using in-game credits**, not real money.

Base rarity weights are defined by the server's authoritative draw implementation; the final-card rarity floor, themes, pity and other rules affect effective odds. Do not interpret raw weights as final probabilities.

### Garage

- Search, filter and sort owned cars; mark favorites and group duplicate model/finish copies.
- Recycle eligible spare copies for virtual credits. Server recycling preserves one copy per model/finish and protects cards referenced by Showdown history.
- Each issued card has a globally issued record and model-scoped serial number.

### Daily Showdown

- Challenge a server-published daily boss with an eligible owned car (mirror matches are prohibited).
- Scores compare power, top speed and weight; rewards unlock at score milestones.
- A daily leaderboard ranks verified results. A quick-select control finds the highest-scoring eligible car currently in your collection.
- Showdown is an **online, server-verified asynchronous competition**, not live head-to-head multiplayer.

### Collector profiles, achievements and titles

- Customize your display name, avatar, bio and profile theme; showcase three owned cars and maintain a wishlist.
- Claim ten server-verified achievements.
- Earn **35 cosmetic collector titles** through collection size, rarity, regional/motorsport themes, claimed achievements and historical Showdown placements. Equip one title from the collapsible Profile title manager. Titles have no gameplay bonus.
- Signed-in users can view public collector profiles; you can hide collection details and Showdown history from other players. **Leaderboard identity and results remain visible**.
- Historical podium/title counts are calculated from stored leaderboard standings and are **not yet finalized, immutable daily awards**. Inventory-dependent titles can become locked after recycling.

See [Collector Titles](docs/collector-titles.md) for requirements and semantics.

## Accounts and saves

**An online account is required to play.** Authentication and authoritative gameplay run through Supabase.

- Server records are authoritative for card ownership, serials, wallet balances and competitive results.
- Profile preferences and other supported state synchronize through **versioned account-bound cloud saves**. The browser keeps account-scoped local cache data for recovery; it is not an independent verified game save.
- If another device saves newer preferences, the Profile/account UI can reload the server version and retain a browser-local backup of the conflicting local edits. There is **no automatic merge UI**.
- The old manual local save import/export workflow has been retired. Clearing browser storage does **not** delete your account or server collection.
- You can sign out or request permanent account deletion from account settings. Account deletion requires password reauthentication and an explicit confirmation phrase.

## Local development

No bundler is required, but **a local HTTP server and network access to Supabase are required** for the current authenticated game. Opening `index.html` directly as `file://` does not support the page-fragment fetches.

```bash
git clone https://github.com/kevin-oulai/cardex.git
cd cardex
python -m http.server 8000
```

Open http://localhost:8000. Some authentication redirect behavior depends on your Supabase project's configured redirect URLs. The published Supabase client uses a public/publishable key; **never commit a service-role secret**.

Validate the HTML structure with:

```bash
node scripts/validate-pages.mjs
```

A GitHub Actions workflow also checks page-fragment structural nesting and duplicate IDs. This does not replace browser or security testing.

## Project structure

| Path | Responsibility |
| --- | --- |
| `index.html` | Shared app shell, navigation, dialogs, page-fragment loader |
| `pages/boosters.html` | Booster page markup |
| `pages/garage.html` | Garage page markup |
| `pages/duel.html` | Showdown page markup |
| `pages/profile.html` | Profile, achievements, titles, showroom |
| `pages/auth.html` | Sign-in and account synchronization UI |
| `assets/styles.css` | Shared styling |
| `assets/game.js` | Catalog, game UI, rendering and interactions |
| `backend/client.js` | Supabase client, auth, synchronization and RPC calls |
| `backend/*.sql` | Database schema, migrations and authoritative game functions |
| `car-images.json` | Provisional car image references |
| `scripts/validate-pages.mjs` | Static structural HTML checks |
| `docs/` | Architecture, audits, feature notes |
| `privacy.html`, `terms.html`, `legal.html` | Public-facing policy and legal drafts |

See [Frontend Architecture](docs/frontend-architecture.md).

## Deployment

The site is published at https://kevin-oulai.github.io/cardex/ through GitHub Pages. The app loads page fragments over HTTP and relies on a separately deployed Supabase backend. Publishing frontend files alone **does not create database tables, apply SQL migrations or deploy Edge Functions**.

Use GitHub Actions to monitor deployment and validation checks. After changing shared JavaScript or CSS, update the cache-busting query string in `index.html` when necessary.

## Vehicle images and intellectual property

`car-images.json` includes **provisional** Wikipedia/Wikimedia image references; model accuracy, authorship, licensing and attribution have **not** been fully audited. An image-source URL does not establish a reuse license. Confirm the source, photographer, license, attribution and permitted uses before wider release.

CARDEX is not affiliated with any vehicle manufacturer or tuner. Trademarks, vehicle imagery and third-party photographs remain subject to their respective owners' rights.

The repository is public, but **public availability is not an open-source license**. Check for a valid `LICENSE` file before assuming redistribution rights.

## Privacy, legal status and monetization

- Free to play; **no real-money purchases or advertising integration** at present.
- CARDEX uses Supabase authentication/database services, GitHub Pages hosting, and third-party image services. Refer to the [Privacy Policy](privacy.html) for the current disclosure.
- Publisher identification/contact details, final data-retention/legal-basis disclosures and third-party image-rights review are **still incomplete**. The published legal pages are drafts requiring publisher review before a formal public launch.
- [Legal notice](legal.html) · [Privacy policy](privacy.html) · [Terms and credits](terms.html).

## AI assistance

CARDEX has been developed with substantial ChatGPT/OpenAI assistance across code, debugging, design, documentation and draft legal text. The project owner directs features, reviews and tests changes, and decides what to publish. The exact model used for every historical contribution has not been reliably recorded. AI assistance does not certify code quality, security, factual accuracy or legal compliance.

## Feedback

Use [GitHub Issues](https://github.com/kevin-oulai/cardex/issues) for non-confidential bug reports or suggestions. Include reproduction steps and device/browser details where useful; do not post account credentials or personal data.

---

**CARDEX — Collect the machines that defined generations.**
