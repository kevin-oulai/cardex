import * as api from '../api.js';
import { S, groups, spares, ownedModels, isFavorite, toggleFavorite, toggleWish, updatePrefs, syncInventory } from '../store.js';
import { CARS, TIERS, TIER_COLOR, FINISHES, COUNTRIES, tierIndex, recycleValue } from '../catalog.js';
import { card, icon, toast, sheet, confirm, busy, empty } from '../ui.js';
import { esc, num, plural, friendly, local, debounce } from '../util.js';
import { photo, paint } from '../photos.js';
import { burstAt } from '../fx.js';
import { play } from '../sfx.js';
import { tutorialEvent } from '../tutorial.js';

const FINISH_RANK = { Standard: 0, Foil: 1, Holographic: 2, Collector: 3 };
export const SORTS = {
  recent: ['Recently pulled', (a, b) => b.latest - a.latest],
  rarity: ['Rarity', (a, b) => tierIndex(CARS[b.id].rarity) - tierIndex(CARS[a.id].rarity) || FINISH_RANK[b.finish] - FINISH_RANK[a.finish]],
  name: ['Name', (a, b) => CARS[a.id].name.localeCompare(CARS[b.id].name)],
  hp: ['Power', (a, b) => CARS[b.id].hp - CARS[a.id].hp],
  speed: ['Top speed', (a, b) => CARS[b.id].speed - CARS[a.id].speed],
  light: ['Lightest', (a, b) => CARS[a.id].weight - CARS[b.id].weight],
  year: ['Newest model', (a, b) => CARS[b.id].year - CARS[a.id].year],
  oldest: ['Oldest model', (a, b) => CARS[a.id].year - CARS[b.id].year],
  copies: ['Most copies', (a, b) => b.copies.length - a.copies.length],
  number: ['Cardex number', (a, b) => a.id - b.id],
};
export function applyFilters(list, f) {
  const q = (f.q || '').trim().toLowerCase();
  return list.filter((g) => {
    const c = CARS[g.id];
    return (!q || c.name.toLowerCase().includes(q) || String(c.year).includes(q)) &&
      (!f.rarity || c.rarity === f.rarity) && (!f.drive || c.drive === f.drive) && (!f.country || c.country === f.country) &&
      (!f.finish || g.finish === f.finish) && (!f.dupes || g.copies.length > 1) &&
      (!f.fav || isFavorite(g.id)) && (!f.wish || S.prefs.collector.wishlist.includes(g.id)) &&
      (!f.missing || !g.owned);
  }).sort(SORTS[f.sort]?.[1] || SORTS.recent[1]);
}
export function filterBar(f, { dex = false, extras = true } = {}) {
  return `<div class="filters">
    <label class="search">${icon('search')}<input class="input" type="search" name="q" value="${esc(f.q || '')}" placeholder="Search make, model or year" aria-label="Search"></label>
    <select class="input" name="sort" aria-label="Sort">${Object.entries(SORTS).filter(([k]) => !(dex && (k === 'copies' || k === 'recent'))).map(([k, [l]]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <div class="chips" role="group" aria-label="Rarity">${['', ...TIERS].map((t) => `<button type="button" class="chip-btn ${f.rarity === t ? 'on' : ''}" data-rarity="${t}" style="--c:${TIER_COLOR[t] || 'var(--ink)'}">${t || 'All'}</button>`).join('')}</div>
    ${extras ? `<details class="more-filters"><summary class="btn ghost sm">${icon('sliders')} Filters<span class="filter-count"></span></summary>
      <div class="more-grid">
        <select class="input" name="drive" aria-label="Drivetrain"><option value="">Any drivetrain</option>${['RWD', 'FWD', 'AWD'].map((d) => `<option ${f.drive === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
        <select class="input" name="country" aria-label="Country"><option value="">Any country</option>${COUNTRIES.map((c) => `<option ${f.country === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        ${dex ? '' : `<select class="input" name="finish" aria-label="Finish"><option value="">Any finish</option>${FINISHES.map((x) => `<option ${f.finish === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`}
        ${dex ? `<label class="check"><input type="checkbox" name="missing" ${f.missing ? 'checked' : ''}> Missing only</label><label class="check"><input type="checkbox" name="wish" ${f.wish ? 'checked' : ''}> Wishlist</label>`
    : `<label class="check"><input type="checkbox" name="dupes" ${f.dupes ? 'checked' : ''}> Duplicates</label><label class="check"><input type="checkbox" name="fav" ${f.fav ? 'checked' : ''}> Favourites</label><label class="check"><input type="checkbox" name="group" ${f.group !== false ? 'checked' : ''}> Stack copies</label>`}
      </div></details>` : ''}
  </div>`;
}
export function bindFilters(root, f, onChange) {
  const fire = () => { onChange(); count(); };
  const count = () => {
    const n = ['drive', 'country', 'finish', 'dupes', 'fav', 'wish', 'missing'].filter((k) => f[k]).length + (f.group === false ? 1 : 0);
    const c = root.querySelector('.filter-count'); if (c) c.textContent = n ? ` · ${n}` : '';
  };
  count();
  root.querySelector('[name=q]').addEventListener('input', debounce((e) => { f.q = e.target.value; fire(); }, 120));
  root.addEventListener('change', (e) => {
    const t = e.target; if (!t.name || t.name === 'q') return;
    f[t.name] = t.type === 'checkbox' ? t.checked : t.value;
    fire();
  });
  root.querySelector('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rarity]'); if (!b) return;
    f.rarity = b.dataset.rarity;
    root.querySelectorAll('[data-rarity]').forEach((x) => x.classList.toggle('on', x === b));
    play('tick'); fire();
  });
}

const PAGE = 96;
const KEY = 'cardex-garage-v2';

export default {
  title: 'Garage',
  mount({ el, watch, go }) {
    const f = Object.assign({ mode: 'owned', sort: 'recent', group: true, rarity: '' }, local.get(KEY, {}));
    let limit = PAGE;
    el.innerHTML = `<header class="page-head"><div><span class="eyebrow">Your collection</span><h1>Garage</h1></div>
        <div class="seg mode" role="tablist">
          <button role="tab" data-mode="owned">${icon('grid')} My cars</button>
          <button role="tab" data-mode="dex">${icon('book')} Cardex</button>
        </div></header>
      <div class="garage-summary"></div>
      <div class="filter-host"></div>
      <div class="card-grid" aria-live="polite"></div>
      <div class="more-host"></div>`;
    const grid = el.querySelector('.card-grid'), host = el.querySelector('.filter-host');

    const save = () => local.set(KEY, { ...f, q: '' });
    const buildFilters = () => {
      host.innerHTML = filterBar(f, { dex: f.mode === 'dex' });
      bindFilters(host, f, () => { limit = PAGE; save(); renderGrid(); });
      el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === f.mode)));
    };
    const list = () => {
      if (f.mode === 'dex') {
        const owned = ownedModels();
        return CARS.map((c) => {
          const copies = S.cards.filter((x) => x.id === c.id);
          const best = copies.reduce((m, x) => (FINISH_RANK[x.finish] > FINISH_RANK[m] ? x.finish : m), 'Standard');
          return { key: 'dex' + c.id, id: c.id, finish: best, copies, owned: owned.has(c.id), latest: 0 };
        });
      }
      if (f.group !== false) return groups().map((g) => ({ ...g, owned: true }));
      return S.cards.map((c) => ({ key: 's' + c.sid, id: c.id, finish: c.finish, copies: [c], single: true, owned: true, latest: c.at }));
    };
    function renderSummary() {
      const sp = spares(), owned = ownedModels().size;
      el.querySelector('.garage-summary').innerHTML = `
        <div class="stat-tile"><b class="mono">${num(S.cards.length)}</b><span>cards</span></div>
        <div class="stat-tile"><b class="mono">${owned}<small>/${CARS.length}</small></b><span>models</span></div>
        <div class="stat-tile"><b class="mono">${num(sp.n)}</b><span>spares</span></div>
        <button class="btn recycle-all" ${sp.n ? '' : 'disabled'}>${icon('recycle')} Recycle spares <small class="mono">≤ +${num(sp.value)}</small></button>`;
    }
    function renderGrid() {
      const all = applyFilters(list(), f);
      const shown = all.slice(0, limit);
      if (!S.cards.length && f.mode === 'owned') {
        grid.innerHTML = empty('Your garage is empty', 'Open your first booster to start the collection.', '<button class="btn primary" data-go="packs">Open a booster</button>');
      } else if (!all.length) {
        grid.innerHTML = empty('No cars match', 'Loosen the filters or clear the search.');
      } else {
        const wish = S.prefs.collector.wishlist;
        grid.innerHTML = shown.map((g) => {
          const serial = g.single ? g.copies[0].serial : g.copies.length === 1 ? g.copies[0].serial : null;
          const badges = (isFavorite(g.id) && g.owned ? `<span class="fav-badge" title="Favourite">${icon('star')}</span>` : '') +
            (!g.owned && wish.includes(g.id) ? `<span class="wish-badge" title="On wishlist">${icon('heart')}</span>` : '') +
            (f.mode === 'dex' ? `<span class="dex-no mono">#${String(g.id + 1).padStart(3, '0')}</span>` : '');
          return `<button class="card-btn" data-inspect="${g.id}" data-finish="${g.finish}" aria-label="${esc(CARS[g.id].name)}${g.owned ? '' : ' (not owned)'}">${card(g.id, {
            finish: g.finish, serial, count: f.mode === 'owned' && !g.single ? g.copies.length : 0, size: 'md', locked: !g.owned, badge: badges,
          })}</button>`;
        }).join('');
      }
      el.querySelector('.more-host').innerHTML = all.length > limit ? `<button class="btn ghost wide" data-more>Show ${Math.min(PAGE, all.length - limit)} more · ${num(all.length - limit)} hidden</button>` : '';
      paint(grid);
    }
    const render = () => { renderSummary(); renderGrid(); };
    buildFilters(); render();
    watch(['cards', 'prefs'], render);

    el.addEventListener('click', (e) => {
      const m = e.target.closest('[data-mode]');
      if (m && m.dataset.mode !== f.mode) { f.mode = m.dataset.mode; if (f.mode === 'dex' && (f.sort === 'recent' || f.sort === 'copies')) f.sort = 'number'; if (f.mode === 'owned' && f.sort === 'number') f.sort = 'recent'; limit = PAGE; save(); buildFilters(); renderGrid(); play('toggle'); return; }
      if (e.target.closest('[data-more]')) { limit += PAGE; renderGrid(); return; }
      const i = e.target.closest('[data-inspect]');
      if (i) return inspect(Number(i.dataset.inspect), i.dataset.finish, go);
      const r = e.target.closest('.recycle-all');
      if (r) recycleFlow(r, null, null);
    });
  },
};

