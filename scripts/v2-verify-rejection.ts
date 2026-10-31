import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {decodeCardanoTransaction,slotToPosixMs} from '@x402/cardano';
import {resultHash,validateAcceptance} from '../server/acceptance.ts';
import type {NextJob} from '../server/next/store.ts';

/** Read-only private checkpoint inspection; never exports the signed payload or keys. */
const rejected=JSON.parse(readFileSync('docs/evidence/v2/acceptance-rejected.json','utf8'));
const jobs=new DatabaseSync('data/v2-jobs.sqlite',{readOnly:true}),payments=new DatabaseSync('data/v2-payment.sqlite',{readOnly:true});
try{
 const jr=jobs.prepare('SELECT body FROM next_jobs WHERE id=?').get(rejected.intentId);
 const pr=payments.prepare('SELECT record FROM payment_intents WHERE id=?').get(rejected.intentId);
 if(!jr||!pr)throw new Error('Rejected V2 checkpoints are required.');
 const job=JSON.parse(String(jr.body)) as NextJob,payment=JSON.parse(String(pr.record));
 if(!job.resource||!payment.payload?.payload?.transaction)throw new Error('The real model draft and signed authorization must exist.');
 const decoded=decodeCardanoTransaction(payment.payload.payload.transaction);
 const expiry=decoded.ttlSlot===undefined?null:slotToPosixMs('cardano:preprod',decoded.ttlSlot);
 const decision=validateAcceptance(job.input,job.resource,job.acceptance);
 const post=async(path:string,body:unknown)=>{const response=await fetch('https://preprod.koios.rest/api/v1'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20_000)});if(!response.ok)throw new Error(`Koios HTTP${response.status}`);return response.json();};
 const [txRows,utxoRows]=await Promise.all([post('/tx_info',{_tx_hashes:[decoded.txHash]}),post('/address_utxos',{_addresses:[job.payment?.receipt?.payer??payment.mandate?.buyerAddress??decoded.outputs.find(o=>o.address!==payment.mandate.allowedSeller)?.address]})]);
 const unspent=new Set((utxoRows as {tx_hash:string;tx_index:number}[]).map(row=>`${row.tx_hash}#${row.tx_index}`));
 const allInputsUnspent=decoded.inputs.every(input=>unspent.has(input));
 const checks={actualModelCalled:job.resource.model?.called===true,actualUsefulEdits:(job.resource.model?.acceptedEdits??0)>0,acceptanceRejected:!decision.met&&decision.readyProducts<decision.minimumReadyProducts,
 zeroLocalSettlementCalls:payment.settlementCalls===0,noReceipt:payment.receipt===null,noPaidResult:!job.result&&!job.manifest,
 sameSignedHash:payment.transaction===decoded.txHash,noChainTransaction:Array.isArray(txRows)&&txRows.length===0,allInputsUnspent,
 signedAuthorizationExpired:expiry!==null&&expiry<Date.now()-30_000};
 const evidence={checkedAt:new Date().toISOString(),status:Object.values(checks).every(Boolean)?'PASS':'PENDING',intentId:job.id,inputHash:job.inputHash,acceptanceHash:job.acceptanceHash,orderHash:job.orderHash,
 decision,unpaidModel:{report:job.resource.model,summary:job.resource.summary,resultHash:resultHash(job.resource)},signedAuthorization:{transaction:decoded.txHash,expiresAt:expiry===null?null:new Date(expiry).toISOString(),settlementCalls:payment.settlementCalls,receiptPresent:!!payment.receipt,payloadPublished:false},
 chainObservation:{provider:'https://preprod.koios.rest/api/v1',transactionObserved:Array.isArray(txRows)&&txRows.length>0,allInputsUnspent,inputs:decoded.inputs},checks,
 trust:'Zero local settlement invocations prove this application did not request broadcast. Hosted facilitator verification is not settlement. Independent transaction absence, unspent inputs and expiry are reported by the checks above; mempool internals are not observed. This draft is unpaid and is never claimed as delivered paid work.'};
 const archivePath='docs/evidence/v2/no-settlement-verification.json';
 const prior=existsSync(archivePath)?JSON.parse(readFileSync(archivePath,'utf8')):null;
 const destination=prior?.status==='PASS'&&evidence.status!=='PASS'?'docs/evidence/v2/no-settlement-latest-observation.json':archivePath;
 writeFileSync(destination,JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({status:evidence.status,checks,expiresAt:evidence.signedAuthorization.expiresAt,evidence:destination,historicalProofPreserved:destination!==archivePath},null,2));
 if(evidence.status!=='PASS')process.exitCode=2;
}finally{jobs.close();payments.close();}
