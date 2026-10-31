# CARDEX

**A free, mobile-first browser game about collecting real-world cars.**

[**Play CARDEX**](https://kevin-oulai.github.io/cardex/) · [Source code](https://github.com/kevin-oulai/cardex) · [Report an issue](https://github.com/kevin-oulai/cardex/issues)

CARDEX is an independent, unofficial car-card collecting project. Open themed boosters, discover cars, manage a growing Garage, and challenge a daily opponent. It runs as a static website, without an account or a game server.

> **Project status:** Actively developed prototype. Features, vehicle specifications, imagery, and balancing may change. Mobile behavior and individual images have not all been independently verified.

## Gameplay

### Boosters and collection

- **96 car entries** across different eras, countries, and performance categories, including special **Exotic** and **Limited** variants.
- Four booster themes: **World Mix**, **JDM Legends**, **European Icons**, and **Motorsport**.
- Each booster contains **five cards**; the final draw is guaranteed a rarity of **Rare or higher**.
- Open one booster with a card-by-card reveal, or open **5 or 10 boosters** at once and go directly to a combined summary. Repeat the same booster theme from the summary.
- Four collectible card finishes: **Standard**, **Foil**, **Holographic**, and **Collector**.
- Earn and spend **virtual** credits and booster tickets. There are **no real-money purchases**.
- Tickets regenerate over time, up to the in-game reserve cap. The game includes a Legendary pity/safety-net mechanic.

**Base rarity weights** in the current JavaScript implementation:

| Rarity | Base weight |
| --- | ---: |
| Common | 44.6% |
| Uncommon | 26.8% |
| Rare | 15.9% |
| Super Rare | 8% |
| Ultra Rare | 3.5% |
| Legendary | 0.5% |
| Exotic | 0.5% |
| Limited | 0.2% |

These are **base draw weights, not guaranteed observed pull rates**. The final-card rarity floor, theme-specific car pools, duplicate prevention within a pack, pool fallbacks, and Legendary pity can change the effective probabilities.

### Garage

- Browse owned cards, search by manufacturer/model, and filter by rarity, drivetrain, country, or card finish.
- Sort by acquisition, rarity, name, horsepower, top speed, weight, model year, or favorites.
- **Group identical model-and-finish copies** into one Garage tile, with a copy count, or view individual cards.
- Filter for duplicates and recycle individual spare copies.
- **Bulk-recycle all spare copies** after confirmation. The operation preserves one card of each **model + finish** combination; recycling is irreversible within the game and awards virtual credits.

### Daily Showdown

Face a daily featured car using a vehicle from your Garage. Results compare **power, top speed, and weight**; milestone rewards are earned from the best daily score. Attempts are unlimited. This is a **local, deterministic daily challenge**, not an online multiplayer competition or global leaderboard.

### Collector Profile

Customize a display name, avatar, biography, and profile theme; choose three owned cars for the showroom; maintain a wishlist across the catalog; and earn achievements. Profile and collection data are stored on your device.

## Saving progress

CARDEX uses browser **`localStorage`** (currently the `cardex-v2` key). No account or cloud synchronization is currently implemented.

- **Export** a JSON save from the Profile page to back up or transfer progress.
- **Import** a JSON save to replace the current browser save.
- Clearing browser data, using private browsing, or changing devices may remove access to locally stored progress unless you exported a backup.

## Run locally

CARDEX is a static HTML/CSS/JavaScript project. No package manager, build step, backend, or API key is required to run the game.

```bash
git clone https://github.com/kevin-oulai/cardex.git
cd cardex
python -m http.server 8000
```

Open **http://localhost:8000** in your browser.

A local HTTP server is recommended because the game fetches `car-images.json`; opening `index.html` directly as a `file://` URL may prevent that request in some browsers. An internet connection is required for remotely hosted car photographs.

## Deploy

The project is published on **GitHub Pages** from the `main` branch via the repository's GitHub Actions deployment setup.

1. Fork or clone the repository and make your changes.
2. Push them to the branch configured for deployment.
3. In **Settings → Pages**, configure **GitHub Actions** as the build/deployment source if necessary.
4. Check the **Actions** tab for deployment status.

Live site: **https://kevin-oulai.github.io/cardex/**

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Game UI, styling, catalog data, rules, and client-side logic |
| `car-images.json` | Per-car image-reference catalog keyed by stable car IDs |
| `legal.html` | Publisher/hosting information and non-affiliation notice |
| `privacy.html` | Local storage and external-service privacy information |
| `terms.html` | Game terms, image credits, and disclaimers |
| `README.md` | Project documentation |

### Vehicle photography

`car-images.json` associates image references with car IDs. It currently contains **provisional Wikipedia article references**, not a fully verified set of exact-model photos. Some displayed photos may depict a different generation, trim, or vehicle. Please report mismatches.

A reviewed image can be pinned in the corresponding catalog entry using an HTTPS `src` and `credit` URL. The game otherwise requests article thumbnail images from Wikipedia/Wikimedia and falls back to an icon if a photograph cannot be loaded.

**Important:** An image-source link is not, by itself, complete copyright clearance or attribution. Before pinning or redistributing any image, check the actual photographer, source, license, permitted uses, and attribution requirements. Record those details as part of the review. Do not assume all Wikipedia images are available for commercial reuse.

## AI assistance and transparency

CARDEX has been developed **with substantial assistance from AI**, including implementation and revisions of HTML, CSS, JavaScript, UI interactions, gameplay systems, debugging, documentation, and legal-page drafts.

- **AI provider:** OpenAI
- **AI assistant:** ChatGPT
- **Model used for this README update:** **GPT-6**
- **Earlier development:** Multiple ChatGPT-assisted iterations. The exact model used for every earlier change has **not been reliably recorded**, so this README does not attribute the entire codebase to GPT-6.
- **Human involvement:** The project owner directs the design, selects features, tests the game, and decides what to publish. AI-generated contributions require review and testing.

AI assistance does **not** guarantee correctness, security, factual accuracy, legal compliance, or third-party licensing clearance. In particular, legal pages are drafts for the publisher to complete and verify, not legal advice or certification.

## Legal, licensing, and monetization

CARDEX is an **independent, unofficial project**. It is not affiliated with, sponsored by, or endorsed by any vehicle manufacturer or tuning company. Vehicle names, trademarks, designs, and photographs may be subject to third-party rights.

- **Current model:** Free to play, with **no real-money purchases** and **no advertising integration**.
- **Future plans:** Advertising may be considered later, but any necessary privacy disclosures, cookie/tracking consent, image-license review, and publisher details must be addressed **before activation**.
- **Legal pages:** [Legal notice](https://kevin-oulai.github.io/cardex/legal.html) · [Privacy policy](https://kevin-oulai.github.io/cardex/privacy.html) · [Terms and image credits](https://kevin-oulai.github.io/cardex/terms.html).
- **Outstanding work:** The publisher's legally required identification/contact information is not yet complete, and the image-rights audit is ongoing.

**Open-source licensing status:** This repository is publicly accessible, but **public access alone does not grant an open-source license**. Unless a valid `LICENSE` file is added, do not assume permission to copy, redistribute, or commercially reuse the code. Third-party images and marks would remain subject to their own rights even if the original code were released under an open-source license.

For each future feature or external-service integration, check whether the legal notice, privacy policy, terms, attribution, or consent flows need updating.

## Contributing and feedback

Bug reports and suggestions are welcome via [GitHub Issues](https://github.com/kevin-oulai/cardex/issues). Useful reports include the device/browser, steps to reproduce, expected behavior, and a screenshot where appropriate. Avoid sharing personal information or save files containing information you do not want to publish.

---

**CARDEX** — Collect the machines that defined generations.