async function recycleFlow(btn, carId, finish) {
  const label = carId == null ? 'all spare copies' : `spare ${finish} copies of the ${CARS[carId].name}`;
  const ok = await confirm({
    title: 'Recycle duplicates?',
    body: `Recycles ${esc(label)} for credits. One copy of every model + finish is always kept, and cards that are listed on the market or were used in a Showdown are protected.`,
    ok: 'Recycle',
  });
  if (!ok) return;
  return busy(btn, async () => {
    try {
      const r = await api.recycle(carId, finish);
      if (r.wallet) S.wallet = r.wallet;
      await syncInventory();
      if (!r.count) return toast('Nothing to recycle — remaining spares are protected.', 'info');
      play('coin'); if (btn.isConnected) burstAt(btn, { color: ['#ffb000', '#fff'], count: 22 });
      toast(`Recycled ${plural(r.count, 'card')} · +${num(r.credits)} credits`, 'reward');
    } catch (e) { toast(friendly(e), 'error'); }
  });
}

/** Card inspector, usable from anywhere. */
export function inspect(id, finish, go) {
  const c = CARS[id];
  const copies = S.cards.filter((x) => x.id === id).sort((a, b) => FINISH_RANK[b.finish] - FINISH_RANK[a.finish] || a.serial - b.serial);
  const owned = copies.length > 0;
  finish = owned ? (copies.some((x) => x.finish === finish) ? finish : copies[0].finish) : 'Standard';
  const same = copies.filter((x) => x.finish === finish);
  const p = photo(id);
  const slots = S.prefs.collector.showcase;
  const html = `<div class="inspector">
    <div class="inspector-card">${card(id, { finish, serial: same[0]?.serial, size: 'big', locked: !owned })}</div>
    <div class="inspector-info">
      <span class="eyebrow" style="color:${TIER_COLOR[c.rarity]}">${c.rarity} · #${String(id + 1).padStart(3, '0')}</span>
      <h2>${esc(c.make)} <span>${esc(c.model)}</span></h2>
      <dl class="spec-list">
        <div><dt>Power</dt><dd class="mono">${num(c.hp)} hp</dd></div><div><dt>Top speed</dt><dd class="mono">${c.speed} km/h</dd></div>
        <div><dt>Weight</dt><dd class="mono">${num(c.weight)} kg</dd></div><div><dt>Drive</dt><dd>${c.drive}</dd></div>
        <div><dt>Year</dt><dd class="mono">${c.year}</dd></div><div><dt>Origin</dt><dd>${esc(c.country)}</dd></div>
        <div><dt>Recycle value</dt><dd class="mono">${recycleValue(id)} cr</dd></div><div><dt>Power / weight</dt><dd class="mono">${Math.round((c.hp / c.weight) * 1000)} hp/t</dd></div>
      </dl>
      ${owned ? `<div class="copies"><span class="eyebrow">Your copies · ${copies.length}</span><div class="copy-list">${copies.slice(0, 40).map((x) => `<span class="copy f-${x.finish.toLowerCase()}" title="${x.finish}">#${String(x.serial).padStart(5, '0')}<small>${x.finish === 'Standard' ? '' : x.finish}</small></span>`).join('')}${copies.length > 40 ? `<span class="copy">+${copies.length - 40}</span>` : ''}</div></div>` : '<p class="muted">You don’t own this car yet. Every theme that includes it can drop it.</p>'}
      <div class="inspector-actions">
        ${owned ? `
          <button class="btn ${isFavorite(id) ? 'on' : ''}" data-a="fav">${icon('star')} ${isFavorite(id) ? 'Favourited' : 'Favourite'}</button>
          <button class="btn primary" data-a="race">${icon('flag')} Race in Showdown</button>
          <button class="btn" data-a="sell">${icon('tag')} Sell</button>
          <button class="btn" data-a="recycle" ${same.length > 1 ? '' : 'disabled'} title="Keeps one ${finish} copy">${icon('recycle')} Recycle ${same.length > 1 ? same.length - 1 : ''} spare${same.length === 2 ? '' : 's'}</button>
          <div class="showcase-pick"><span class="small muted">Showroom slot</span><div class="seg">${[0, 1, 2].map((i) => `<button class="${slots[i] === id ? 'on' : ''}" data-slot="${i}" aria-pressed="${slots[i] === id}">${i + 1}</button>`).join('')}</div></div>`
    : `<button class="btn ${S.prefs.collector.wishlist.includes(id) ? 'on' : ''}" data-a="wish">${icon('heart')} ${S.prefs.collector.wishlist.includes(id) ? 'On wishlist' : 'Add to wishlist'}</button>`}
      </div>
      ${p ? `<a class="credit" href="${esc(p.credit)}" target="_blank" rel="noopener noreferrer">Photo: Wikimedia Commons — licence &amp; author ↗</a>` : ''}
    </div></div>`;
  return sheet(html, {
    cls: 'wide', label: c.name,
    onOpen: (d, close) => {
      paint(d);
      tutorialEvent('inspect');
      d.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        const slot = e.target.closest('[data-slot]');
        if (slot) {
          const i = Number(slot.dataset.slot);
          updatePrefs((pr) => { const s = pr.collector.showcase; for (let k = 0; k < 3; k++) if (s[k] === id) s[k] = null; if (slots[i] !== id) s[i] = id; });
          d.querySelectorAll('[data-slot]').forEach((b) => { const on = S.prefs.collector.showcase[Number(b.dataset.slot)] === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
          play('toggle'); toast('Showroom updated', 'success', 1600);
        }
        if (a === 'fav') { toggleFavorite(id); const on = isFavorite(id); e.target.closest('button').classList.toggle('on', on); e.target.closest('button').innerHTML = `${icon('star')} ${on ? 'Favourited' : 'Favourite'}`; play('toggle'); }
        if (a === 'wish') { toggleWish(id); const on = S.prefs.collector.wishlist.includes(id); e.target.closest('button').classList.toggle('on', on); e.target.closest('button').innerHTML = `${icon('heart')} ${on ? 'On wishlist' : 'Add to wishlist'}`; play('toggle'); }
        if (a === 'race') { close(); (go || window.cardexGo)('showdown/' + id); }
        if (a === 'sell') { close(); (go || window.cardexGo)('market/sell/' + (same[same.length - 1] || copies[0]).sid); }
        if (a === 'recycle') { close(); recycleFlow(document.createElement('button'), id, finish); }
      });
    },
  });
}
