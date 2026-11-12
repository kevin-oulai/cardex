// Static checks for the no-build frontend: syntax of every module, resolvable relative imports,
// and that index.html only references files that exist. Run: node scripts/check.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
let failed = 0;
const fail = (m) => { console.error('✗ ' + m); failed++; };

const modules = walk(join(root, 'assets/js')).filter((f) => f.endsWith('.js'));
for (const file of modules) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (e) { fail(`${relative(root, file)}: ${String(e.stderr).split('\n').slice(0, 5).join(' ')}`); }
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:import|export)[^'"`]*?from\s*['"](\.[^'"]+)['"]/g)) {
    if (!existsSync(resolve(dirname(file), m[1]))) fail(`${relative(root, file)} imports missing ${m[1]}`);
  }
}
const html = readFileSync(join(root, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)/g)) if (!existsSync(join(root, m[1]))) fail(`index.html references missing ./${m[1]}`);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
if (dupes.length) fail('duplicate ids in index.html: ' + dupes.join(', '));
try {
  const cars = JSON.parse(readFileSync(join(root, 'car-images.json'), 'utf8')).cars;
  const catalog = (readFileSync(join(root, 'assets/js/catalog-data.js'), 'utf8').match(/^\[".*\],?$/gm) || []).length;
  if (cars.length !== catalog || cars.some((e, i) => e.id !== i)) fail(`car-images.json must list ids 0..${catalog - 1} (has ${cars.length})`);
  cars.forEach((e) => { if (!/^https:\/\/upload\.wikimedia\.org\//.test(e.src || '') || !/^https:\/\/commons\.wikimedia\.org\//.test(e.credit || '')) fail(`car-images.json: car ${e.id} needs a Commons src and credit`); });
} catch (e) { fail('car-images.json: ' + e.message); }
if (failed) process.exit(1);
console.log(`CARDEX check passed: ${modules.length} modules, index.html references OK`);
