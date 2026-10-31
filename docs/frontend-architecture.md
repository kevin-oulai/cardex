# CARDEX frontend architecture

The game runs on GitHub Pages with **no bundler**.

- `index.html` — shared shell: header, navigation, footer, dialogs, startup loader.
- `pages/boosters.html` — booster opening page.
- `pages/garage.html` — collection and search.
- `pages/duel.html` — daily Showdown.
- `pages/profile.html` — collector identity, titles, showroom, achievements.
- `pages/auth.html` — account login and cloud sync status.
- `assets/styles.css` — shared visual design.
- `assets/game.js` — gameplay, rendering and UI handlers.
- `backend/client.js` — Supabase auth, synchronization and server-authoritative RPCs.

On startup the shell fetches all five HTML fragments, inserts them in order, then loads `assets/game.js` and finally `backend/client.js`. All fragments are present in the DOM before either script runs, preserving existing `getElementById` and page navigation behavior. **This is modular HTML with client-side navigation**, not five separate document navigations; that is deliberate to preserve the existing stateful game and auth integration.

To run locally, serve the directory over HTTP rather than opening `index.html` via `file://`, because page fragments are loaded with `fetch`:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

### Preventing broken markup

Run `node scripts/validate-pages.mjs` to detect mismatched structural tags and duplicate HTML IDs. GitHub Actions runs the same check on pushes and pull requests. The check is lightweight; it is **not** a full HTML validator or browser E2E test.

The Profile bleed bug was caused by `</div></div></details>` instead of `</div></details>` inside the title manager. This is fixed in `pages/profile.html`.

When changing an element ID, search `assets/game.js` and `backend/client.js` for references. When adding a new page, add it to the `ids` array in the startup loader and to the structural validator.
