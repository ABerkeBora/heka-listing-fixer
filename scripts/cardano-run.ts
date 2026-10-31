import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {CatalogResult} from '../shared/catalog.js';
import {pollExistingJob} from './lib/poll-existing-job.js';

// This is the same initial delegation as the UI. It never sends a separate manual payment.
const base='http://127.0.0.1:3107';
const startedAt=new Date().toISOString();
const input=readFileSync('samples/catalog.json','utf8');
const mandate={serviceCapLovelace:'2000000',feeCapLovelace:'300000',totalCapLovelace:'2300000',maxActions:1,expiresAt:new Date(Date.now()+15*60_000).toISOString()};
type PublicJob={id:string;inputHash:string;status:string;createdAt:string;updatedAt:string;events:unknown[];mandate:unknown;payment?:{hasSignedPayload?:boolean;status?:string;transaction?:string|null;receipt?:unknown;servicePriceLovelace?:string|null;networkFeeLovelace?:string|null;facilitatorFeeLovelace?:string|null;sellerNetLovelace?:string|null;events?:unknown[];explorerUrl?:string|null};result?:CatalogResult;error?:string};
async function request(path:string,init?:RequestInit):Promise<unknown>{const response=await fetch(base+path,{...init,redirect:'error',signal:AbortSignal.timeout(25_000)});const body=await response.json();if(!response.ok)throw new Error(`Local API HTTP ${response.status}: ${JSON.stringify(body)}`);return body;}
const initial=await request('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,format:'json',mandate})}) as {job:PublicJob;duplicate?:boolean};
let job=initial.job;
console.log(`Intent ${job.id}: ${job.status}${initial.duplicate?' (existing intent reused)':''}`);
const recovery=await pollExistingJob(job,{
 read:async id=>(await request(`/api/jobs/${encodeURIComponent(id)}`) as {job:PublicJob}).job,
 reconcile:async id=>(await request(`/api/jobs/${encodeURIComponent(id)}/reconcile`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}) as {job:PublicJob}).job,
 onTransition:next=>console.log(`Intent ${next.id}: ${next.status}`),
 onReadError:()=>console.log(`Connection interrupted; watching existing intent ${initial.job.id}. No replacement payment is requested.`),
});
job=recovery.job;
const paid=job.status==='complete'&&job.payment?.status==='confirmed'&&/^[a-f0-9]{64}$/.test(job.payment.transaction??'')&&Boolean(job.result);
const status=paid?'PASS':job.status==='blocked'?'BLOCKED':'PENDING';
const resultHash=job.result?createHash('sha256').update(JSON.stringify(job.result)).digest('hex'):null;
const evidence={startedAt,checkedAt:new Date().toISOString(),recovery:{reconciliations:recovery.reconciliations,readFailures:recovery.readFailures},network:'cardano:preprod',asset:'lovelace',status,inputIsShippedSample:true,
 intentId:job.id,inputHash:job.inputHash,mandate:job.mandate,jobStatus:job.status,paymentStatus:job.payment?.status??null,
 transaction:job.payment?.transaction??null,explorerUrl:job.payment?.explorerUrl??null,receipt:job.payment?.receipt??null,
 servicePriceLovelace:job.payment?.servicePriceLovelace??null,networkFeeLovelace:job.payment?.networkFeeLovelace??null,facilitatorFeeLovelace:job.payment?.facilitatorFeeLovelace??null,sellerNetLovelace:job.payment?.sellerNetLovelace??null,
 resultHash,resultSummary:job.result?.summary??null,events:job.events,paymentEvents:job.payment?.events??[],reason:job.error??null,
 qualification:paid?'Confirmed paid request and matching useful catalog result recorded.':'No qualifying paid request is claimed by this run.',
 note:'This command delegates once through the local application. Repeated commands for the same input reuse/reconcile its existing intent. It never resets chain history or signs a replacement for an existing signed intent.'};
mkdirSync('docs/evidence',{recursive:true});
const output='docs/evidence/payment-live.json';
let previousPaid=false;
if(existsSync(output))try{previousPaid=JSON.parse(readFileSync(output,'utf8')).status==='PASS';}catch{}
const destination=previousPaid&&!paid?'docs/evidence/payment-live-latest-attempt.json':output;
writeFileSync(destination,JSON.stringify(evidence,null,2)+'\n');
if(paid){writeFileSync(`docs/evidence/payment-${job.payment!.transaction}.json`,JSON.stringify(evidence,null,2)+'\n');writeFileSync(`docs/evidence/payment-${job.payment!.transaction}-result.json`,JSON.stringify(job.result,null,2)+'\n');writeFileSync('docs/evidence/payment-live-result.json',JSON.stringify(job.result,null,2)+'\n');}
console.log(JSON.stringify({status,intentId:job.id,transaction:evidence.transaction,resultHash,reason:evidence.reason,evidence:destination},null,2));
if(!paid)process.exitCode=2;
