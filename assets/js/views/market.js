import * as api from '../api.js';
import { S, syncInventory } from '../store.js';
import { CARS, TIERS, TIER_COLOR, marketFee, recycleValue } from '../catalog.js';
import { card, icon, toast, confirm, busy, empty } from '../ui.js';
import { esc, num, friendly, relTime, debounce } from '../util.js';
import { paint } from '../photos.js';
import { play } from '../sfx.js';
import { burstAt } from '../fx.js';

const TABS = { browse: 'Browse', sell: 'Sell', mine: 'My listings', history: 'History' };
const thumb = (id) => `<span class="thumb"><img data-photo="${id}" alt=""></span>`;

export default {
  title: 'Market',
  mount({ el, params, go }) {
    const tab = TABS[params[0]] ? params[0] : 'browse';
    const preselect = Number(params[1]) || null;
    let listings = null, mine = null, f = { q: '', rarity: '', sort: 'new' }, pick = preselect, sq = '';
    el.innerHTML = `<header class="page-head"><div><span class="eyebrow">Player exchange</span><h1>Market</h1></div>
      <nav class="seg tabs" aria-label="Market sections">${Object.entries(TABS).map(([k, l]) => `<a href="#/market/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${l}<span class="tab-count" data-count="${k}"></span></a>`).join('')}</nav></header>
      <div class="market-body">${'<div class="card-grid">' + '<div class="card-skel"></div>'.repeat(6) + '</div>'}</div>`;
    const body = el.querySelector('.market-body');

    async function load() {
      try {
        [listings, mine] = await Promise.all([api.marketList(), api.marketMine()]);
        el.querySelector('[data-count="mine"]').textContent = mine.listings.length ? ' ' + mine.listings.length : '';
        render();
      } catch (e) { body.innerHTML = empty('Market unavailable', esc(friendly(e)), '<button class="btn" data-reload>Retry</button>'); }
    }

    function listingCard(x, kind) {
      const c = CARS[x.car_id]; if (!c) return '';
      const own = x.seller_id === S.user?.id;
      return `<article class="listing">
        ${card(x.car_id, { finish: x.finish, serial: x.model_serial, size: 'md' })}
        <div class="listing-info">
          <div class="price mono">${num(x.price)}<small>cr</small></div>
          <span class="small muted">${kind === 'history' ? `${x.side === 'bought' ? 'Bought' : 'Sold'} ${relTime(x.closed_at)}${x.side === 'sold' ? ' · fee ' + num(x.fee) : ''}` : kind === 'mine' ? 'Listed ' + relTime(x.created_at) : own ? 'Your listing' : `by <button class="link" data-collector="${esc(x.seller_id)}">${esc(x.seller_name)}</button>`}</span>
          ${kind === 'history' ? '' : kind === 'mine' || own ? `<button class="btn sm" data-cancel="${x.id}">Cancel</button>` : `<button class="btn primary sm" data-buy="${x.id}" ${S.wallet?.credits >= x.price ? '' : 'disabled title="Not enough credits"'}>Buy</button>`}
        </div></article>`;
    }

    function render() {
      if (!listings) return;
      if (tab === 'browse') {
        const q = f.q.trim().toLowerCase();
        const rows = listings.filter((x) => CARS[x.car_id] && (!f.rarity || CARS[x.car_id].rarity === f.rarity) && (!q || CARS[x.car_id].name.toLowerCase().includes(q) || (x.seller_name || '').toLowerCase().includes(q)))
          .sort((a, b) => f.sort === 'cheap' ? a.price - b.price : f.sort === 'dear' ? b.price - a.price : f.sort === 'rarity' ? TIERS.indexOf(CARS[b.car_id].rarity) - TIERS.indexOf(CARS[a.car_id].rarity) : Date.parse(b.created_at) - Date.parse(a.created_at));
        body.innerHTML = `<div class="filters compact">
            <label class="search">${icon('search')}<input class="input" type="search" name="q" value="${esc(f.q)}" placeholder="Search cars or sellers" aria-label="Search listings"></label>
            <select class="input" name="rarity" aria-label="Rarity"><option value="">All rarities</option>${TIERS.map((t) => `<option ${f.rarity === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <select class="input" name="sort" aria-label="Sort"><option value="new">Newest</option><option value="cheap" ${f.sort === 'cheap' ? 'selected' : ''}>Lowest price</option><option value="dear" ${f.sort === 'dear' ? 'selected' : ''}>Highest price</option><option value="rarity" ${f.sort === 'rarity' ? 'selected' : ''}>Rarity</option></select>
            <button class="btn ghost sm" data-reload>Refresh</button>
          </div>
          <div class="listing-grid">${rows.length ? rows.map((x) => listingCard(x)).join('') : empty(listings.length ? 'No listings match' : 'The market is quiet', listings.length ? '' : 'Be the first to list a card.', '<a class="btn primary" href="#/market/sell">Sell a card</a>')}</div>`;
        const fl = body.querySelector('.filters');
        fl.querySelector('[name=q]').addEventListener('input', debounce((e) => { f.q = e.target.value; render(); body.querySelector('[name=q]').focus(); const i = body.querySelector('[name=q]'); i.setSelectionRange(i.value.length, i.value.length); }, 200));
        fl.addEventListener('change', (e) => { if (e.target.name !== 'q') { f[e.target.name] = e.target.value; render(); } });
      } else if (tab === 'mine') {
        body.innerHTML = `<p class="small muted">Up to 10 active listings. A 5% fee is taken from the sale price.</p><div class="listing-grid">${mine.listings.length ? mine.listings.map((x) => listingCard(x, 'mine')).join('') : empty('No active listings', '', '<a class="btn primary" href="#/market/sell">Sell a card</a>')}</div>`;
      } else if (tab === 'history') {
        body.innerHTML = `<div class="listing-grid">${mine.history.length ? mine.history.map((x) => listingCard(x, 'history')).join('') : empty('No trades yet')}</div>`;
      } else renderSell();
      paint(body);
    }

    function renderSell() {
      const inv = mine.inventory.filter((x) => CARS[x.car_id]);
      if (pick && !inv.some((x) => x.id === pick)) pick = null;
      const q = sq.toLowerCase();
      const rows = inv.filter((x) => !q || CARS[x.car_id].name.toLowerCase().includes(q))
        .sort((a, b) => TIERS.indexOf(CARS[b.car_id].rarity) - TIERS.indexOf(CARS[a.car_id].rarity) || a.car_id - b.car_id || b.model_serial - a.model_serial);
      const sel = inv.find((x) => x.id === pick);
      const atCap = mine.listings.length >= 10;
      body.innerHTML = `<div class="sell">
        <section class="panel sell-pick"><h2 class="h3">1 · Pick a card</h2>
          <label class="search">${icon('search')}<input class="input" type="search" value="${esc(sq)}" placeholder="Search your cards" aria-label="Search your cards" data-sq></label>
          <div class="ch-list">${rows.length ? rows.slice(0, 200).map((x) => { const c = CARS[x.car_id]; return `<button class="ch ${x.id === pick ? 'on' : ''}" data-pick="${x.id}">${thumb(x.car_id)}<span class="ch-name"><b>${esc(c.name)}</b><small><span class="dot" style="--c:${TIER_COLOR[c.rarity]}"></span>${c.rarity}${x.finish !== 'Standard' ? ' · ' + x.finish : ''}</small></span><span class="mono small">#${String(x.model_serial).padStart(5, '0')}</span></button>`; }).join('') : empty('Nothing to sell', 'Cards already listed are hidden here.')}</div>
        </section>
        <section class="panel sell-form"><h2 class="h3">2 · Set a price</h2>
          ${sel ? (() => {
            const c = CARS[sel.car_id];
            const copies = S.cards.filter((x) => x.id === sel.car_id).length;
            return `<div class="sell-preview">${card(sel.car_id, { finish: sel.finish, serial: sel.model_serial, size: 'md' })}</div>
              ${copies <= 1 ? `<p class="warn">${icon('bolt')} This is your only ${esc(c.name)}. Selling it removes the model from your Cardex.</p>` : ''}
              <label class="field"><span>Price (credits)</span><input class="input mono" type="number" inputmode="numeric" min="10" max="10000000" step="1" data-price placeholder="e.g. ${num(Math.max(10, recycleValue(sel.car_id) * 4))}"></label>
              <div class="fee-calc small"><span>Fee (5%)</span><b class="mono" data-fee>—</b><span>You receive</span><b class="mono" data-net>—</b></div>
              <button class="btn primary lg wide" data-list ${atCap ? 'disabled' : ''}>${icon('tag')} ${atCap ? '10 listings max' : 'List for sale'}</button>`;
          })() : '<p class="muted">Select a card on the left.</p>'}
        </section></div>`;
      body.querySelector('[data-sq]').addEventListener('input', debounce((e) => { sq = e.target.value; renderSell(); paint(body); const i = body.querySelector('[data-sq]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 150));
      const price = body.querySelector('[data-price]');
      price?.addEventListener('input', () => {
        const p = Math.floor(Number(price.value));
        const ok = p >= 10 && p <= 1e7;
        body.querySelector('[data-fee]').textContent = ok ? num(marketFee(p)) : '—';
        body.querySelector('[data-net]').textContent = ok ? num(p - marketFee(p)) : '—';
      });
    }

    body.addEventListener('click', async (e) => {
      if (e.target.closest('[data-reload]')) return load();
      const who = e.target.closest('[data-collector]');
      if (who) return go('collector/' + who.dataset.collector);
      const p = e.target.closest('[data-pick]');
      if (p) { pick = Number(p.dataset.pick); renderSell(); paint(body); play('tick'); body.querySelector('[data-price]')?.focus(); return; }
      const buy = e.target.closest('[data-buy]');
      if (buy) {
        const x = listings.find((l) => l.id === Number(buy.dataset.buy));
        if (!x || !(await confirm({ title: `Buy ${CARS[x.car_id].name}?`, body: `${esc(x.finish)} · serial #${x.model_serial} for <b>${num(x.price)} credits</b>.`, ok: 'Buy' }))) return;
        return busy(buy, async () => {
          try { await api.marketBuy(x.id); play('coin'); burstAt(buy, { color: ['#ffb000', '#fff'] }); toast(`Bought ${CARS[x.car_id].name}`, 'success'); await Promise.all([syncInventory(), load()]); }
          catch (er) { toast(friendly(er), 'error'); load(); }
        });
      }
      const cancel = e.target.closest('[data-cancel]');
      if (cancel) {
        if (!(await confirm({ title: 'Cancel listing?', body: 'The card returns to your garage.', ok: 'Cancel listing' }))) return;
        return busy(cancel, async () => {
          try { await api.marketCancel(Number(cancel.dataset.cancel)); toast('Listing cancelled', 'success'); await load(); } catch (er) { toast(friendly(er), 'error'); }
        });
      }
      const list = e.target.closest('[data-list]');
      if (list) {
        const price = Math.floor(Number(body.querySelector('[data-price]').value));
        if (!(price >= 10 && price <= 1e7)) { toast('Enter a price between 10 and 10,000,000 credits.', 'error'); body.querySelector('[data-price]').focus(); return; }
        return busy(list, async () => {
          try {
            await api.marketCreate(pick, price);
            play('success'); toast(`Listed for ${num(price)} credits`, 'success');
            pick = null; await load();
          } catch (er) { toast(friendly(er), 'error'); }
        });
      }
    });
    load();
  },
};
