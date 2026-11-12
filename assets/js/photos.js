/* Car photography. Each car has a hand-checked Wikimedia Commons photo pinned in car-images.json
   (exact model/generation), so there is no runtime lookup and no guessing from article lead images. */
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

export function initPhotos() {
  if (ready) return ready;
  ready = fetch('./car-images.json?v=4')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('image catalog ' + r.status))))
    .then(({ cars }) => cars.forEach((c) => c.src && cache.set(c.id, { src: c.src, credit: c.credit })))
    .catch((e) => console.warn('CARDEX photos unavailable', e))
    .then(() => paint());
  let queued = false;
  new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }).observe(document.body, { childList: true, subtree: true });
  return ready;
}
