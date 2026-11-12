import * as api from '../api.js';
import { CARS } from '../catalog.js';
import { card, empty, icon } from '../ui.js';
import { esc, num, friendly } from '../util.js';
import { paint } from '../photos.js';
import { relationButtons, socialClick } from './community.js';
import { filterBar, bindFilters, applyFilters } from './garage.js';

export function cover({ name, avatar, bio, theme, title, stats = [], actions = '' }) {
  return `<section class="cover theme-${esc(theme || 'heritage')}">
    <div class="cover-art" aria-hidden="true"></div>
    <div class="cover-id"><span class="avatar xl">${esc(avatar || '🏎️')}</span>
      <div><h1>${esc(name || 'Collector')}</h1>${title ? `<span class="title-badge">${esc(title)}</span>` : ''}${bio ? `<p class="bio">${esc(bio)}</p>` : ''}</div>
      <div class="cover-actions">${actions}</div></div>
    ${stats.length ? `<div class="cover-stats">${stats.map(([v, l]) => `<div><b class="mono">${v}</b><span>${l}</span></div>`).join('')}</div>` : ''}
  </section>`;
}
export function showroom(items) {
  return `<div class="showroom">${[0, 1, 2].map((i) => { const x = items[i]; return x && CARS[x.car_id] ? `<div class="plinth">${card(x.car_id, { finish: x.finish, serial: x.model_serial, size: 'md' })}</div>` : '<div class="plinth vacant"><span>Empty bay</span></div>'; }).join('')}</div>`;
}

export default {
  title: 'Collector',
  mount({ el, params, watch }) {
    const id = params[0], garageMode = params[1] === 'garage';
    let p = null, garage = null;
    el.innerHTML = '<div class="cover skel"></div>';
    const titleOf = async () => {
      try { const t = await api.titles(id); return t?.titles?.find((x) => x.id === t.equipped && x.unlocked)?.label || null; } catch { return null; }
    };
    async function load() {
      try {
        const [prof, g, title] = await Promise.all([api.publicCollector(id), api.socialGarage(id), titleOf()]);
        if (!prof) { el.innerHTML = empty('Collector not found'); return; }
        p = { ...prof, title }; garage = g;
        draw();
      } catch (e) { el.innerHTML = empty('Couldn’t load collector', esc(friendly(e))); }
    }
    function draw() {
      const stats = p.private ? [] : [[`${num(p.unique_models)}<small>/${CARS.length}</small>`, 'models'], [num(p.cards_owned), 'cards'], [num(p.high_tier_cards), 'Legendary+']];
      const head = cover({ name: p.display_name, avatar: p.avatar, bio: p.bio, theme: p.theme, title: p.title, stats, actions: relationButtons(id) });
      if (p.private) { el.innerHTML = `<a class="back" href="#/community">${icon('arrowL')} Community</a>${head}<div class="panel center">${icon('lock')}<h2 class="h3">Private collection</h2><p class="muted">This collector keeps their garage and Showdown history private.</p></div>`; return; }
      if (garageMode) return drawGarage();
      el.innerHTML = `<a class="back" href="#/community">${icon('arrowL')} Community</a>${head}
        <div class="row between"><h2>Showroom</h2><a class="btn" href="#/collector/${esc(id)}/garage">${icon('garage')} Full garage</a></div>
        ${p.featured_cards?.length ? showroom(p.featured_cards) : '<p class="muted">Nothing on display.</p>'}
        ${p.showroom_chosen === false && p.featured_cards?.length ? '<p class="small muted">Showing their rarest cards — no showroom chosen yet.</p>' : ''}
        <h2>Recent Showdowns</h2>
        <div class="sd-history">${(p.recent_showdowns || []).length ? p.recent_showdowns.map((r) => `<div class="${r.best_score === 100 ? 'cleared' : ''}"><span class="mono">${esc(r.challenge_date)}</span><b class="mono">${Number(r.best_score)}%</b></div>`).join('') : '<p class="muted">No entries yet.</p>'}</div>`;
      paint(el);
    }
    function drawGarage() {
      const f = { q: '', rarity: '', sort: 'rarity' };
      const groups = (garage.cards || []).filter((x) => CARS[x.car_id]).map((x) => ({ key: x.car_id + x.finish, id: x.car_id, finish: x.finish, copies: Array(x.copies).fill(0), first: x.first_serial, owned: true, latest: 0 }));
      el.innerHTML = `<a class="back" href="#/collector/${esc(id)}">${icon('arrowL')} ${esc(p.display_name)}</a>
        <header class="page-head"><div><span class="eyebrow">${esc(p.display_name)}’s collection · view only</span><h1>Garage</h1></div></header>
        <div class="filter-host">${filterBar(f, { extras: false })}</div><div class="card-grid"></div>`;
      const grid = el.querySelector('.card-grid');
      const render = () => {
        const list = applyFilters(groups, f);
        grid.innerHTML = list.length ? list.map((g) => `<div class="card-btn static">${card(g.id, { finish: g.finish, count: g.copies.length, serial: g.copies.length === 1 ? g.first : null })}</div>`).join('') : empty('No cars match');
        paint(grid);
      };
      bindFilters(el.querySelector('.filter-host'), f, render);
      render();
    }
    load();
    watch(['social'], () => { const a = el.querySelector('.cover-actions'); if (a) a.innerHTML = relationButtons(id); });
    el.addEventListener('click', (e) => { socialClick(e); });
  },
};
