import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {NextJob} from '../server/next/store.ts';

const rejectCase=process.argv.includes('--reject');
const minimumReadyProducts=rejectCase?6:5;
const acceptance={schema:'listing-acceptance-v1',minimumReadyProducts,allowedDisplayEditFields:['title','description']};
const input=readFileSync('samples/catalog.json','utf8');
const base='http://127.0.0.1:3107/api/next';
async function request(path:string,body?:unknown){const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(25_000)});const value=await response.json();if(!response.ok)throw new Error(`HTTP${response.status}: ${JSON.stringify(value)}`);return value;}
const startedAt=new Date().toISOString();
const review=await request('/review',{input,format:'json',acceptance});
const mandate={serviceCapLovelace:'2000000',feeCapLovelace:'300000',totalCapLovelace:'2300000',maxActions:1,expiresAt:new Date(Date.now()+(rejectCase?180_000:900_000)).toISOString()};
const initial=await request('/jobs',{input,format:'json',acceptance,acceptanceHash:review.acceptanceHash,mandate});
let job=initial.job as NextJob;
console.log(JSON.stringify({intentId:job.id,status:job.status,acceptanceHash:job.acceptanceHash,minimumReadyProducts,duplicate:!!initial.duplicate}));
const deadline=Date.now()+300_000;let reconciliations=0,lastReconcile=0;
while(!['complete','acceptance_not_met','blocked','failed'].includes(job.status)&&Date.now()<deadline){
 await new Promise(r=>setTimeout(r,2000));
 try{
  const next=(await request(`/jobs/${job.id}`)).job as NextJob;
  if(next.id!==initial.job.id)throw new Error('V2 intent changed during polling.');
  if(next.status!==job.status)console.log(`V2 ${job.id}: ${next.status}`);
  job=next;
  if(job.status==='receipt_unresolved'&&job.payment?.hasSignedPayload&&reconciliations<3&&Date.now()-lastReconcile>20_000){reconciliations++;lastReconcile=Date.now();job=(await request(`/jobs/${job.id}/reconcile`,{})).job;}
 }catch(error){console.log(error instanceof Error?error.message:'Temporary local API error; retaining the same intent.');}
}
const paid=job.status==='complete'&&job.payment?.receipt?.success&&job.manifest;
const rejected=job.status==='acceptance_not_met'&&job.decision?.met===false&&job.payment?.settlementCalls===0&&!job.payment?.receipt;
const pass=rejectCase?rejected:paid;
const evidence={startedAt,checkedAt:new Date().toISOString(),status:pass?'PASS':'PENDING',case:rejectCase?'acceptance_not_met':'acceptance_met',network:'cardano:preprod',asset:'lovelace',inputIsShippedSample:true,
 intentId:job.id,inputHash:job.inputHash,acceptance:job.acceptance,acceptanceHash:job.acceptanceHash,orderHash:job.orderHash,mandate:job.mandate,jobStatus:job.status,paymentStatus:job.payment?.status??null,
 transaction:job.payment?.transaction??null,explorerUrl:job.payment?.explorerUrl??null,receipt:job.payment?.receipt??null,settlementCalls:job.payment?.settlementCalls??0,
 servicePriceLovelace:job.payment?.servicePriceLovelace??null,networkFeeLovelace:job.payment?.networkFeeLovelace??null,sellerNetLovelace:job.payment?.sellerNetLovelace??null,
 resultHash:job.result?createHash('sha256').update(JSON.stringify(job.result)).digest('hex'):null,decision:job.decision??null,manifest:job.manifest??null,resultSummary:job.result?.summary??null,
 events:job.events,paymentEvents:job.payment?.events??[],reason:job.error??null,reconciliations,
 paymentClaim:paid?'New confirmed V2 paid request with a bound delivered result.':rejected?'Signed authorization retained locally; zero settlement calls, no confirmed collection or paid delivery.':'No paid success is claimed.',
 broadcastMeasurement:'Local SDK settlement invocations are counted; hosted facilitator internal broadcasts are not directly observable. No-settlement chain/UTXO observations are recorded separately.'};
mkdirSync('docs/evidence/v2',{recursive:true});
const path=`docs/evidence/v2/${rejectCase?'acceptance-rejected':'payment-live'}.json`;
writeFileSync(path,JSON.stringify(evidence,null,2)+'\n');
if(paid){writeFileSync(`docs/evidence/v2/payment-${job.payment!.transaction}.json`,JSON.stringify(evidence,null,2)+'\n');writeFileSync('docs/evidence/v2/payment-live-result.json',JSON.stringify(job.result,null,2)+'\n');writeFileSync(`docs/evidence/v2/payment-${job.payment!.transaction}-result.json`,JSON.stringify(job.result,null,2)+'\n');}
console.log(JSON.stringify({status:evidence.status,intentId:job.id,jobStatus:job.status,transaction:evidence.transaction,settlementCalls:evidence.settlementCalls,evidence:path,reason:evidence.reason},null,2));
if(!pass)process.exitCode=2;
