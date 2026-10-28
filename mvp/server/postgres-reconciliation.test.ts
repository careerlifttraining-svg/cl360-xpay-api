import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Pool, PoolClient} from 'pg';
import {PostgresReconciliationStore} from './postgres-reconciliation.js';

const event={
 eventId:'evt_test_1',eventType:'payment_intent.succeeded',livemode:false,
 stripeObjectId:'pi_test_1',paymentIntentId:'pi_test_1',amountCents:2500,
 currency:'usd',state:'succeeded' as const,receivedAt:'2026-10-28T00:00:00.000Z'
};

test('transaction commits only after durable insert',async()=>{
 const queries:string[]=[];
 const client={
  query:async(sql:string)=>{queries.push(sql);return sql.startsWith('INSERT')?{rowCount:1}:{rowCount:null};},
  release:()=>{queries.push('RELEASE');}
 } as unknown as PoolClient;
 const pool={connect:async()=>client} as unknown as Pool;
 const store=new PostgresReconciliationStore(pool);
 assert.equal(await store.applyEventOnce(event),'inserted');
 assert.deepEqual(queries.map(sql=>sql.split(' ')[0]),['BEGIN','INSERT','COMMIT','RELEASE']);
});

test('duplicate event does not create a second ledger row',async()=>{
 const queries:string[]=[];
 const client={
  query:async(sql:string)=>{queries.push(sql);return sql.startsWith('INSERT')?{rowCount:0}:{rowCount:null};},
  release:()=>{queries.push('RELEASE');}
 } as unknown as PoolClient;
 const store=new PostgresReconciliationStore({connect:async()=>client} as unknown as Pool);
 assert.equal(await store.applyEventOnce(event),'duplicate');
 assert.ok(queries.includes('COMMIT'));
});

test('database failure rolls back and propagates for Stripe retry',async()=>{
 const queries:string[]=[];
 const client={
  query:async(sql:string)=>{queries.push(sql);if(sql.startsWith('INSERT'))throw new Error('database unavailable');return {rowCount:null};},
  release:()=>{queries.push('RELEASE');}
 } as unknown as PoolClient;
 const store=new PostgresReconciliationStore({connect:async()=>client} as unknown as Pool);
 await assert.rejects(()=>store.applyEventOnce(event),/database unavailable/);
 assert.deepEqual(queries.map(sql=>sql.split(' ')[0]),['BEGIN','INSERT','ROLLBACK','RELEASE']);
});

test('rejects malformed event identifiers before opening a transaction',async()=>{
 const store=new PostgresReconciliationStore({connect:async()=>{throw new Error('must not connect');}} as unknown as Pool);
 await assert.rejects(()=>store.applyEventOnce({...event,eventId:''}),/Missing Stripe event identifiers/);
});
