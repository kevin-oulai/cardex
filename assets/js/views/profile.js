import * as api from '../api.js';
import { S, emit, updatePrefs, syncAchievements, syncTitles, ownedModels, signedOut, claimable } from '../store.js';
import { CARS, AVATARS, PROFILE_THEMES, TITLE_TIERS, levelProgress } from '../catalog.js';
import { titleBadge, celebrate, TIER } from '../titles.js';
import { icon, toast, sheet, busy, card } from '../ui.js';
import { esc, num, friendly } from '../util.js';
import { paint } from '../photos.js';
import { burstAt } from '../fx.js';
import { play } from '../sfx.js';
import { cover, showroom } from './collector.js';
import { startTutorial, tutorialEvent } from '../tutorial.js';

const ACH_ICON = { Boosters: 'packs', Cardex: 'book', Rarity: 'star', Finishes: 'bolt', Regions: 'flag', Showdown: 'trophy', Community: 'users' };
const achTier = (credits) => (credits >= 5000 ? 'ascendant' : credits >= 1500 ? 'mythic' : credits >= 700 ? 'legendary' : credits >= 300 ? 'epic' : 'standard');

export default {
  title: 'Profile',
  mount({ el, watch }) {
    el.innerHTML = `<div class="cover-host"></div>
      <div class="profile-grid">
        <section class="panel edit"><h2 class="h3">Identity</h2>
          <form class="stack" data-identity>
            <label class="field"><span>Display name</span><input class="input" name="name" maxlength="24" required autocomplete="nickname"></label>
            <label class="field"><span>Bio <small class="muted" data-bio-count></small></span><input class="input" name="bio" maxlength="90" placeholder="What do you chase?"></label>
            <div class="field"><span>Avatar</span><div class="avatar-pick">${AVATARS.map((a) => `<button type="button" data-avatar="${a}" aria-label="Avatar ${a}">${a}</button>`).join('')}</div></div>
            <div class="field"><span>Cover</span><div class="theme-pick">${Object.entries(PROFILE_THEMES).map(([k, l]) => `<button type="button" data-theme="${k}" class="theme-${k}"><span>${l}</span></button>`).join('')}</div></div>
            <button class="btn primary" type="submit">Save</button>
          </form>
          <label class="switch"><input type="checkbox" data-public><span class="track"></span><span>Public garage <small class="muted block">Others can browse your cards and Showdown history. Leaderboard entries are always public.</small></span></label>
        </section>
        <section class="panel"><div class="row between"><h2 class="h3">Showroom</h2><span class="small muted">Shown on your public profile</span></div><div class="showroom-host"></div></section>
      </div>
      <section class="panel" id="achievements"><div class="row between wrap"><h2 class="h3">Achievements <small class="muted" data-ach-count></small></h2>
        <button class="btn primary sm" data-claim-all hidden>${icon('coin')} Claim all</button></div><div class="achievements"></div></section>
      <section class="panel" id="titles"><div class="row between wrap"><h2 class="h3">Titles <small class="muted" data-title-count></small></h2><span class="small muted">Cosmetic. Shown on your profile.</span></div>
        <div class="title-stage"></div><div class="titles"></div></section>
      <section class="panel account"><h2 class="h3">Account</h2><p class="small muted" data-email></p>
        <div class="row gap wrap"><button class="btn" data-tour>${icon('bolt')} Replay tutorial</button><button class="btn" data-signout>${icon('logout')} Sign out</button><button class="btn danger ghost" data-delete>${icon('trash')} Delete account</button></div></section>`;

    const form = el.querySelector('[data-identity]');
    let draft = null;
    function drawCover() {
      const c = S.prefs.collector, w = S.wallet || { xp: 0, opened: 0 };
      const lp = levelProgress(w.xp);
      const t = S.titles?.titles?.find((x) => x.id === S.titles.equipped && x.unlocked);
      el.querySelector('.cover-host').innerHTML = cover({
        name: draft?.name ?? S.profile?.display_name, avatar: draft?.avatar ?? c.avatar, bio: draft?.bio ?? c.bio, theme: draft?.theme ?? c.theme, title: t,
        stats: [[lp.level, 'level'], [`${ownedModels().size}<small>/${CARS.length}</small>`, 'models'], [num(S.cards.length), 'cards'], [num(w.opened), 'boosters']],
      });
    }
    function drawForm() {
      const c = S.prefs.collector;
      draft = { name: S.profile?.display_name || 'Collector', bio: c.bio, avatar: c.avatar, theme: c.theme };
      form.name.value = draft.name; form.bio.value = draft.bio;
      el.querySelector('[data-bio-count]').textContent = `${draft.bio.length}/90`;
      el.querySelectorAll('[data-avatar]').forEach((b) => b.classList.toggle('on', b.dataset.avatar === draft.avatar));
      el.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('on', b.dataset.theme === draft.theme));
      el.querySelector('[data-public]').checked = S.profile?.public_collection !== false;
      el.querySelector('[data-email]').textContent = 'Signed in as ' + (S.user?.email || '');
    }
    function drawShowroom() {
      const items = S.prefs.collector.showcase.map((id) => (id != null && ownedModels().has(id) ? { car_id: id, finish: bestFinish(id) } : null));
      el.querySelector('.showroom-host').innerHTML = showroom(items);
      el.querySelectorAll('.showroom-host .plinth').forEach((pl, i) => { pl.dataset.slot = i; pl.setAttribute('role', 'button'); pl.tabIndex = 0; pl.setAttribute('aria-label', `Showroom bay ${i + 1}`); });
      paint(el.querySelector('.showroom-host'));
    }
    function drawAchievements() {
      const list = S.achievements;
      const box = el.querySelector('.achievements');
      if (!list.length) { box.innerHTML = '<p class="muted">Loading achievements…</p>'; return; }
      const done = list.filter((a) => a.claimed).length, ready = claimable();
      el.querySelector('[data-ach-count]').textContent = `${done}/${list.length}`;
      el.querySelector('[data-claim-all]').hidden = ready < 2;
      const cats = [...new Set(list.map((a) => a.category))];
      box.innerHTML = cats.map((cat) => {
        const items = list.filter((a) => a.category === cat);
        const got = items.filter((a) => a.claimed).length;
        return `<div class="ach-track"><div class="ach-cat">${icon(ACH_ICON[cat] || 'trophy')}<b>${esc(cat)}</b><span class="mono small">${got}/${items.length}</span></div><div class="ach-row">${items.map((a) => {
          const ok = a.progress >= a.goal, pct = Math.min(100, (100 * a.progress) / a.goal);
          const state = a.claimed ? 'done' : ok ? 'ready' : 'locked';
          return `<div class="ach ${state} a-${achTier(a.credits)}" style="--p:${pct}">
            <span class="ach-medal"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16"/><circle cx="18" cy="18" r="16" class="arc"/></svg>${a.claimed ? icon('check') : icon(ACH_ICON[cat] || 'trophy')}</span>
            <div class="ach-text"><b>${esc(a.name)}</b><small>${esc(a.description)}</small></div>
            ${a.claimed ? `<span class="ach-paid mono">+${num(a.credits)}</span>` : ok ? `<button class="btn sm primary" data-claim="${a.id}">Claim <small class="mono">+${num(a.credits)}</small></button>` : `<span class="ach-prog mono">${num(a.progress)}/${num(a.goal)}</span>`}</div>`;
        }).join('')}</div></div>`;
      }).join('');
    }
    function drawTitles() {
      const box = el.querySelector('.titles'), stage = el.querySelector('.title-stage');
      if (!S.titles?.titles) { box.innerHTML = '<p class="muted">Loading titles…</p>'; return; }
      const all = S.titles.titles, eq = all.find((t) => t.id === S.titles.equipped && t.unlocked);
      el.querySelector('[data-title-count]').textContent = `${all.filter((t) => t.unlocked).length}/${all.length}`;
      stage.innerHTML = eq ? `<div class="equipped-title t-${esc(eq.tier)}">${titleBadge(eq, { size: 'lg' })}<button class="btn ghost sm" data-equip="">Unequip</button></div>`
        : '<div class="equipped-title empty"><span class="muted">No title equipped — pick one you’ve unlocked below.</span></div>';
      box.innerHTML = TITLE_TIERS.map((tier) => {
        const items = all.filter((t) => t.tier === tier);
        if (!items.length) return '';
        return `<div class="title-tier"><h3 style="--c:${TIER[tier].color}">${TIER[tier].name} <small class="mono">${items.filter((t) => t.unlocked).length}/${items.length}</small></h3><div class="title-grid">${items.map((t) => {
          const isEq = t.id === S.titles.equipped;
          return `<button class="title-tile ${t.unlocked ? 'unlocked' : ''} ${isEq ? 'on' : ''}" ${t.unlocked && !isEq ? `data-equip="${esc(t.id)}"` : 'disabled'} aria-label="${esc(t.label)}${t.unlocked ? '' : ' (locked)'}">
            ${titleBadge(t, { size: 'md', locked: !t.unlocked })}<small>${esc(t.description)}</small>
            ${t.unlocked ? `<span class="tt-state">${isEq ? 'Equipped' : 'Equip'}</span>` : `<i class="bar"><span style="width:${Math.min(100, (100 * t.progress) / Math.max(1, t.goal))}%"></span></i><span class="tt-state mono">${num(t.progress)}/${num(t.goal)}</span>`}</button>`;
        }).join('')}</div></div>`;
      }).join('');
    }
    drawForm(); drawCover(); drawShowroom(); drawAchievements(); drawTitles();
    syncAchievements().catch(() => {}); syncTitles().catch(() => {});
    watch(['wallet', 'cards', 'titles'], drawCover);
    watch(['cards', 'prefs'], drawShowroom);
    watch(['achievements'], drawAchievements);
    watch(['titles'], drawTitles);

    form.addEventListener('input', (e) => {
      if (e.target.name === 'bio') { draft.bio = e.target.value; el.querySelector('[data-bio-count]').textContent = `${draft.bio.length}/90`; }
      if (e.target.name === 'name') draft.name = e.target.value;
      drawCover();
    });
    form.addEventListener('click', (e) => {
      const a = e.target.closest('[data-avatar]'), t = e.target.closest('[data-theme]');
      if (a) { draft.avatar = a.dataset.avatar; el.querySelectorAll('[data-avatar]').forEach((b) => b.classList.toggle('on', b === a)); play('tick'); drawCover(); }
      if (t) { draft.theme = t.dataset.theme; el.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('on', b === t)); play('tick'); drawCover(); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = draft.name.trim().replace(/\s+/g, ' ');
      if (!name) return toast('Display name can’t be empty.', 'error');
      busy(form.querySelector('[type=submit]'), async () => {
        try {
          if (name !== S.profile.display_name) { await api.setName(S.user.id, name); S.profile.display_name = name; emit('profile'); }
          updatePrefs((p) => Object.assign(p.collector, { bio: draft.bio.trim(), avatar: draft.avatar, theme: draft.theme }));
          draft.name = name; form.name.value = name; drawCover();
          toast('Profile saved', 'success');
        } catch (er) { toast(friendly(er), 'error'); }
      });
    });
    el.querySelector('[data-public]').addEventListener('change', async (e) => {
      const t = e.target; t.disabled = true;
      try { const v = await api.setVisibility(t.checked); S.profile.public_collection = v !== false; toast(t.checked ? 'Garage is public' : 'Garage is private', 'success'); }
      catch (er) { t.checked = !t.checked; toast(friendly(er), 'error'); } finally { t.disabled = false; }
    });

    el.addEventListener('click', async (e) => {
      const slot = e.target.closest('.plinth[data-slot]');
      if (slot) return pickShowroom(Number(slot.dataset.slot));
      const c = e.target.closest('[data-claim]');
      if (c) return busy(c, () => claim([Number(c.dataset.claim)], c));
      const all = e.target.closest('[data-claim-all]');
      if (all) return busy(all, () => claim(S.achievements.filter((a) => !a.claimed && a.progress >= a.goal).map((a) => a.id), all));
      const eq = e.target.closest('[data-equip]');
      if (eq) return busy(eq, async () => {
        try {
          S.titles = await api.equipTitle(eq.dataset.equip || null); emit('titles');
          const t = S.titles.titles.find((x) => x.id === eq.dataset.equip);
          if (t) celebrate(t); else toast('Title removed', 'success');
        } catch (er) { toast(friendly(er), 'error'); }
      });
      if (e.target.closest('[data-signout]')) return busy(e.target.closest('button'), async () => { try { await api.auth.signOut(); } catch { signedOut(); } });
      if (e.target.closest('[data-delete]')) deleteFlow();
      if (e.target.closest('[data-tour]')) startTutorial(window.cardexGo);
    });
    async function claim(ids, btn) {
      let total = 0;
      for (const id of ids) {
        try {
          const r = await api.claimAchievement(id);
          total += r.credits;
          if (r.wallet) { S.wallet = r.wallet; emit('wallet'); }
        } catch (er) { toast(friendly(er), 'error'); break; }
      }
      if (total) {
        play('coin'); if (btn.isConnected) burstAt(btn, { color: ['#ffb000', '#fff'], count: 34 });
        toast(`${ids.length > 1 ? ids.length + ' achievements' : 'Achievement'} claimed · +${num(total)} credits`, 'reward');
        tutorialEvent('claimed');
      }
      await syncAchievements(); syncTitles().catch(() => {});
    }
    el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.plinth[data-slot]')) { e.preventDefault(); pickShowroom(Number(e.target.dataset.slot)); } });
  },
};

