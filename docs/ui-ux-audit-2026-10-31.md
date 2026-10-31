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

## Follow-up implementation (same day)

- **Modal focus and keyboard handling:** Custom Garage/reveal overlays now capture initial focus, contain Tab navigation, restore the invoking control, and support Escape/backdrop. Escape from an unrevealed booster shows its summary rather than discarding results; Escape from summary closes it. This is an improvement to custom modals, not a native-dialog migration.
- **Bulk booster atomicity:** `backend/atomic-bulk-boosters.sql` deployed to Supabase. `cardex_open_packs(theme,quantity)` invokes existing server issuance in one PostgreSQL transaction for 1, 5, or 10 packs. Any failure rolls back the entire operation. Frontend calls this once per batch.
- **Cloud-save recovery:** Profile now exposes **Reload server preferences** on a conflict. The old local cache is backed up under the account-scoped conflict-backup key, and the latest server state is loaded. **Automatic merge is intentionally not attempted** because the state includes server-authoritative wallet/inventory fields. Backup is currently a browser-local safety copy, not an in-app merge UI.
- **Mobile legibility:** Increased minimum secondary text sizes, card names, navigation tap targets, 320–360px single-column layout, modal scroll limits and safe-area spacing.
- **Legacy economy cleanup:** Removed unreachable offline pack generation and offline Showdown reward mutation branches; online RPCs are mandatory.

## Remaining verification, not claimed as completed

- Test in real browsers/devices (especially Android Chrome, Firefox and a 320px viewport), screen reader, and reduced-motion mode.
- Verify focus return and Escape for every overlay and account deletion dialog on a live authenticated session.
- Test the new bulk RPC with a disposable signed-in account (success, insufficient tickets, network interruption), and test conflict recovery with two devices. The database permissions and function presence were checked, but destructive gameplay tests were not run against a real account.
- Future optional refinement: present a side-by-side diff of conflict-backup preferences and server preferences, allowing selective reapplication of safe profile fields.
