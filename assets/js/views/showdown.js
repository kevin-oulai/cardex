import * as api from '../api.js';
import { S, syncShowdown, syncInventory, emit } from '../store.js';
import { CARS, MILESTONES, TIER_COLOR, scoreAgainst, predictedBossId } from '../catalog.js';
import { card, icon, toast, busy, empty } from '../ui.js';
import { esc, num, friendly, utcDay, msToUtcMidnight, timeLeft, sleep, reducedMotion, plural } from '../util.js';
import { paint } from '../photos.js';
import { burstAt, confetti, countTo } from '../fx.js';
import { play } from '../sfx.js';

const thumb = (id) => `<span class="thumb"><img data-photo="${id}" alt=""></span>`;

export default {
  title: 'Showdown',
  mount({ el, params, watch, interval, go }) {
    let chosen = Number.isInteger(Number(params[0])) && params[0] !== undefined ? Number(params[0]) : null;
    let q = '';
    el.innerHTML = `<header class="page-head"><div><span class="eyebrow">Daily Showdown · UTC ${utcDay()}</span><h1>Showdown</h1></div>
        <div class="reset small muted">${icon('clock')} New boss in <b class="mono" data-reset></b></div></header>
      <section class="boss"></section>
      <div class="sd-layout">
        <section class="panel challengers"><div class="row between"><h2 class="h3">Your challengers</h2><span class="small muted" data-count></span></div>
          <label class="search">${icon('search')}<input class="input" type="search" placeholder="Filter your cars" aria-label="Filter challengers"></label>
          <div class="ch-list" role="listbox" aria-label="Challengers"></div></section>
        <section class="panel compare" aria-live="polite"></section>
      </div>
      <section class="panel board"><div class="row between"><h2 class="h3">Leaderboard</h2><button class="btn ghost sm" data-refresh>Refresh</button></div>
        <p class="small muted">First to 100% ranks first; then highest score, earliest wins ties.</p><div class="lb"></div></section>`;
    const tick = () => { el.querySelector('[data-reset]').textContent = timeLeft(msToUtcMidnight()); };
    tick(); interval(tick, 1000);

    const boss = () => CARS[S.bossId ?? predictedBossId(utcDay())];
    const candidates = () => {
      const b = boss();
      return [...new Set(S.cards.map((c) => c.id))].filter((id) => id !== b.id).map((id) => ({ id, ...scoreAgainst(CARS[id], b) }))
        .sort((x, y) => y.score - x.score || y.wins - x.wins || y.avg - x.avg || x.id - y.id);
    };

    function renderBoss() {
      const b = boss(), best = S.showdown.best, claimed = S.showdown.claimed || [];
      el.querySelector('.boss').innerHTML = `
        <div class="boss-card">${card(b.id, { size: 'big', finish: 'Holographic' })}<span class="boss-tag">BOSS</span></div>
        <div class="boss-info">
          <span class="eyebrow" style="color:${TIER_COLOR[b.rarity]}">Today’s boss · ${b.rarity}</span>
          <h2>${esc(b.make)} <span>${esc(b.model)}</span></h2>
          <div class="boss-stats">
            <div><small>Power</small><b class="mono">${num(b.hp)}<i>hp</i></b></div>
            <div><small>Top speed</small><b class="mono">${b.speed}<i>km/h</i></b></div>
            <div><small>Weight</small><b class="mono">${num(b.weight)}<i>kg</i></b></div>
          </div>
          <p class="small muted">Score = your average edge in power, top speed and lightness (each capped at 150%). 100% needs an 8% overall edge <em>and</em> winning 2 of 3 stats. Unlimited attempts — only your best counts.</p>
          <div class="best-row"><div class="best"><b class="mono" data-best>${best}</b><span>% today’s best</span></div>
            <ol class="ms-track">${MILESTONES.map((m, i) => `<li class="${claimed.includes(i) ? 'claimed' : best >= m.at ? 'reached' : ''}" style="--at:${m.at}">
              <span class="node">${claimed.includes(i) ? icon('check') : m.at}</span>
              <small>${[m.credits ? num(m.credits) + ' cr' : '', m.tickets ? '+' + m.tickets + ' ticket' : ''].filter(Boolean).join(' · ')}</small></li>`).join('')}
              <span class="track-fill" style="width:${best}%"></span></ol></div>
        </div>`;
      paint(el.querySelector('.boss'));
    }
    function renderList() {
      const all = candidates();
      if (chosen != null && !all.some((x) => x.id === chosen)) chosen = null;
      if (chosen == null && all.length && !q) chosen = all[0].id;
      const shown = all.filter((x) => !q || CARS[x.id].name.toLowerCase().includes(q));
      el.querySelector('[data-count]').textContent = plural(all.length, 'eligible car');
      el.querySelector('.ch-list').innerHTML = shown.length ? shown.slice(0, 150).map((x, i) => {
        const c = CARS[x.id];
        return `<button class="ch ${x.id === chosen ? 'on' : ''}" role="option" aria-selected="${x.id === chosen}" data-pick="${x.id}">
          ${thumb(x.id)}<span class="ch-name"><b>${esc(c.name)}</b><small><span class="dot" style="--c:${TIER_COLOR[c.rarity]}"></span>${c.rarity}${!q && i === 0 ? ' · <em>Best pick</em>' : ''}</small></span>
          <span class="ch-wins">${x.parts.map((p) => `<i class="${p.win ? 'w' : 'l'}" title="${p.label}"></i>`).join('')}</span>
          <span class="ch-score mono ${x.score === 100 ? 'max' : ''}">${x.score}%</span></button>`;
      }).join('') : empty(S.cards.length ? 'No match' : 'No cars yet', S.cards.length ? '' : 'Open a booster to get challengers.', S.cards.length ? '' : '<button class="btn primary" data-go="packs">Open a booster</button>');
      paint(el.querySelector('.ch-list'));
      renderCompare();
    }
    function renderCompare() {
      const box = el.querySelector('.compare'), b = boss();
      if (chosen == null) { box.innerHTML = '<p class="muted">Pick a challenger.</p>'; return; }
      const c = CARS[chosen], r = scoreAgainst(c, b);
      box.innerHTML = `<div class="vs"><div>${thumb(c.id)}<b>${esc(c.model)}</b></div><span class="vs-mark">VS</span><div>${thumb(b.id)}<b>${esc(b.model)}</b></div></div>
        ${r.parts.map((p) => `<div class="cmp ${p.win ? 'win' : 'lose'}"><div class="row between small"><span>${p.label}</span><span class="mono">${num(p.a)} <i>vs</i> ${num(p.b)} ${p.unit}</span></div>
          <div class="cmp-bar"><span style="width:${Math.min(100, (p.ratio / 1.5) * 100)}%"></span><i style="left:${100 / 1.5}%"></i></div></div>`).join('')}
        <div class="projected"><span>Projected</span><b class="mono">${r.score}%</b><small>${r.wins}/3 stats won</small></div>
        <div class="race-track" hidden><div class="lane you">${thumb(c.id)}</div><div class="lane boss">${thumb(b.id)}</div><span class="finish-line"></span></div>
        <button class="btn primary lg wide" data-race>${icon('flag')} Race</button>`;
      paint(box);
    }
    function renderBoard(rows) {
      const box = el.querySelector('.lb');
      if (!rows) { box.innerHTML = '<p class="muted">Loading…</p>'; return; }
      if (!rows.length) { box.innerHTML = '<p class="muted">No verified results yet today. Be first.</p>'; return; }
      box.innerHTML = `<ol class="lb-list">${rows.slice(0, 50).map((r, i) => {
        const me = r.user_id === S.user?.id, clear = r.best_score === 100 && r.first_cleared_at;
        return `<li class="${i < 3 ? 'p' + (i + 1) : ''} ${me ? 'me' : ''}"><button data-collector="${esc(r.user_id)}">
          <span class="rank mono">${i + 1}</span>${thumb(r.car_id)}
          <span class="who"><b>${esc(r.display_name || 'Collector')}${me ? ' <em>you</em>' : ''}</b><small>${esc(CARS[r.car_id]?.name || 'Unknown')}${clear ? ' · cleared ' + new Date(r.first_cleared_at).toISOString().slice(11, 16) + ' UTC' : ''}</small></span>
          <span class="mono score">${Number(r.best_score)}%</span></button></li>`;
      }).join('')}</ol>`;
      paint(box);
    }
    const loadBoard = async () => { renderBoard(null); try { renderBoard(await api.leaderboard(utcDay())); } catch (e) { el.querySelector('.lb').innerHTML = `<p class="muted">Leaderboard unavailable: ${esc(friendly(e))}</p>`; } };

    renderBoss(); renderList(); loadBoard();
    syncShowdown().catch(() => {});
    watch(['showdown'], () => { renderBoss(); renderList(); });
    watch(['cards'], renderList);

    el.querySelector('.challengers input').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); renderList(); });
    el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-pick]');
      if (p) {
        chosen = Number(p.dataset.pick);
        el.querySelectorAll('.ch').forEach((b) => { const on = b === p; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
        renderCompare(); play('tick');
        if (matchMedia('(max-width: 900px)').matches) el.querySelector('.compare').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
        return;
      }
      if (e.target.closest('[data-refresh]')) return loadBoard();
      const who = e.target.closest('[data-collector]');
      if (who) return go('collector/' + who.dataset.collector);
      const r = e.target.closest('[data-race]');
      if (r) race(r);
    });

    async function race(btn) {
      const id = chosen;
      const serial = S.cards.filter((c) => c.id === id).sort((a, b) => a.sid - b.sid)[0];
      if (!serial) return toast('You no longer own that car.', 'error');
      await busy(btn, async () => {
        const box = el.querySelector('.compare'), track = box.querySelector('.race-track');
        const prevBest = S.showdown.best;
        let res;
        try {
          const req = api.submitShowdown(serial.sid);
          if (!reducedMotion()) {
            track.hidden = false; play('race');
            const proj = scoreAgainst(CARS[id], boss()).score;
            track.style.setProperty('--you', Math.min(100, proj) + '%');
            track.style.setProperty('--boss', (proj >= 100 ? 86 : 100) + '%');
            requestAnimationFrame(() => track.classList.add('go'));
            await sleep(1900);
          }
          res = await req;
        } catch (e) { track.hidden = true; return toast(friendly(e), 'error'); }
        S.showdown = { date: res.challenge_date, best: res.best, claimed: res.claimed || [] };
        if (res.wallet) S.wallet = res.wallet;
        emit('showdown', 'wallet');
        const got = [res.awarded_credits ? `+${num(res.awarded_credits)} credits` : '', res.awarded_tickets ? `+${plural(res.awarded_tickets, 'ticket')}` : ''].filter(Boolean).join(' · ');
        const bestEl = el.querySelector('[data-best]'); bestEl.dataset.value = prevBest; countTo(bestEl, res.best, 900);
        if (res.score === 100) { play('success'); confetti(['#ffb000', '#fff', '#ff3b30']); }
        else play(res.best > prevBest ? 'success' : 'tap');
        if (got) { play('coin'); burstAt(bestEl, { color: ['#ffb000', '#fff'], count: 30 }); }
        toast(`Scored ${res.score}%${res.best > prevBest ? ' · new best' : ''}${got ? ' · ' + got : ''}`, got ? 'reward' : 'success', 4200);
        loadBoard();
        syncInventory().catch(() => {});
      });
    }
  },
};
