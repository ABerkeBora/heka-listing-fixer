import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Request,Response} from 'express';
import {encodePaymentSignatureHeader,decodePaymentSignatureHeader} from '@x402/core/http';
import {createPaymentService} from '../server/payment/index.js';
import {PaymentStore,type IntentRecord} from '../server/payment/store.js';
import type {PaymentMandate} from '../server/payment/policy.js';

const seller='addr_test1qrj33p9fj9mu85q55fj9m3tdc4jexk7ehylm6qrta3vd66qysmcy6nrysklxspcs24erkzgt8yeelt4wa92swggjtczsawv229';
const endpoint='http://127.0.0.1:3107/api/service/jobs/batch_test';
const mandate=():PaymentMandate=>({network:'cardano:preprod',asset:'lovelace',allowedSeller:seller,endpoint,beneficiary:'Local catalog owner',serviceCapLovelace:'2000000',feeCapLovelace:'300000',apiFeeCapLovelace:'0',totalCapLovelace:'2300000',maxActions:1,expiresAt:new Date(Date.now()+600_000).toISOString()});
function harness(){const dir=mkdtempSync(join(tmpdir(),'listing-fixer-service-'));const dbPath=join(dir,'payment.sqlite');let resourceCalls=0;const service=createPaymentService({dbPath,walletFile:join(dir,'no-wallet'),sellerAddress:seller,resourceBaseUrl:'http://127.0.0.1:3107',onResource:async()=>{resourceCalls++;return {checked:true};}});return {dir,dbPath,service,resourceCalls:()=>resourceCalls,close:()=>{service.close();rmSync(dir,{recursive:true,force:true});}};}
function response(){const headers:Record<string,string>={};let body:unknown;let code=200;const r={locals:{},setHeader:(k:string,v:string)=>{headers[k]=v;return r;},status:(v:number)=>{code=v;return r;},json:(v:unknown)=>{body=v;return r;}};return {res:r as unknown as Response,headers,body:()=>body,code:()=>code};}
function storedQuote(h:ReturnType<typeof harness>){const store=new PaymentStore(h.dbPath);const r=store.get('batch_test')!;r.quote={x402Version:2,resource:{url:endpoint},accepts:[{scheme:'exact',network:'cardano:preprod',asset:'lovelace',amount:'2000000',payTo:seller,maxTimeoutSeconds:300,extra:{confirmationPolicy:{l1Confirmations:1},areFeesSponsored:false}}]};store.save(r);store.close();return r;}

test('unsigned crash recovery reconciles without network calls or a payment signature',async()=>{
 const h=harness();const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Network should not run');};
 try{h.service.prepare({intentId:'batch_test',inputHash:'a'.repeat(64),mandate:mandate()});const resumed=await h.service.reconcile('batch_test');assert.equal(resumed.hasSignedPayload,false);assert.equal(calls,0);assert.equal(h.resourceCalls(),0);
  assert.throws(()=>h.service.prepare({intentId:'other_batch',inputHash:'a'.repeat(64),mandate:{...mandate(),endpoint:'http://127.0.0.1:3107/api/service/jobs/other_batch'}}),/already has a payment intent/);
 }finally{globalThis.fetch=previous;h.close();}
});
test('receipt timeout and repeated reconciliation send exactly the same persisted signed proof',async()=>{
 const h=harness();const previous=globalThis.fetch;const seen:string[]=[];
 try{h.service.prepare({intentId:'batch_test',inputHash:'a'.repeat(64),mandate:mandate()});const r=storedQuote(h);r.payload={x402Version:2,resource:{url:endpoint},accepted:r.quote!.accepts[0]!,payload:{transaction:'synthetic-signed-bytes-unit-fixture',nonce:'2'.repeat(64)+'#0'}};r.transaction='1'.repeat(64);r.status='receipt_unresolved';
  let db=new PaymentStore(h.dbPath);db.save(r);db.close();
  globalThis.fetch=async(_url,init)=>{seen.push(new Headers(init?.headers).get('PAYMENT-SIGNATURE')!);return new globalThis.Response(JSON.stringify({error:'receipt_unresolved',transaction:r.transaction}),{status:202,headers:{'Content-Type':'application/json'}});};
  const first=await h.service.reconcile(r.id);const second=await h.service.reconcile(r.id);assert.equal(first.transaction,r.transaction);assert.equal(second.transaction,r.transaction);assert.equal(seen.length,2);assert.equal(seen[0],seen[1]);assert.deepEqual(decodePaymentSignatureHeader(seen[0]!).payload,r.payload.payload);assert.equal(h.resourceCalls(),0);
  assert.equal(h.service.prepare({intentId:r.id,inputHash:r.inputHash,mandate:mandate()}).transaction,r.transaction);
 }finally{globalThis.fetch=previous;h.close();}
});
test('concurrent proofs for a different request are rejected without resource execution or protected state mutation',async()=>{
 const h=harness();
 try{h.service.prepare({intentId:'batch_test',inputHash:'a'.repeat(64),mandate:mandate()});const r=storedQuote(h);const payload={x402Version:2,resource:{url:endpoint+'_wrong'},accepted:r.quote!.accepts[0]!,payload:{transaction:'not-even-cbor',nonce:'2'.repeat(64)+'#0'}};const header=encodePaymentSignatureHeader(payload);const outputs=[response(),response()];let nextCalls=0;
  await Promise.all(outputs.map(o=>h.service.sellerMiddleware({params:{id:r.id},get:()=>header} as unknown as Request,o.res,()=>{nextCalls++;})));
  assert.deepEqual(outputs.map(o=>o.code()),[400,400]);assert.ok(outputs.every(o=>(o.body() as {error:string}).error==='quote_binding'));assert.equal(nextCalls,0);assert.equal(h.resourceCalls(),0);const after=h.service.publicIntent(r.id)!;assert.equal(after.hasSignedPayload,false);assert.equal(after.transaction,null);assert.equal(after.result,null);assert.equal(after.status,'ready');
 }finally{h.close();}
});

