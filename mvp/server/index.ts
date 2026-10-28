import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Stripe from 'stripe';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStagingReconciliationStore} from './postgres-reconciliation.js';
import {reconcileVerifiedStripeWebhook} from './stripe-reconciliation.js';

const app=express(); const port=Number(process.env.PORT||8787);
const stagingWebhookEnabled=process.env.XPAY_STAGING_WEBHOOK_ENABLED==='true';
const stagingReconciliation=stagingWebhookEnabled?createStagingReconciliationStore():null;
// Fail closed: live Stripe link creation requires an explicit, separately reviewed release flag.
const stripeMode=(key:string)=>key.startsWith('sk_live_')?'live':key.startsWith('sk_test_')?'test':'unconfigured';
const liveLinkCreationApproved=()=>process.env.XPAY_LIVE_PAYMENT_LINKS_APPROVED==='true';
app.use(helmet({contentSecurityPolicy:process.env.NODE_ENV==='production'?undefined:false}));
app.use(cors({origin:process.env.APP_URL||'http://localhost:5173'}));
app.post('/api/webhooks/stripe',express.raw({type:'application/json'}),async (req: Request, res: Response)=>{
 const secret=process.env.STRIPE_WEBHOOK_SECRET||'',key=process.env.STRIPE_SECRET_KEY||'',signature=req.header('stripe-signature');
 if(!key.startsWith('sk_test_')||!secret.startsWith('whsec_')||process.env.XPAY_STRIPE_MODE!=='test')return res.status(503).json({error:'Stripe test webhook is not configured'});
 if(!signature)return res.status(400).json({error:'Missing Stripe signature'});
 if(!Buffer.isBuffer(req.body))return res.status(400).json({error:'Expected raw Stripe webhook body'});
 const stripe=new Stripe(key);
 let event: Stripe.Event;
 try {event=stripe.webhooks.constructEvent(req.body,signature,secret,Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS||300));}
 catch {return res.status(400).json({error:'Invalid Stripe webhook signature'});}
 if(event.livemode)return res.status(400).json({error:'Live Stripe events are disabled'});
 // All event types require durable storage; no in-memory deduplication or false acknowledgments.
 if(!stagingReconciliation)return res.status(503).json({error:'Staging reconciliation is not enabled'});
 try {
  const result=await reconcileVerifiedStripeWebhook(req.body,signature,secret,stripe,stagingReconciliation.store);
  return res.json({received:true,duplicate:result==='duplicate'});
 }catch(error){
  console.error('Stripe webhook reconciliation failed',error);
  return res.status(503).json({error:'Stripe event persistence failed; retry required'});
 }
});
app.use(express.json({limit:'100kb'}));
const events:Array<Record<string,unknown>>=[];
type SandboxRecord={id:string;workspaceId:string;createdAt:string;[key:string]:unknown};
const customers:SandboxRecord[]=[{id:'cus_demo_horizon',workspaceId:'careerLift360',name:'Horizon Ability Group',email:'billing@horizon.example',company:'Horizon Ability Group',createdAt:'2026-07-10T16:00:00.000Z'}];
const invoices:SandboxRecord[]=[{id:'inv_demo_001',workspaceId:'careerLift360',number:'INV-000124',customerName:'Northline Legal',amount:320000,status:'sent',dueAt:'2026-07-30',createdAt:'2026-07-12T16:00:00.000Z'}];
const paymentLinks:SandboxRecord[]=[];
const audit=(action:string,actor='demo-admin',metadata={})=>events.unshift({id:crypto.randomUUID(),action,actor,metadata,at:new Date().toISOString()});
const requireRole=(...allowed:string[])=>(req: Request, res: Response, next: NextFunction)=>{if(process.env.NODE_ENV==='production')return res.status(503).json({error:'Staff authentication is not configured for production'});const role=String(req.header('x-demo-role')||'admin');if(!allowed.includes(role))return res.status(403).json({error:'Insufficient role'});next()};
const requireCustomerData=(req: Request, res: Response, next: NextFunction)=>String(process.env.CUSTOMER_DATA_ENABLED ?? '').toLowerCase()==='true'?next():res.status(404).json({error:'Customer data is disabled'});
const requireGptAction=(req: Request, res: Response, next: NextFunction)=>{if(String(process.env.GPT_ACTIONS_ENABLED ?? '').toLowerCase()!=='true')return res.status(404).json({error:'GPT Actions are disabled'});const supplied=req.header('authorization')?.replace(/^Bearer\s+/i,'')||'';const expected=process.env.GPT_ACTIONS_API_KEY||'';if(!expected||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(401).json({error:'Unauthorized'});next()};

app.get('/api/health',(_req: Request, res: Response)=>res.json({ok:true,mode:'sandbox',liveProcessing:false,stagingWebhookEnabled:Boolean(stagingReconciliation),providers:{stripeTestConfigured:Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')),stripeCheckoutEnabled:String(process.env.STRIPE_CHECKOUT_ENABLED ?? '').toLowerCase()==='true',stripeWebhookConfigured:Boolean(process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')),paypal:process.env.PAYPAL_ENABLED==='true',crypto:process.env.CRYPTO_PAYMENTS_ENABLED==='true'}}));
app.get('/api/gpt/finance-summary',requireGptAction,(_req: Request, res: Response)=>res.status(503).json({error:'Verified financial summary is unavailable until Stripe reconciliation is enabled',verified:false}));
app.get('/api/gpt/invoices',requireGptAction,(_req: Request, res: Response)=>{audit('gpt.invoices.read','finance-guard-gpt');res.json({mode:'sandbox',data:invoices.map(({id,number,customerName,amount,status,dueAt,createdAt})=>({id,number,customerName,amount,status,dueAt,createdAt}))});});
app.get('/api/gpt/customers',requireGptAction,requireCustomerData,(_req: Request, res: Response)=>{audit('gpt.customers.read','finance-guard-gpt');res.json({mode:'sandbox',data:customers.map(({id,name,company,createdAt})=>({id,name,company,createdAt}))});});
app.get('/api/dashboard',requireRole('admin','finance','viewer'),(_req: Request, res: Response)=>res.status(503).json({error:'Verified financial dashboard is unavailable until persistent Stripe reconciliation is enabled',verified:false}));
app.get('/api/audit-logs',requireRole('admin'),(_req: Request, res: Response)=>res.json({data:events.slice(0,100)}));
app.post('/api/merchants/onboarding',requireRole('admin'),(req: Request, res: Response)=>{audit('merchant.onboarding.started','demo-admin',{businessName:req.body.businessName});res.status(201).json({id:crypto.randomUUID(),status:'draft',nextStep:'identity_and_business_verification'});});
app.get('/api/customers',requireRole('admin','finance','support','viewer'),requireCustomerData,(_req: Request, res: Response)=>res.json({data:customers}));
app.post('/api/customers',requireRole('admin','finance'),requireCustomerData,(req: Request, res: Response)=>{const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase();if(name.length<2||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'A valid customer name and email are required'});if(customers.some(c=>c.email===email))return res.status(409).json({error:'A customer with this email already exists'});const customer={id:crypto.randomUUID(),workspaceId:'careerLift360',name,email,company:String(req.body.company||'').trim()||undefined,createdAt:new Date().toISOString()};customers.unshift(customer);audit('customer.created','demo-admin',{customerId:customer.id});res.status(201).json(customer);});
app.get('/api/invoices',requireRole('admin','finance','support','viewer'),(_req: Request, res: Response)=>res.json({data:invoices}));
app.post('/api/invoices',requireRole('admin','finance'),(req: Request, res: Response)=>{const amount=Number(req.body.amount),customerName=String(req.body.customerName||'').trim();if(!Number.isInteger(amount)||amount<50||!customerName)return res.status(400).json({error:'Customer and a valid amount are required'});const invoice={id:crypto.randomUUID(),workspaceId:'careerLift360',number:`INV-${Date.now().toString().slice(-6)}`,status:'draft',customerName,amount,dueAt:req.body.dueAt||null,createdAt:new Date().toISOString()};invoices.unshift(invoice);audit('invoice.created','demo-admin',{invoiceId:invoice.id,amount});res.status(201).json(invoice);});
app.get('/api/payment-links',requireRole('admin','finance','support','viewer'),async (_req: Request,res: Response)=>{
 const key=process.env.STRIPE_SECRET_KEY||'';
 const enabled=String(process.env.STRIPE_CHECKOUT_ENABLED??'').toLowerCase()==='true';
 if(enabled&&(key.startsWith('sk_test_')||key.startsWith('sk_live_'))){
  const stripe=new Stripe(key);
  const links=await stripe.paymentLinks.list({limit:100,active:true});
  return res.json({data:links.data.map(link=>({id:link.id,workspaceId:'careerLift360',title:link.metadata?.title||'CL360 xPay service',amount:Number(link.metadata?.amount||0),currency:'usd',mode:stripeMode(key),url:link.url,status:link.active?'Active':'Inactive',createdAt:new Date().toISOString()}))});
 }
 return res.json({data:paymentLinks});
});
app.post('/api/payment-links',requireRole('admin','finance'),async (req: Request,res: Response)=>{
 const amount=Number(req.body.amount);
 const title=String(req.body.title||'CL360 xPay service').trim();
 if(!title)return res.status(400).json({error:'Payment title is required'});
 if(!Number.isInteger(amount)||amount<50||amount>1_000_000)return res.status(400).json({error:'Amount must be an integer from 50 to 1000000 cents'});
 const key=process.env.STRIPE_SECRET_KEY||'';
 const enabled=String(process.env.STRIPE_CHECKOUT_ENABLED??'').toLowerCase()==='true';
if(!enabled||!(key.startsWith('sk_test_')||key.startsWith('sk_live_')))return res.status(503).json({error:'Stripe Checkout is not enabled'});
 if(stripeMode(key)==='live'&&!liveLinkCreationApproved())return res.status(503).json({error:'Live payment link creation is disabled pending production readiness approval'});
 const stripe=new Stripe(key);
 const product=await stripe.products.create({name:title,metadata:{workspace:'careerLift360'}});
 const price=await stripe.prices.create({currency:'usd',unit_amount:amount,product:product.id});
 const link=await stripe.paymentLinks.create({line_items:[{price:price.id,quantity:1}],metadata:{workspace:'careerLift360',title,amount:String(amount)}});
 audit('payment_link.stripe_created','demo-admin',{paymentLinkId:link.id});
 return res.status(201).json({id:link.id,workspaceId:'careerLift360',title,amount,currency:'usd',mode:stripeMode(key),url:link.url,status:'Active',createdAt:new Date().toISOString()});
});
app.post('/api/integrations/cfo/events',requireRole('admin','finance'),(req: Request, res: Response)=>{audit('cfo.event.queued','demo-admin',{type:req.body.type});res.status(202).json({queued:true});});
app.post('/api/paypal/orders',(_req: Request, res: Response)=>res.status(501).json({error:'PayPal sandbox adapter is disabled until sandbox credentials are configured'}));
app.post('/api/crypto/checkout',(_req: Request, res: Response)=>res.status(process.env.CRYPTO_PAYMENTS_ENABLED==='true'?501:404).json({error:'Crypto payments are disabled by feature flag'}));
const distPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
if(process.env.NODE_ENV==='production'){app.use(express.static(distPath,{index:false,maxAge:'1h'}));app.get(/^(?!\/api).*/i,(_req: Request, res: Response)=>res.sendFile(path.join(distPath,'index.html')));}
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction)=>{console.error(err);res.status(500).json({error:'Unexpected server error',requestId:crypto.randomUUID()});});

app.listen(port,'0.0.0.0',()=>console.log(`CL360 xPay API listening in sandbox mode on port ${port}`));
