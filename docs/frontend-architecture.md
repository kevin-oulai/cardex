# CARDEX frontend architecture

No bundler, no framework: native ES modules served as-is by GitHub Pages.

```
index.html            shell only — top bar, tab bar, toast host
assets/css/app.css    the whole design system
assets/js/main.js     boot → session → hash router → view.mount(ctx)
          api.js      Supabase client + every server call
          store.js    S (state), on/emit, preference saving, derived data
          views/*.js  one module per route; each exports { title, mount(ctx) }
```

## Routing
Hash routes: `#/packs`, `#/garage`, `#/showdown[/carId]`, `#/market/(browse|sell|mine|history)[/serialId]`,
`#/profile`, `#/community/(friends|requests|find)`, `#/collector/<uuid>[/garage]`. Unauthenticated users always get the auth view.
`ctx` gives a view its root element, route params, `watch(keys, fn)` and `interval(fn, ms)`; both are cleaned up automatically on navigation.

## State
`store.js` owns everything. Server data (wallet, cards, showdown, titles, claims, social) is replaced wholesale from RPCs and announced with
`emit('wallet')`, `emit('cards')`, … Views re-render on the keys they watch.

**Preferences** (avatar, bio, cover theme, showroom, wishlist, favourites) live in `player_saves.state` as `{ v: 2, collector, favorites }`,
saved through `cardex_save_preferences` with optimistic revision checks. Economy data is **never** written there (the old client copied the whole
inventory into it, which hit the 64 KB limit at roughly 500 cards and then silently stopped saving).

## Effects
- `fx.js`: one shared canvas for particles, screen shake/flash, number tweening, pointer-driven card tilt. All respect `prefers-reduced-motion`.
- `sfx.js`: Web Audio synthesis, unlocked on first gesture, mute toggle persisted per device.

## Server contract
The catalog in `catalog-data.js` is indexed by `car_id` and must stay identical to `public.vehicle_catalog`. Rules in `catalog.js`
(scoring, odds, recycle values) only drive previews; the RPCs are authoritative.