test('seller never releases cached work for a success receipt with string confirmations',async()=>{
 const h=harness();const previous=globalThis.fetch;let settles=0;
 globalThis.fetch=async(url)=>{
  const path=String(url);
  if(path.endsWith('/supported'))return new globalThis.Response(JSON.stringify({kinds:[{x402Version:2,scheme:'exact',network:'cardano:preprod',extra:{assetTransferMethods:['default'],areFeesSponsored:false,l1Confirmations:{minimum:0,maximum:20}}}],extensions:[],signers:{'cardano:*':[]}}),{status:200,headers:{'Content-Type':'application/json'}});
  if(path.endsWith('/settle')){settles++;return new globalThis.Response(JSON.stringify({success:true,network:'cardano:preprod',transaction:'1'.repeat(64),extra:{status:'confirmed',confirmations:'1'}}),{status:200,headers:{'Content-Type':'application/json'}});}
  throw new Error('Unexpected network operation in synthetic lifecycle test');
 };
 try{
  await h.service.readiness();h.service.prepare({intentId:'batch_test',inputHash:'a'.repeat(64),mandate:mandate()});const r=storedQuote(h);
  // Synthetic verified checkpoint exercises the seller settlement/release boundary, not chain verification.
  r.payload={x402Version:2,resource:{url:endpoint},accepted:r.quote!.accepts[0]!,payload:{transaction:'synthetic-unit-checkpoint',nonce:'2'.repeat(64)+'#0'}};r.transaction='1'.repeat(64);r.status='payment_pending';r.verified=true;r.result={inputHash:r.inputHash,schema:'listing-v1',language:'en',mode:'model_checked',model:{provider:'ollama',called:true,acceptedEdits:1,rejectedEdits:0},products:[{status:'ready',diffs:[{before:'Mug',after:'Mug · 350 ml',source:{parts:[{field:'title',text:'Mug'},{field:'sourceText',text:'350 ml'}]}}]}],summary:{total:1,ready:1,needsSource:0,review:0}};
  const db=new PaymentStore(h.dbPath);db.save(r);db.close();const out=response();out.res.locals.paymentRelease=()=>{};
  await h.service.sellerHandler({params:{id:r.id}} as unknown as Request,out.res);
  assert.equal(settles,1);assert.equal(out.code(),202);assert.equal(h.service.publicIntent(r.id)!.status,'receipt_unresolved');assert.equal(h.service.publicIntent(r.id)!.result,null);assert.equal('result' in (out.body() as object),false);
 }finally{globalThis.fetch=previous;h.close();}
});
