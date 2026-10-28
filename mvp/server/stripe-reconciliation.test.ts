import assert from 'node:assert/strict';
import {test} from 'node:test';
import type Stripe from 'stripe';
import {normalizeStripeEvent} from './stripe-reconciliation.js';

function event(type: string, object: Record<string,unknown>, livemode=false): Stripe.Event {
 return {id:'evt_test_123',type,livemode,data:{object},created:1720000000,object:'event',api_version:'2024-06-20'} as unknown as Stripe.Event;
}

test('paid checkout session is successful',()=>{
 const result=normalizeStripeEvent(event('checkout.session.completed',{id:'cs_1',payment_status:'paid',payment_intent:'pi_1',amount_total:2500,currency:'usd'}));
 assert.equal(result.state,'succeeded');
 assert.equal(result.paymentIntentId,'pi_1');
 assert.equal(result.amountCents,2500);
 assert.equal(result.livemode,false);
});

test('unpaid checkout completion does not imply settlement',()=>{
 const result=normalizeStripeEvent(event('checkout.session.completed',{id:'cs_2',payment_status:'unpaid',amount_total:2500}));
 assert.equal(result.state,'pending');
});

test('async checkout failures are recorded as failures',()=>{
 const result=normalizeStripeEvent(event('checkout.session.async_payment_failed',{id:'cs_3',payment_intent:{id:'pi_3'}}));
 assert.equal(result.state,'failed');
 assert.equal(result.paymentIntentId,'pi_3');
});

test('invoice payment records invoice reference',()=>{
 const result=normalizeStripeEvent(event('invoice.paid',{id:'in_1',amount_paid:1000,currency:'usd'}));
 assert.equal(result.invoiceId,'in_1');
 assert.equal(result.state,'succeeded');
});

test('refund event is marked refunded, not successful',()=>{
 const result=normalizeStripeEvent(event('charge.refunded',{id:'ch_1',amount:1000,currency:'usd'}));
 assert.equal(result.state,'refunded');
});

test('unrecognized event has no fabricated settlement state',()=>{
 const result=normalizeStripeEvent(event('customer.updated',{id:'cus_1'}));
 assert.equal(result.state,undefined);
});
