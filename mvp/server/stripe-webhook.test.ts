import assert from 'node:assert/strict';
import {test} from 'node:test';
import Stripe from 'stripe';
import {reconcileVerifiedStripeWebhook} from './stripe-reconciliation.js';

const secret='whsec_test_reconciliation';
const stripe=new Stripe('sk_test_dummy');
const raw=Buffer.from(JSON.stringify({id:'evt_test_1',type:'payment_intent.succeeded',livemode:false,created:1800000000,data:{object:{id:'pi_1',amount_received:2000,currency:'usd'}}}));
const signature=stripe.webhooks.generateTestHeaderString({payload:raw.toString(),secret});

test('signed test event reaches durable storage boundary',async()=>{
 const previous=process.env.XPAY_STRIPE_MODE;
 process.env.XPAY_STRIPE_MODE='test';
 try{
  let calls=0;
  const result=await reconcileVerifiedStripeWebhook(raw,signature,secret,stripe,{applyEventOnce:async event=>{calls++;assert.equal(event.eventId,'evt_test_1');return 'inserted';}});
  assert.equal(result,'inserted');
  assert.equal(calls,1);
 }finally{if(previous===undefined)delete process.env.XPAY_STRIPE_MODE;else process.env.XPAY_STRIPE_MODE=previous;}
});

test('invalid signature cannot write ledger event',async()=>{
 const previous=process.env.XPAY_STRIPE_MODE;
 process.env.XPAY_STRIPE_MODE='test';
 try{
  let calls=0;
  await assert.rejects(()=>reconcileVerifiedStripeWebhook(raw,'t=1800000000,v1=invalid',secret,stripe,{applyEventOnce:async()=>{calls++;return 'inserted';}}));
  assert.equal(calls,0);
 }finally{if(previous===undefined)delete process.env.XPAY_STRIPE_MODE;else process.env.XPAY_STRIPE_MODE=previous;}
});

test('production mode rejects webhook before any database write',async()=>{
 const previous=process.env.XPAY_STRIPE_MODE;
 process.env.XPAY_STRIPE_MODE='live';
 try{
  let calls=0;
  await assert.rejects(()=>reconcileVerifiedStripeWebhook(raw,signature,secret,stripe,{applyEventOnce:async()=>{calls++;return 'inserted';}}),/test mode/);
  assert.equal(calls,0);
 }finally{if(previous===undefined)delete process.env.XPAY_STRIPE_MODE;else process.env.XPAY_STRIPE_MODE=previous;}
});
