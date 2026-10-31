import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {PaymentRequired} from '@x402/core/types';
import {validateQuote,PaymentPolicyError,type PaymentMandate} from '../server/payment/policy.js';

/** Read-only policy replay: only GET requests and deterministic quote validation. */
const base='http://127.0.0.1:3107';
const live=JSON.parse(readFileSync('docs/evidence/payment-live.json','utf8')) as Record<string,unknown>;
const intentId=String(live.intentId??'');
if(live.status!=='PASS'||!/^[A-Za-z0-9_-]{1,100}$/.test(intentId))throw new Error('A confirmed paid job must be recorded before running its policy proof.');
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
async function readJob(){const response=await fetch(`${base}/api/jobs/${encodeURIComponent(intentId)}`,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15_000)});if(!response.ok)throw new Error(`Read-only job lookup returned HTTP ${response.status}.`);const text=await response.text();if(text.length>512_000)throw new Error('Job response exceeded the proof limit.');return object(object(JSON.parse(text)).job);}
function protectedSnapshot(job:Record<string,unknown>){
 const payment=object(job.payment);const events=Array.isArray(payment.events)?payment.events.map(object):[];
 return {intentId:String(job.id??''),inputHash:String(job.inputHash??''),jobStatus:String(job.status??''),paymentStatus:String(payment.status??''),transaction:String(payment.transaction??''),receiptHash:sha(payment.receipt),resultHash:sha(job.result),signedPaymentEvents:events.filter(event=>event.decision==='signed_payment_persisted').length,networkFeeLovelace:String(payment.networkFeeLovelace??''),sellerNetLovelace:String(payment.sellerNetLovelace??'')};
}
const beforeJob=await readJob(),before=protectedSnapshot(beforeJob);
const payment=object(beforeJob.payment),receipt=object(payment.receipt);
const quote=payment.quote as PaymentRequired;
const mandate=payment.mandate as PaymentMandate;
if(before.jobStatus!=='complete'||before.paymentStatus!=='confirmed'||receipt.success!==true||before.transaction!==live.transaction||before.resultHash!==live.resultHash||before.inputHash!==live.inputHash||before.signedPaymentEvents!==1)throw new Error('Current protected state does not match the one recorded successful delegated payment.');
const events=Array.isArray(payment.events)?payment.events.map(object):[];
const acceptedEvent=events.find(event=>event.decision==='quote_accepted');
const decisionAt=String(acceptedEvent?.at??'');
const decisionTime=Date.parse(decisionAt);
if(!Number.isFinite(decisionTime)||decisionTime>Date.now())throw new Error('The original quote validation time is missing or invalid.');
// Reproduce the policy at its actual recorded decision time. This does not renew or act on an expired delegation.
const seller=mandate.allowedSeller,endpoint=mandate.endpoint;
const decisions:{case:string;decision:string;reason:string|null;detail:string}[]=[];
try{validateQuote(quote,mandate,seller,endpoint,decisionTime);decisions.push({case:'original_paid_quote',decision:'accepted',reason:null,detail:'The actual quote fits the unchanged original mandate at its recorded acceptance time.'});}catch(error){decisions.push({case:'original_paid_quote',decision:'unexpected_rejection',reason:error instanceof PaymentPolicyError?error.code:'invalid',detail:'The original paid offer did not reproduce its policy acceptance.'});}
const lowBudget=structuredClone(mandate);lowBudget.serviceCapLovelace='1000000';
try{validateQuote(quote,lowBudget,seller,endpoint,decisionTime);decisions.push({case:'service_cap_1000000_lovelace',decision:'unexpected_acceptance',reason:null,detail:'Budget mutation should have been rejected.'});}catch(error){decisions.push({case:'service_cap_1000000_lovelace',decision:'rejected_before_signing',reason:error instanceof PaymentPolicyError?error.code:'invalid',detail:'The real 2000000 lovelace service exceeds the deliberately reduced 1000000 lovelace cap.'});}
const wrongRecipient=structuredClone(quote);
const buyer=String(receipt.payer??JSON.parse(readFileSync('docs/evidence/payment-preflight.json','utf8')).buyerAddress??'');
if(!buyer.startsWith('addr_test1')||buyer===seller)throw new Error('A distinct public buyer address is required for the wrong-recipient policy case.');
wrongRecipient.accepts[0]!.payTo=buyer;
try{validateQuote(wrongRecipient,mandate,seller,endpoint,decisionTime);decisions.push({case:'quote_recipient_changed_to_buyer',decision:'unexpected_acceptance',reason:null,detail:'Recipient mutation should have been rejected.'});}catch(error){decisions.push({case:'quote_recipient_changed_to_buyer',decision:'rejected_before_signing',reason:error instanceof PaymentPolicyError?error.code:'invalid',detail:'The cloned offer redirects to the public buyer address instead of the fixed seller; no transaction is constructed.'});}
const afterJob=await readJob(),after=protectedSnapshot(afterJob);
const unchanged=JSON.stringify(before)===JSON.stringify(after);
const duplicateReadComparison=before.intentId===after.intentId&&before.inputHash===after.inputHash&&before.transaction===after.transaction&&before.signedPaymentEvents===1&&after.signedPaymentEvents===1;
const passed=decisions[0]?.decision==='accepted'&&decisions[1]?.reason==='over_budget'&&decisions[2]?.reason==='seller_denied'&&unchanged&&duplicateReadComparison;
const evidence={checkedAt:new Date().toISOString(),status:passed?'PASS':'FAIL',network:'cardano:preprod',readOnly:true,intentId,inputHash:before.inputHash,transaction:before.transaction,policyDecisionAt:decisionAt,policyTimeMeaning:'Deterministic replay at the actual recorded quote acceptance time. No mandate expiry is changed, renewed or bypassed; this command never requests a payment.',actualQuote:quote,originalMandate:mandate,decisions,protectedState:{unchanged,before,after},existingIntentReadComparison:{status:duplicateReadComparison?'PASS':'FAIL',detail:'The same recorded input still resolves to the same completed intent, transaction, receipt/result hashes and exactly one signed-payment event. This script performs no duplicate POST; its separate live retry proof is owned by the application executor.'},actionsPerformed:['GET the existing completed job','Validate its actual quote against the original mandate','Validate the same quote against a cloned lower service cap','Validate a cloned wrong-recipient quote against the original mandate','GET the existing completed job again and compare protected state'],economicActionsPerformed:[],warning:'Rejected variants are policy mutations of the actual paid offer; neither is submitted, signed, paid or reconciled. This proof does not replace the separately recorded real Cardano payment.'};
mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/payment-policy-live.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,transaction:before.transaction,decisions:decisions.map(({case:scenario,decision,reason})=>({case:scenario,decision,reason})),protectedStateUnchanged:unchanged,signedPaymentEvents:after.signedPaymentEvents,resultHash:after.resultHash,evidence:'docs/evidence/payment-policy-live.json'},null,2));
if(!passed)process.exitCode=1;
