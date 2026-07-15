import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Stripe from 'stripe';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const app=express(); const port=Number(process.env.PORT||8787); const processedStripeEvents=new Set<string>();
app.use(helmet({contentSecurityPolicy:process.env.NODE_ENV==='production'?undefined:false}));
app.use(cors({origin:process.env.APP_URL||'http://localhost:5173'}));
app.post('/api/webhooks/stripe',express.raw({type:'application/json'}),(req,res)=>{
 const secret=process.env.STRIPE_WEBHOOK_SECRET||'',key=process.env.STRIPE_SECRET_KEY||'',signature=req.header('stripe-signature');
 if(!key.startsWith('sk_test_')||!secret.startsWith('whsec_'))return res.status(503).json({error:'Stripe test webhook is not configured'});
 if(!signature)return res.status(400).json({error:'Missing Stripe signature'});
 try{const stripe=new Stripe(key);const event=stripe.webhooks.constructEvent(req.body,signature,secret,Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS||300));
  if(event.livemode)return res.status(400).json({error:'Live Stripe events are disabled'});
  if(processedStripeEvents.has(event.id))return res.json({received:true,duplicate:true});processedStripeEvents.add(event.id);
  if(processedStripeEvents.size>5000)processedStripeEvents.delete(processedStripeEvents.values().next().value!);
  const supported=['checkout.session.completed','checkout.session.expired','payment_intent.succeeded','payment_intent.payment_failed'];
  audit(supported.includes(event.type)?`stripe.${event.type}`:'stripe.event.ignored','stripe-webhook',{eventId:event.id,type:event.type,livemode:event.livemode});return res.json({received:true});
 }catch{return res.status(400).json({error:'Invalid Stripe webhook signature'});}
});
app.use(express.json({limit:'100kb'}));
const events:Array<Record<string,unknown>>=[];
type SandboxRecord={id:string;workspaceId:string;createdAt:string;[key:string]:unknown};
const customers:SandboxRecord[]=[{id:'cus_demo_horizon',workspaceId:'careerLift360',name:'Horizon Ability Group',email:'billing@horizon.example',company:'Horizon Ability Group',createdAt:'2026-07-10T16:00:00.000Z'}];
const invoices:SandboxRecord[]=[{id:'inv_demo_001',workspaceId:'careerLift360',number:'INV-000124',customerName:'Northline Legal',amount:320000,status:'sent',dueAt:'2026-07-30',createdAt:'2026-07-12T16:00:00.000Z'}];
const paymentLinks:SandboxRecord[]=[];
const audit=(action:string,actor='demo-admin',metadata={})=>events.unshift({id:crypto.randomUUID(),action,actor,metadata,at:new Date().toISOString()});
const requireRole=(...allowed:string[])=>(req:express.Request,res:express.Response,next:express.NextFunction)=>{const role=String(req.header('x-demo-role')||'admin');if(!allowed.includes(role))return res.status(403).json({error:'Insufficient role'});next()};
const requireCustomerData=(req:express.Request,res:express.Response,next:express.NextFunction)=>process.env.CUSTOMER_DATA_ENABLED==='true'?next():res.status(404).json({error:'Customer data is disabled'});
const requireGptAction=(req:express.Request,res:express.Response,next:express.NextFunction)=>{if(process.env.GPT_ACTIONS_ENABLED!=='true')return res.status(404).json({error:'GPT Actions are disabled'});const supplied=req.header('authorization')?.replace(/^Bearer\s+/i,'')||'';const expected=process.env.GPT_ACTIONS_API_KEY||'';if(!expected||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(401).json({error:'Unauthorized'});next()};

app.get('/api/health',(_req,res)=>res.json({ok:true,mode:'sandbox',liveProcessing:false,providers:{stripeTestConfigured:Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')),stripeCheckoutEnabled:process.env.STRIPE_CHECKOUT_ENABLED==='true',stripeWebhookConfigured:Boolean(process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')),paypal:process.env.PAYPAL_ENABLED==='true',crypto:process.env.CRYPTO_PAYMENTS_ENABLED==='true'}}));
app.get('/api/gpt/finance-summary',requireGptAction,(_req,res)=>{audit('gpt.finance_summary.read','finance-guard-gpt');res.json({workspace:'CareerLift360 LLC',mode:'sandbox',currency:'USD',grossVolumeCents:673000,successfulPayments:48,outstandingInvoiceCents:invoices.reduce((sum,item)=>item.status==='paid'?sum:sum+Number(item.amount||0),0),activeCustomers:customers.length,disclaimer:'Sandbox operational data only. Not financial, legal, tax, or investment advice.'});});
app.get('/api/gpt/invoices',requireGptAction,(_req,res)=>{audit('gpt.invoices.read','finance-guard-gpt');res.json({mode:'sandbox',data:invoices.map(({id,number,customerName,amount,status,dueAt,createdAt})=>({id,number,customerName,amount,status,dueAt,createdAt}))});});
app.get('/api/gpt/customers',requireGptAction,requireCustomerData,(_req,res)=>{audit('gpt.customers.read','finance-guard-gpt');res.json({mode:'sandbox',data:customers.map(({id,name,company,createdAt})=>({id,name,company,createdAt}))});});
app.get('/api/dashboard',requireRole('admin','finance','viewer'),(_req,res)=>res.json({grossVolume:6730,successfulPayments:48,outstandingInvoices:3850,activeCustomers:36,currency:'USD'}));
app.get('/api/audit-logs',requireRole('admin'),(_req,res)=>res.json({data:events.slice(0,100)}));
app.post('/api/merchants/onboarding',requireRole('admin'),(req,res)=>{audit('merchant.onboarding.started','demo-admin',{businessName:req.body.businessName});res.status(201).json({id:crypto.randomUUID(),status:'draft',nextStep:'identity_and_business_verification'});});
app.get('/api/customers',requireRole('admin','finance','support','viewer'),requireCustomerData,(_req,res)=>res.json({data:customers}));
app.post('/api/customers',requireRole('admin','finance'),requireCustomerData,(req,res)=>{const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase();if(name.length<2||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'A valid customer name and email are required'});if(customers.some(c=>c.email===email))return res.status(409).json({error:'A customer with this email already exists'});const customer={id:crypto.randomUUID(),workspaceId:'careerLift360',name,email,company:String(req.body.company||'').trim()||undefined,createdAt:new Date().toISOString()};customers.unshift(customer);audit('customer.created','demo-admin',{customerId:customer.id});res.status(201).json(customer);});
app.get('/api/invoices',requireRole('admin','finance','support','viewer'),(_req,res)=>res.json({data:invoices}));
app.post('/api/invoices',requireRole('admin','finance'),(req,res)=>{const amount=Number(req.body.amount),customerName=String(req.body.customerName||'').trim();if(!Number.isInteger(amount)||amount<50||!customerName)return res.status(400).json({error:'Customer and a valid amount are required'});const invoice={id:crypto.randomUUID(),workspaceId:'careerLift360',number:`INV-${Date.now().toString().slice(-6)}`,status:'draft',customerName,amount,dueAt:req.body.dueAt||null,createdAt:new Date().toISOString()};invoices.unshift(invoice);audit('invoice.created','demo-admin',{invoiceId:invoice.id,amount});res.status(201).json(invoice);});
app.get('/api/payment-links',requireRole('admin','finance','support','viewer'),(_req,res)=>res.json({data:paymentLinks}));
app.post('/api/payment-links',requireRole('admin','finance'),async(req,res)=>{
 const amount=Number(req.body.amount); if(!Number.isInteger(amount)||amount<50||amount>1_000_000)return res.status(400).json({error:'Amount must be an integer from 50 to 1000000 cents'});
 if(process.env.STRIPE_CHECKOUT_ENABLED!=='true'||!process.env.STRIPE_SECRET_KEY){const link={id:crypto.randomUUID(),workspaceId:'careerLift360',title:String(req.body.title||'CL360 xPay service'),amount,currency:'usd',mode:'simulated',url:`${process.env.APP_URL||'http://localhost:5173'}/pay/demo`,createdAt:new Date().toISOString()};paymentLinks.unshift(link);audit('payment_link.simulated','demo-admin',{paymentLinkId:link.id});return res.status(201).json(link);}
 if(!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_'))return res.status(503).json({error:'MVP accepts Stripe test keys only'});
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
 const session=await stripe.checkout.sessions.create({mode:'payment',line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:amount,product_data:{name:String(req.body.title||'CL360 xPay service')}}}],success_url:`${process.env.APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${process.env.APP_URL}/payment/cancel`,metadata:{workspace:'careerLift360'}});
 audit('payment_link.stripe_created','demo-admin',{sessionId:session.id});res.status(201).json({id:session.id,mode:'stripe_test',url:session.url});
});
app.post('/api/integrations/cfo/events',requireRole('admin','finance'),(req,res)=>{audit('cfo.event.queued','demo-admin',{type:req.body.type});res.status(202).json({queued:true});});
app.post('/api/paypal/orders',(_req,res)=>res.status(501).json({error:'PayPal sandbox adapter is disabled until sandbox credentials are configured'}));
app.post('/api/crypto/checkout',(_req,res)=>res.status(process.env.CRYPTO_PAYMENTS_ENABLED==='true'?501:404).json({error:'Crypto payments are disabled by feature flag'}));
const distPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
if(process.env.NODE_ENV==='production'){app.use(express.static(distPath,{index:false,maxAge:'1h'}));app.get(/^(?!\/api).*/i,(_req,res)=>res.sendFile(path.join(distPath,'index.html')));}
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);res.status(500).json({error:'Unexpected server error',requestId:crypto.randomUUID()});});
if(process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_'))throw new Error('Live Stripe keys are prohibited until the production-processing gate is implemented and approved.');
app.listen(port,'0.0.0.0',()=>console.log(`CL360 xPay API listening in sandbox mode on port ${port}`));
