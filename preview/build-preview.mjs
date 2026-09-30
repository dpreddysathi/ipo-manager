/* Assembles the mobile preview: real built bundle + mock API shim, one file. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dist = join(root, 'frontend', 'dist');
const assets = join(dist, 'assets');

const cssFile = readdirSync(assets).find((f) => f.endsWith('.css'));
const jsFile = readdirSync(assets).find((f) => f.endsWith('.js'));
if (!cssFile || !jsFile) throw new Error('build the frontend first (dist/assets missing)');

const css = readFileSync(join(assets, cssFile), 'utf8');
const js = readFileSync(join(assets, jsFile), 'utf8');
const shim = readFileSync(join(here, 'mock-api.js'), 'utf8');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>IPO Manager — Mobile Preview</title>
<style>${css}</style>
<style>
/* preview banner — not part of the app */
#preview-banner{position:sticky;top:0;z-index:100;background:#4f46e5;color:#fff;
font:600 12px/1.4 system-ui,sans-serif;padding:8px 12px;text-align:center}
</style>
</head>
<body>
<div id="preview-banner">📱 PREVIEW — sample data, nothing is saved · register/login with anything</div>
<div id="root"></div>
<script>${shim}</script>
<script type="module">${js}</script>
</body>
</html>`;

const out = '/home/hatch/workspace/your_files/ipo-manager-mobile-preview.html';
writeFileSync(out, html);
console.log('wrote', out, `(${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
