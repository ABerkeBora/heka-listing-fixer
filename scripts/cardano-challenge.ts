import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {decodePaymentRequiredHeader} from '@x402/core/http';
import {createPaymentService} from '../server/payment/index.js';
import {validateQuote,type PaymentMandate,PaymentPolicyError} from '../server/payment/policy.js';
const base='http://127.0.0.1:3107';
const api=async(path:string,init?:RequestInit)=>{const response=await fetch(base+path,{...init,redirect:'error',signal:AbortSignal.timeout(30_000)});const body=await response.json();if(!response.ok)throw new Error(`Local API HTTP ${response.status}`);return body;};
const status=await api('/api/status') as {payment:{ready:boolean;buyerBalanceLovelace:string|null}};
// This probe is explicitly unpaid. A funded wallet must use cardano:run instead.
if(status.payment.ready||BigInt(status.payment.buyerBalanceLovelace??'0')!==0n)throw new Error('Challenge capture is restricted to the verified unfunded buyer. Use cardano:run for the live paid scenario.');
const caps={serviceCapLovelace:'2000000',feeCapLovelace:'300000',totalCapLovelace:'2300000',expiresAt:new Date(Date.now()+15*60_000).toISOString(),maxActions:1};
const response=await api('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:readFileSync('samples/catalog.json','utf8'),format:'json',mandate:caps})}) as {job:{id:string;inputHash:string;status:string;mandate:PaymentMandate}};
if(response.job.status!=='blocked')throw new Error('Expected an unsigned blocked catalog job; no challenge-only capture attempted.');
const payment=createPaymentService({dbPath:'data/payment.sqlite',resourceBaseUrl:base,onResource:async()=>{throw new Error('This read-only challenge capture never invokes processing.');}});
try{
 const existing=payment.publicIntent(response.job.id);if(existing?.hasSignedPayload)throw new Error('This job already has a signed payment. Reconcile it instead.');
 payment.prepare({intentId:response.job.id,inputHash:response.job.inputHash,mandate:response.job.mandate});
 const challenge=await fetch(payment.endpoint(response.job.id),{redirect:'error',signal:AbortSignal.timeout(30_000)});
 const encoded=challenge.headers.get('PAYMENT-REQUIRED');if(challenge.status!==402||!encoded)throw new Error(`Expected real x402 HTTP402; got${challenge.status}`);
 const quote=decodePaymentRequiredHeader(encoded);validateQuote(quote,response.job.mandate,payment.sellerAddress,payment.endpoint(response.job.id));
 const decisions:{case:string;decision:string;reason:string|null}[]=[];
 for(const [name,changed] of [['over_budget',{...response.job.mandate,serviceCapLovelace:'1000000'}],['wrong_recipient',{...response.job.mandate,allowedSeller:payment.buyerAddress}]] as const){try{validateQuote(quote,changed as PaymentMandate,payment.sellerAddress,payment.endpoint(response.job.id));decisions.push({case:name,decision:'unexpected_accept',reason:null});}catch(e){decisions.push({case:name,decision:'rejected_before_signing',reason:e instanceof PaymentPolicyError?e.code:'invalid'});}}
 const current=payment.publicIntent(response.job.id);
 const evidence={checkedAt:new Date().toISOString(),network:'cardano:preprod',sdkVersion:JSON.parse(readFileSync('node_modules/@x402/cardano/package.json','utf8')).version,intentId:response.job.id,inputHash:response.job.inputHash,transport:'Actual GET to running Listing Fixer protected catalog endpoint',httpStatus:challenge.status,paymentRequired:quote,validatorDecisions:decisions,hasSignedPayload:current?.hasSignedPayload??false,transaction:current?.transaction??null,receipt:current?.receipt??null,qualification:'UNPAID CHALLENGE ONLY. No signature, transaction, settlement, charge or paid result is claimed.'};
 mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/payment-challenge.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{payment.close();}
