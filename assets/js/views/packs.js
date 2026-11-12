import * as api from '../api.js';
import { S, syncInventory, syncWallet, ownedModels, emit } from '../store.js';
import { THEMES, TIERS, WEIGHTS, TIER_COLOR, FINISH_ODDS, TICKET_PRICE, TICKET_CAP, TICKET_CAP_FREE, PITY_AT, CARS } from '../catalog.js';
import { icon, toast, busy, tierSlug } from '../ui.js';
import { reveal, packArt } from '../reveal.js';
import { friendly, num, plural } from '../util.js';
import { burstAt } from '../fx.js';
import { play } from '../sfx.js';
import { tutorialEvent } from '../tutorial.js';

let opening = false;
/** Open boosters through the server, then play the reveal. Shared by Packs and the reveal's "open again". */
export async function openBooster(theme, quantity, go) {
  if (opening) return;
  if ((S.wallet?.tickets ?? 0) < quantity) {
    toast(`You need ${plural(quantity, 'ticket')} — you have ${S.wallet?.tickets ?? 0}.`, 'error');
    return;
  }
  opening = true;
  let action;
  try {
    const before = ownedModels();
    const res = await api.openPacks(theme, quantity);
    const cards = (res.cards || []).map((c) => {
      const isNew = !before.has(c.id); before.add(c.id);
      return { id: c.id, finish: c.finish, serial: c.serial, isNew };
    });
    const sync = syncInventory().catch((e) => toast('Collection refresh failed: ' + friendly(e), 'error'));
    action = await reveal({ theme, quantity, cards, canRepeat: (q) => (S.wallet?.tickets ?? 0) >= q });
    await sync;
  } catch (e) {
    toast('Booster failed: ' + friendly(e), 'error', 5000);
    syncInventory().catch(() => {});
  } finally { opening = false; }
  if (action) tutorialEvent('packOpened');
  if (action === 'again') return openBooster(theme, quantity, go);
  if (action === 'garage') go('garage');
  return action;
}

export default {
  title: 'Packs',
  mount({ el, go, watch }) {
    el.innerHTML = `
      <header class="page-head"><div><span class="eyebrow">Booster bay</span><h1>Packs</h1></div>
        <div class="ticket-meter" aria-label="Free tickets"></div></header>
      <div class="packs-grid">${THEMES.map((t) => `
        <article class="pack-tile" data-theme="${t.id}">
          <button class="pack-hit" data-open="${t.id}" data-q="1" aria-label="Open one ${t.name} booster">${packArt(t.id)}</button>
          <div class="pack-meta">
            <h3>${t.name}</h3>
            <p class="muted">${t.tag}</p>
            <p class="small"><span class="mono">${t.pool}</span> cars · up to <b style="color:${TIER_COLOR[TIERS[t.top]]}">${TIERS[t.top]}</b></p>
          </div>
          <div class="pack-buttons">
            <button class="btn primary" data-open="${t.id}" data-q="1">Open</button>
            <button class="btn" data-open="${t.id}" data-q="5">×5</button>
            <button class="btn" data-open="${t.id}" data-q="10">×10</button>
          </div>
        </article>`).join('')}</div>
      <div class="packs-side">
        <section class="panel">
          <h2 class="h3">Guarantees</h2>
          <ul class="guarantees">
            <li>${icon('check')}<span>5 cards per booster, last card <b>Rare or better</b></span></li>
            <li>${icon('check')}<span>Legendary-or-better by booster ${PITY_AT}<small class="muted block">JDM has no Legendary cars — its pity gives the best available tier.</small></span></li>
          </ul>
          <div class="meter pity"><div><span>Pity</span><b class="mono" data-pity></b></div><i><span data-pity-bar></span></i></div>
          <details class="odds"><summary>Base drop rates</summary>
            <table>${TIERS.map((t, i) => `<tr><td><span class="dot" style="--c:${TIER_COLOR[t]}"></span>${t}</td><td class="mono">${WEIGHTS[i]}%</td></tr>`).join('')}</table>
            <table>${Object.entries(FINISH_ODDS).map(([f, p]) => `<tr><td>${f} finish</td><td class="mono">${p}%</td></tr>`).join('')}</table>
            <p class="small muted">Per card, before the final-card floor and pity. Themed boosters draw the nearest available tier.</p>
          </details>
        </section>
        <section class="panel">
          <h2 class="h3">Ticket counter</h2>
          <p class="small muted">Free tickets refill every 10 minutes up to ${TICKET_CAP_FREE}. Buy more with credits (max ${TICKET_CAP}).</p>
          <div class="buy">${[1, 5, 10].map((q) => `<button class="btn" data-buy="${q}">+${q} ${icon('ticket')}<small class="mono">${num(q * TICKET_PRICE)}</small></button>`).join('')}</div>
        </section>
        <section class="panel">
          <h2 class="h3">Collection</h2>
          <div class="dex-progress"></div>
        </section>
      </div>`;

    const render = () => {
      const w = S.wallet || { tickets: 0, credits: 0, pity: 0 };
      el.querySelectorAll('[data-open]').forEach((b) => { b.disabled = w.tickets < Number(b.dataset.q); });
      el.querySelectorAll('[data-buy]').forEach((b) => { const q = Number(b.dataset.buy); b.disabled = w.credits < q * TICKET_PRICE || w.tickets + q > TICKET_CAP; });
      el.querySelector('[data-pity]').textContent = `${w.pity} / ${PITY_AT}`;
      el.querySelector('[data-pity-bar]').style.width = Math.min(100, (100 * w.pity) / PITY_AT) + '%';
      const slots = Math.max(TICKET_CAP_FREE, w.tickets);
      el.querySelector('.ticket-meter').innerHTML = `<div class="slots">${Array.from({ length: Math.min(slots, 20) }, (_, i) => `<i class="${i < w.tickets ? 'on' : ''}"></i>`).join('')}</div><span><b class="mono">${w.tickets}</b> ticket${w.tickets === 1 ? '' : 's'}</span>`;
      const owned = ownedModels();
      el.querySelector('.dex-progress').innerHTML = `<div class="dex-total"><b class="mono">${owned.size}</b><span>/ ${CARS.length} models</span></div>` +
        TIERS.map((t) => {
          const all = CARS.filter((c) => c.rarity === t), have = all.filter((c) => owned.has(c.id)).length;
          return `<div class="dex-row r-${tierSlug(t)}" style="--c:${TIER_COLOR[t]}"><span>${t}</span><i><span style="width:${(100 * have) / all.length}%"></span></i><b class="mono">${have}/${all.length}</b></div>`;
        }).join('');
    };
    render();
    watch(['wallet', 'cards'], render);

    el.addEventListener('click', (e) => {
      const o = e.target.closest('[data-open]');
      if (o && !o.disabled) {
        const tile = o.closest('.pack-tile');
        tile.classList.add('launch');
        setTimeout(() => tile.classList.remove('launch'), 500);
        return openBooster(Number(o.dataset.open), Number(o.dataset.q), go);
      }
      const b = e.target.closest('[data-buy]');
      if (b) busy(b, async () => {
        const q = Number(b.dataset.buy);
        try {
          const r = await api.buyTickets(q);
          if (r?.wallet) { S.wallet = r.wallet; emit('wallet'); } else await syncWallet();
          play('coin'); burstAt(b, { color: ['#ffb000', '#fff'], count: 16, speed: 5 });
          toast(`+${plural(q, 'ticket')} · −${num(q * TICKET_PRICE)} credits`, 'success');
        } catch (er) { toast(friendly(er), 'error'); }
      });
    });
  },
};
