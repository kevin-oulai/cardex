# CARDEX UI/UX audit — 31 October 2026

Scope: static review of `index.html` and `backend/client.js` for desktop/mobile layout, contrast, navigation, action states, accessibility, and gameplay feedback. This is a source audit, **not** a browser-based accessibility certification or a device test.

## Fixed in this pass
- **P0 Quick Select unreadable:** `.toolbar input,.toolbar select,.toolbar button,select` overrode the `.primary` background, while the dark text color remained. Added explicit primary styling scoped to toolbars and interactive controls, with hover contrast.
- **P1 Showdown selection accessibility:** challenger buttons now announce selection state (`aria-pressed`) and car names; Quick Select moves focus to the projected-score preview, respecting reduced-motion preferences.
- **P1 Bulk booster buttons:** availability is recalculated in `stats()` after purchases/refresh, not only when pack cards are regenerated.
- **P1 Car-detail recycle:** server mode previously displayed a stale “coming next” message despite an active recycling RPC. It now invokes the existing verified server operation with confirmation.
- **P2 Mobile ergonomics:** 44px minimum interactive height for major actions and 48px bottom navigation buttons, plus a toast position above the bottom navigation.
- **P2 Focus/feedback:** consistent keyboard focus rings, improved contrast of Quick Select status, clearer selected-card outline, and atomic live-region toast announcements.

## Remaining issues / validation tasks
| Priority | Finding | Suggested follow-up |
|---|---|---|
| P1 | Booster reveal and car detail overlays use custom `div` modals; focus trapping, initial focus, Escape behavior, and return focus are not fully guaranteed. | Prefer native `dialog` with consistent close/focus behavior. |
| P1 | Online pack bulk opening calls the pack RPC repeatedly, so a mid-batch network error can produce partial success. | Implement a server-side transactional bulk-open RPC or explicitly show partial completion. |
| P1 | Cloud-save conflict UI warns but cannot resolve or merge competing edits. | Add a reload/compare/reapply flow for non-authoritative preferences. |
| P2 | Dense cards and the two-column mobile grid can cause small text at narrow viewport widths. | Device-test 320px/360px widths and use larger type or a one-column mode where necessary. |
| P2 | Several text styles are 10–12px and may be difficult to read at normal mobile viewing distance. | Increase secondary text to ~13–14px, with hierarchy maintained via weight/spacing. |
| P2 | Legacy local-only economy branches remain in `index.html`, even though online play is mandatory. | Remove dead branches to reduce maintenance and regression risk. |
| P2 | Animated rarity effects can be visually intensive. | Verify reduced-motion mode on Android and desktop, including reveal sequences. |
| P3 | Button and label language mixes “pack”, “booster”, and “ticket”. | Standardize terminology: ticket = currency; booster = opened set of five cards. |

## Acceptance test matrix (not yet executed)
1. Desktop Chrome/Firefox: every primary button, toolbar, modal, keyboard tab order and Escape.
2. Android Chrome 320/360/412px: no overflow; Quick Select legible; bottom navigation and toasts unobstructed.
3. Screen reader: selected challenger announcement, Quick Select score, success/error status.
4. Reduced motion: no particles, transitions, or forced smooth scrolling.
5. Online account: ticket buy x1/x5/x10, booster open x1/x5/x10, recycle from Garage and car detail, achievements, Showdown Quick Select.
6. Two devices: concurrent cloud preferences save conflict and recovery.

No database migration was needed for these interface fixes.
