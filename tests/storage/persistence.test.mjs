import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState,migrateSettings,SETTINGS_KEY } from '../../src/app/persistence.js';

test('RC2 Stooq settings migrate to the current Yahoo worker without losing user portfolio settings',()=>{
 const migrated=migrateSettings({monthlyContribution:1500,holdings:{world:1234},dataProvider:{type:'stooq',proxyUrl:'https://old.example'},assets:[{id:'world',name:'MSCI World',enabled:true,targetWeight:.5,symbols:{stooq:'URTH.US'}}]});
 assert.equal(migrated.monthlyContribution,1500);
 assert.equal(migrated.holdings.world,1234);
 assert.equal(migrated.dataProvider.type,'yahoo-worker');
 assert.equal(migrated.dataProvider.baseUrl,'https://market-radar.ahorradorninja.workers.dev');
 assert.equal(migrated.assets[0].symbols.yahoo,'URTH');
});

test('loadState automatically applies provider migration to persisted settings',()=>{
 const storage={getItem:k=>k===SETTINGS_KEY?JSON.stringify({dataProvider:{type:'stooq'},monthlyContribution:1200}):null};
 const {settings}=loadState(storage);
 assert.equal(settings.monthlyContribution,1200);
 assert.equal(settings.dataProvider.type,'yahoo-worker');
 assert.match(settings.dataProvider.baseUrl,/ahorradorninja\.workers\.dev/);
});
