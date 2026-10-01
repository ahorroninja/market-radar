import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, restoreBackup } from '../../src/storage/backup.js';

const state={settings:{monthlyContribution:1000,apiKey:'secret',assets:[{id:'world',enabled:true,targetWeight:1}]},marketCache:{world:{assetId:'world',points:[{date:'2026-09-30',close:100}],asOf:'2026-09-30',source:'test'}}};

test('backup excludes secrets by default',()=>{
 const b=createBackup(state,{includeSecrets:false,now:'2026-10-01T12:00:00.000Z'});
 assert.equal(b.schemaVersion,1); assert.equal(b.secretsIncluded,false); assert.equal('apiKey' in b.settings,false);
});

test('backup includes secrets only when explicitly requested',()=>{
 const b=createBackup(state,{includeSecrets:true,now:'2026-10-01T12:00:00.000Z'});
 assert.equal(b.settings.apiKey,'secret'); assert.equal(b.secretsIncluded,true);
});

test('valid backup round-trips settings and cache',()=>{
 const b=createBackup(state,{includeSecrets:true,now:'2026-10-01T12:00:00.000Z'});
 const restored=restoreBackup(b,state);
 assert.deepEqual(restored.settings,state.settings); assert.deepEqual(restored.marketCache,state.marketCache);
});

test('invalid backup throws and leaves supplied current state untouched',()=>{
 const current=structuredClone(state); const before=structuredClone(current);
 assert.throws(()=>restoreBackup({schemaVersion:99,settings:{}},current),e=>e?.code==='INVALID_BACKUP');
 assert.deepEqual(current,before);
});

test('invalid monthly contribution is rejected during restore',()=>{
 const b=createBackup(state,{includeSecrets:false,now:'2026-10-01T12:00:00.000Z'}); b.settings.monthlyContribution=-1;
 assert.throws(()=>restoreBackup(b,state),e=>e?.code==='INVALID_BACKUP');
});
