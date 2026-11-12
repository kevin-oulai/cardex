/* Car photography: Wikipedia lead images, resolved in batches of 50 and cached for a week.
   Was: 16 uncached API round-trips on every page load. */
import { local } from './util.js';

const KEY = 'cardex-photos-v2', TTL = 7 * 864e5;
const cache = new Map();
let ready = null;

function apply(img) {
  const p = cache.get(Number(img.dataset.photo));
  if (!p) return;
  img.addEventListener('load', () => img.closest('.photo')?.classList.add('loaded'), { once: true });
  img.addEventListener('error', () => { img.removeAttribute('src'); img.closest('.photo')?.classList.add('failed'); }, { once: true });
  img.src = p.src;
}
export function paint(root = document) {
  root.querySelectorAll?.('img[data-photo]:not([src])').forEach(apply);
}
export const photo = (id) => cache.get(Number(id)) || null;

async function resolve() {
  const saved = local.get(KEY, null);
  if (saved && Date.now() - saved.at < TTL && saved.map) {
    Object.entries(saved.map).forEach(([k, v]) => cache.set(Number(k), v));
    return;
  }
  const res = await fetch('./car-images.json');
  if (!res.ok) throw new Error('image catalog ' + res.status);
  const { cars } = await res.json();
  const byTitle = new Map();
  for (const e of cars) if (e.article) (byTitle.get(e.article) || byTitle.set(e.article, []).get(e.article)).push(e.id);
  const titles = [...byTitle.keys()];
  const batches = [];
  for (let i = 0; i < titles.length; i += 50) batches.push(titles.slice(i, i + 50));
  await Promise.all(batches.map(async (batch) => {
    const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail%7Cname&pithumbsize=640&pilimit=50&titles=' + encodeURIComponent(batch.join('|'));
    const json = await (await fetch(url)).json();
    const q = json.query || {};
    const alias = new Map();
    (q.normalized || []).forEach((x) => alias.set(x.from, x.to));
    (q.redirects || []).forEach((x) => alias.set(x.from, x.to));
    const pages = new Map(Object.values(q.pages || {}).map((p) => [p.title, p]));
    for (const t of batch) {
      let title = t; for (let i = 0; i < 3 && alias.has(title); i++) title = alias.get(title);
      const p = pages.get(title);
      if (!p?.thumbnail?.source) continue;
      const credit = p.pageimage ? 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(p.pageimage) : 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
      byTitle.get(t).forEach((id) => cache.set(id, { src: p.thumbnail.source, credit }));
    }
  }));
  if (cache.size) local.set(KEY, { at: Date.now(), map: Object.fromEntries(cache) });
}

export function initPhotos() {
  if (ready) return ready;
  ready = resolve().catch((e) => console.warn('CARDEX photos unavailable', e)).then(() => paint());
  let queued = false;
  new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }).observe(document.body, { childList: true, subtree: true });
  return ready;
}
