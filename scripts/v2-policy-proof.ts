import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateQuote,PaymentPolicyError} from '../server/payment/policy.ts';
import type {NextJob} from '../server/next/store.ts';

const record=JSON.parse(readFileSync('docs/evidence/v2/payment-live.json','utf8'));
const base='http://127.0.0.1:3107';
async function request(path:string,body?:unknown){const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20_000)});return {status:response.status,value:await response.json()};}
const readJob=async()=>((await request(`/api/next/jobs/${record.intentId}`)).value.job as NextJob&{sourceInput:string});
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const snapshot=(job:NextJob)=>({id:job.id,inputHash:job.inputHash,acceptanceHash:job.acceptanceHash,orderHash:job.orderHash,status:job.status,mandate:sha(job.mandate),transaction:job.payment?.transaction,receipt:sha(job.payment?.receipt),result:sha(job.result),manifest:sha(job.manifest),settlementCalls:job.payment?.settlementCalls,signatures:job.payment?.events.filter(event=>event.decision==='signed_payment_persisted').length});
const beforeJob=await readJob();if(beforeJob.status!=='complete'||!beforeJob.payment?.quote||!beforeJob.payment?.receipt?.success)throw new Error('A confirmed V2 request is required.');
const before=snapshot(beforeJob);
const payload={input:beforeJob.sourceInput,format:'json',acceptance:beforeJob.acceptance,acceptanceHash:beforeJob.acceptanceHash,mandate:{serviceCapLovelace:beforeJob.mandate.serviceCapLovelace,feeCapLovelace:beforeJob.mandate.feeCapLovelace,totalCapLovelace:beforeJob.mandate.totalCapLovelace,maxActions:1,expiresAt:new Date(Date.now()+900_000).toISOString()}};
const tamper=await request('/api/next/jobs',{...payload,acceptanceHash:'0'.repeat(64)});
const budget=await request('/api/next/jobs',{...payload,mandate:{...payload.mandate,serviceCapLovelace:'1000000'}});
const duplicates=await Promise.all([request('/api/next/jobs',payload),request('/api/next/jobs',payload)]);
const decisions:{scenario:string;decision:string;code?:string}[]=[];
const acceptedAt=Date.parse(beforeJob.payment.events.find(event=>event.decision==='quote_accepted')!.at);
try{validateQuote(beforeJob.payment.quote,beforeJob.mandate,beforeJob.mandate.allowedSeller,beforeJob.mandate.endpoint,acceptedAt);decisions.push({scenario:'actual_quote',decision:'accepted'});}catch{decisions.push({scenario:'actual_quote',decision:'unexpected_rejection'});}
try{validateQuote(beforeJob.payment.quote,{...beforeJob.mandate,serviceCapLovelace:'1000000'},beforeJob.mandate.allowedSeller,beforeJob.mandate.endpoint,acceptedAt);decisions.push({scenario:'quote_exceeds_service_cap',decision:'unexpected_acceptance'});}catch(error){decisions.push({scenario:'quote_exceeds_service_cap',decision:'rejected',code:error instanceof PaymentPolicyError?error.code:'unknown'});}
const changedQuote=structuredClone(beforeJob.payment.quote);
if(changedQuote.extensions?.['listing-acceptance']) ((changedQuote.extensions['listing-acceptance'] as {info:Record<string,unknown>}).info).acceptanceHash='f'.repeat(64);
else changedQuote.resource!.url=beforeJob.mandate.endpoint.replace(/next_[a-f0-9]+/,'next_'+ 'f'.repeat(32));
try{validateQuote(changedQuote,beforeJob.mandate,beforeJob.mandate.allowedSeller,beforeJob.mandate.endpoint,acceptedAt);decisions.push({scenario:'quote_acceptance_changed',decision:'unexpected_acceptance'});}catch(error){decisions.push({scenario:'quote_acceptance_changed',decision:'rejected',code:error instanceof PaymentPolicyError?error.code:'unknown'});}
const after=snapshot(await readJob());
const checks={tamperedHashRejected:tamper.status===409&&tamper.value.error==='acceptance_binding',changedBudgetRejected:budget.status===409&&budget.value.error==='mandate_immutable',duplicatesReusedOneIntent:duplicates.every(d=>d.status===200&&d.value.duplicate===true&&d.value.job.id===record.intentId),protectedStateUnchanged:JSON.stringify(before)===JSON.stringify(after),oneSignature:after.signatures===1,oneSettlement:after.settlementCalls===1,originalQuoteAccepted:decisions[0]?.decision==='accepted',budgetPolicyRejected:decisions[1]?.code==='over_budget',changedQuoteRejected:decisions[2]?.decision==='rejected'};
const evidence={checkedAt:new Date().toISOString(),status:Object.values(checks).every(Boolean)?'PASS':'FAIL',intentId:record.intentId,transaction:before.transaction,checks,decisions,httpAttempts:[{scenario:'tampered_acceptance_hash',status:tamper.status,error:tamper.value.error},{scenario:'changed_budget',status:budget.status,error:budget.value.error},{scenario:'concurrent_duplicate_retry',statuses:duplicates.map(d=>d.status)}],protectedState:{before,after},note:'Only the original confirmed V2 intent is reused. Policy replay uses its actual quote-acceptance time and never renews the saved mandate. Rejected mutations create no new signature, settlement or paid delivery.'};
writeFileSync('docs/evidence/v2/policy-verification.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,checks,evidence:'docs/evidence/v2/policy-verification.json'},null,2));if(evidence.status!=='PASS')process.exitCode=1;
