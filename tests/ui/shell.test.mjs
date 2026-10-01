import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV_ITEMS, normalizeRoute } from '../../src/ui/shell.js';

test('shell exposes exactly the four frozen first-class destinations',()=>{
 assert.deepEqual(NAV_ITEMS.map(x=>x.id),['radar','buy','backtest','settings']);
 assert.deepEqual(NAV_ITEMS.map(x=>x.label),['Radar','Comprar','Backtest','Ajustes']);
});

test('unknown routes safely resolve to Radar',()=>{
 assert.equal(normalizeRoute('nonsense'),'radar');
 assert.equal(normalizeRoute(null),'radar');
});

test('all declared routes resolve to themselves',()=>{
 for(const item of NAV_ITEMS) assert.equal(normalizeRoute(item.id),item.id);
});