function bestFinish(id) {
  const rank = { Standard: 0, Foil: 1, Holographic: 2, Collector: 3 };
  return S.cards.filter((c) => c.id === id).reduce((m, c) => (rank[c.finish] > rank[m] ? c.finish : m), 'Standard');
}
function pickShowroom(slot) {
  const ids = [...ownedModels()].sort((a, b) => ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Ultra Rare', 'Legendary', 'Exotic', 'Limited'].indexOf(CARS[b].rarity) - ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Ultra Rare', 'Legendary', 'Exotic', 'Limited'].indexOf(CARS[a].rarity) || a - b);
  const current = S.prefs.collector.showcase[slot];
  sheet(`<h2>Showroom bay ${slot + 1}</h2>
    <label class="search">${icon('search')}<input class="input" type="search" placeholder="Search your cars" data-s></label>
    <div class="pick-grid">${current != null ? `<button class="card-btn clear" data-set="">${icon('x')}<span>Empty this bay</span></button>` : ''}${ids.map((id) => `<button class="card-btn" data-set="${id}" data-name="${esc(CARS[id].name.toLowerCase())}">${card(id, { finish: bestFinish(id), size: 'sm' })}</button>`).join('')}</div>`, {
    cls: 'wide', label: 'Choose showroom car',
    onOpen: (d, close) => {
      paint(d);
      d.querySelector('[data-s]').addEventListener('input', (e) => { const q = e.target.value.toLowerCase(); d.querySelectorAll('[data-name]').forEach((b) => { b.hidden = !b.dataset.name.includes(q); }); });
      d.addEventListener('click', (e) => {
        const b = e.target.closest('[data-set]'); if (!b) return;
        const id = b.dataset.set === '' ? null : Number(b.dataset.set);
        updatePrefs((p) => { const s = p.collector.showcase; for (let k = 0; k < 3; k++) if (id != null && s[k] === id) s[k] = null; s[slot] = id; });
        play('toggle'); close();
      });
    },
  });
}
function deleteFlow() {
  sheet(`<h2>Delete your account?</h2><p class="muted">This permanently deletes your account, every card, your credits and Showdown history. It can’t be undone.</p>
    <form class="stack" data-del><label class="field"><span>Password</span><input class="input" type="password" name="pw" autocomplete="current-password" required></label>
    <label class="field"><span>Type <b class="mono">DELETE MY ACCOUNT</b></span><input class="input" name="phrase" autocomplete="off" required></label>
    <p class="form-msg" role="status"></p><div class="row end gap"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn danger">Delete forever</button></div></form>`, {
    cls: 'small', label: 'Delete account',
    onOpen: (d, close) => d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target, msg = d.querySelector('.form-msg');
      if (f.phrase.value !== 'DELETE MY ACCOUNT') { msg.textContent = 'Type the phrase exactly.'; return; }
      busy(f.querySelector('.danger'), async () => {
        try {
          msg.textContent = 'Deleting…';
          await api.deleteAccount(f.pw.value, f.phrase.value);
          close(); toast('Account deleted', 'success');
          try { await api.auth.signOut(); } catch { /* session already gone */ }
          signedOut();
        } catch (er) { msg.textContent = friendly(er); }
      });
    }),
  });
}
