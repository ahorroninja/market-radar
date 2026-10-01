import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV_ITEMS } from '../../src/ui/shell.js';
import { VIEW_RENDERERS } from '../../src/ui/views.js';
import { DEFAULT_SETTINGS } from '../../src/domain/defaults.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('every shell route has a real renderer',()=>{
 for(const {id} of NAV_ITEMS) assert.equal(typeof VIEW_RENDERERS[id],'function',`missing renderer ${id}`);
});

test('browser entry point wires CSS and module bootstrap to existing files',()=>{
 const html=read('public/index.html');
 assert.match(html,/id="app"/);
 assert.match(html,/\.\/styles\.css/);
 assert.match(html,/\.\.\/src\/main\.js/);
 assert.ok(fs.existsSync(path.join(root,'public/styles.css')));
 assert.ok(fs.existsSync(path.join(root,'src/main.js')));
});

test('bottom navigation styling is fixed and four-column',()=>{
 const css=read('public/styles.css');
 assert.match(css,/\.bottom-nav\{[^}]*position:fixed/);
 assert.match(css,/grid-template-columns:repeat\(4,1fr\)/);
});

test('default configuration is immediately usable by Comprar',()=>{
 assert.ok(Number.isInteger(DEFAULT_SETTINGS.monthlyContribution));
 assert.ok(DEFAULT_SETTINGS.monthlyContribution>0);
 const enabled=DEFAULT_SETTINGS.assets.filter(a=>a.enabled);
 assert.ok(enabled.length>=2);
 const target=enabled.reduce((s,a)=>s+a.targetWeight,0);
 assert.ok(Math.abs(target-1)<1e-12);
});

test('V3 bootstrap uses only V3 storage keys and no legacy overlay names',()=>{
 const main=read('src/main.js');
 assert.match(main,/market-radar-v3-settings/);
 assert.match(main,/market-radar-v3-cache/);
 assert.doesNotMatch(main,/v25|v251|v26-ui|monkey/i);
});
