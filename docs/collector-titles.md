# CARDEX Collector Titles

Introduced 31 October 2026. Database source: `backend/titles-system.sql`.

Titles are **verified by Supabase** and earned automatically based on the current account. Equipping a title is an authenticated RPC operation. Titles provide cosmetic prestige only (no gameplay advantage).

| Category | Titles | Requirement |
|---|---|---|
| Collection | Rookie Collector, The Archivist | Own 1 / 100 cards |
| Rarity | Rare Hunter | Own 10 Rare cards |
| Rarity | Legend Keeper, Mythic Curator | Own 3 / 10 Legendary+ cards |
| Theme | JDM Enthusiast | Own 8 distinct Japanese models |
| Theme | Euro Connoisseur | Own 8 distinct European models |
| Theme | Track Rat | Own 5 distinct motorsport models |
| Achievements | Achievement Hunter, Completionist | Claim 3 / 5 achievements |
| Showdown | Showdown Contender | Enter 10 daily Showdowns |
| Showdown | Podium Finisher, Podium Regular | Place daily top 3 on 1 / 5 days |
| Showdown | Showdown Champion, The Dynasty | Finish daily rank #1 on 1 / 5 days |

Showdown rankings are derived from stored results using the same ordering as the daily leaderboard, **recomputed from historical standings**. A podium or victory is counted for each distinct day in the database; a standing can change if a later player beats an existing score. This is not an immutable, finalized podium award. If immutable podium records are desired, implement a scheduled UTC day-finalization job and historical awards table.

Inventory titles reflect cards **currently owned**, not lifetime acquisitions. Recycling cards can make a title ineligible; the UI hides invalid equipped titles. Achievement titles count **claimed** achievements, not unclaimed eligible achievements.

Public collector titles respect `profiles.public_collection`: private collectors' title progress is not returned to other accounts. The Profile screen offers title progress, category filters, and equip/unequip. Public collector details show the equipped title.

Verification: migration applied, function grants checked. Not yet tested in a signed-in browser with real historical podium data.

## Expanded title milestones

The catalog now includes 30 titles. New milestones include Garage Builder (25 cards), Garage Magnate (250), Master Collector (500), Rare Vault (25 Rare), Blueprint Hoarder (50 Rare), Crown Jewels (20 Legendary/Exotic/Limited), JDM Master (20 distinct Japanese models), Continental Curator (20 distinct European models), Motorsport Historian (12 distinct motorsport models), First Trophy (1 claimed achievement), Trophy Cabinet (7), Grand Completionist (all 10), Daily Driver (25 Showdowns), Podium Elite (15 podiums), and The Undisputed (15 wins).

The original Completionist title still requires five claimed achievements, preserving its previous unlock threshold. Grand Completionist is the new ten-achievement milestone.
