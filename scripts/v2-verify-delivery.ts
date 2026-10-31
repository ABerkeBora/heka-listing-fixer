import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {canonicalAcceptance,canonicalInput,canonicalManifest,canonicalOrder,canonicalResult,parseAcceptancePolicy} from '../shared/acceptance.ts';
import {createDeliveryManifest,validateAcceptance} from '../server/acceptance.ts';
import {parseCatalog} from '../server/catalog/index.ts';
import type {NextJob} from '../server/next/store.ts';
import type {CatalogResult} from '../shared/catalog.ts';

/** GET/export-only audit; never delegates, signs, submits, reconciles or calls a model. */
const path='docs/evidence/v2/payment-live.json',resultPath='docs/evidence/v2/payment-live-result.json';
if(!existsSync(path)||!existsSync(resultPath)){console.error('A completed V2 paid request and result file are required. No success claimed.');process.exit(2);}
const paid=JSON.parse(readFileSync(path,'utf8'));
if(paid.status!=='PASS'){console.error('V2 payment evidence is not PASS. No delivery success claimed.');process.exit(2);}
const savedResult=JSON.parse(readFileSync(resultPath,'utf8')) as CatalogResult;
const v1=JSON.parse(readFileSync('docs/evidence/payment-live.json','utf8'));
const digest=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const checks:{name:string;pass:boolean;detail?:string}[]=[];
const check=(name:string,pass:boolean,detail?:string)=>checks.push({name,pass,...(detail?{detail}:{})});
async function get(path:string){const response=await fetch('http://127.0.0.1:3107'+path,{redirect:'error',signal:AbortSignal.timeout(15_000)});if(!response.ok)throw new Error(`GET ${path} HTTP${response.status}`);return response;}
let observed:Record<string,unknown>={};
try{
 const {job}=await(await get(`/api/next/jobs/${encodeURIComponent(paid.intentId)}`)).json() as {job:NextJob};
 if(!job.result||!job.manifest||!job.payment?.receipt)throw new Error('Live V2 job lacks a result, manifest or receipt.');
 const input=parseCatalog((job as NextJob&{sourceInput:string}).sourceInput,'json');
 const shipped=parseCatalog(readFileSync('samples/catalog.json','utf8'),'json');
 const policy=parseAcceptancePolicy(job.acceptance,input.products.length);
 const iHash=digest(canonicalInput(input)),aHash=digest(canonicalAcceptance(policy)),oHash=digest(canonicalOrder(iHash,aHash)),rHash=digest(canonicalResult(job.result));
 const decision=validateAcceptance(input,job.result,policy);
 const expectedManifest=createDeliveryManifest({intentId:job.id,input,policy,result:job.result,transaction:job.payment.transaction!,receipt:job.payment.receipt});
 check('live V2 job is complete with a distinct acceptance-bound intent',job.status==='complete'&&job.id===paid.intentId&&job.id===`next_${oHash.slice(0,32)}`&&job.id!==v1.intentId);
 check('approved source bytes and input hash preserved',canonicalInput(input)===canonicalInput(shipped)&&job.inputHash===iHash&&paid.inputHash===iHash&&job.result.inputHash===iHash);
 check('canonical buyer acceptance and order hashes agree everywhere',job.acceptanceHash===aHash&&paid.acceptanceHash===aHash&&job.orderHash===oHash&&paid.orderHash===oHash&&canonicalAcceptance(paid.acceptance)===canonicalAcceptance(policy));
 check('initial mandate retains the same acceptance and order hashes',job.mandate.acceptanceHash===aHash&&job.mandate.orderHash===oHash&&job.payment.mandate.acceptanceHash===aHash&&job.payment.mandate.orderHash===oHash&&paid.mandate.acceptanceHash===aHash&&paid.mandate.orderHash===oHash);
 const quote=job.payment.quote;
 const info=(quote?.extensions?.['listing-acceptance'] as {info?:Record<string,unknown>}|undefined)?.info;
 check('real x402 quote carries the same source, acceptance and order commitment',!!info&&info.inputHash===iHash&&info.acceptanceHash===aHash&&info.orderHash===oHash&&quote?.resource.url===job.mandate.endpoint&&quote?.accepts[0]?.payTo===job.mandate.allowedSeller);
 check('independent deterministic acceptance passes with actual ready rows',decision.met&&decision.code==='acceptance_met'&&decision.readyProducts>=policy.minimumReadyProducts&&decision.violations.length===0);
 check('recorded acceptance decision agrees with recomputation',JSON.stringify(job.decision)===JSON.stringify(decision)&&JSON.stringify(job.manifest.decision)===JSON.stringify(decision));
 check('paid result, saved result and manifest result hashes match',rHash===paid.resultHash&&rHash===digest(canonicalResult(savedResult))&&job.manifest.resultHash===rHash);
 check('full delivery manifest recomputes from the fixed order and confirmed receipt',canonicalManifest(job.manifest)===canonicalManifest(expectedManifest)&&canonicalManifest(paid.manifest)===canonicalManifest(expectedManifest));
 const receipt=job.payment.receipt;
 check('new receipt is confirmed preprod and does not reuse the V1 transaction',job.payment.status==='confirmed'&&receipt.success===true&&receipt.network==='cardano:preprod'&&receipt.extra?.status==='confirmed'&&Number.isInteger(receipt.extra?.confirmations)&&Number(receipt.extra?.confirmations)>=1&&receipt.transaction===job.payment.transaction&&receipt.transaction===paid.transaction&&receipt.transaction!==v1.transaction&&job.manifest.transaction===receipt.transaction);
 check('one local settlement invocation and one persisted signature',job.payment.settlementCalls===1&&paid.settlementCalls===1&&job.payment.events.filter(event=>event.decision==='signed_payment_persisted').length===1);
 const ready=job.result.products.filter(row=>row.status==='ready');
 const prefix=`/api/next/jobs/${encodeURIComponent(job.id)}/download/`;
 const json=await(await get(prefix+'json')).json() as CatalogResult&{manifest:NextJob['manifest']};
 check('actual ready-only JSON export contains no source-gap rows',JSON.stringify(json.products)===JSON.stringify(ready)&&json.inputHash===iHash&&!!json.manifest&&canonicalManifest(json.manifest)===canonicalManifest(expectedManifest));
 const report=await(await get(prefix+'report')).json() as {manifest:NonNullable<NextJob['manifest']>;result:CatalogResult;payment:NonNullable<NextJob['payment']>};
 check('actual full report binds all source rows, decision and payment',digest(canonicalResult(report.result))===rHash&&canonicalManifest(report.manifest)===canonicalManifest(expectedManifest)&&report.result.products.length===input.products.length&&report.payment.transaction===receipt.transaction);
 const csv=await(await get(prefix+'csv')).text();
 const lines=csv.trimEnd().split(/\r?\n/);
 // Supplied scenario contains no embedded newlines after source normalization; compare identities as quoted first cells.
 check('actual ready-only CSV export includes exactly the accepted ready identities',lines.length===ready.length+1&&ready.every((row,index)=>lines[index+1].startsWith(`"${row.sku.replace(/"/g,'""')}",`))&&job.result.products.filter(row=>row.status!=='ready').every(row=>!lines.slice(1).some(line=>line.startsWith(`"${row.sku.replace(/"/g,'""')}",`))));
 const {job:original}=await(await get(`/api/jobs/${encodeURIComponent(v1.intentId)}`)).json();
 check('original V1 paid receipt and result remain intact',original.status==='complete'&&original.payment?.transaction===v1.transaction&&digest(canonicalResult(original.result))===v1.resultHash);
 observed={intentId:job.id,inputHash:iHash,acceptanceHash:aHash,orderHash:oHash,resultHash:rHash,transaction:receipt.transaction,policy,decision,summary:job.result.summary,readyExportCount:ready.length,excludedSkus:job.result.products.filter(row=>row.status!=='ready').map(row=>row.sku),settlementCalls:job.payment.settlementCalls,originalV1Transaction:v1.transaction};
}catch(error){check('live delivery and exports are available for verification',false,error instanceof Error?error.message:'Delivery verification failed.');}
const evidence={checkedAt:new Date().toISOString(),status:checks.every(c=>c.pass)?'PASS':'FAIL',audit:'Read-only live V2 API/catalog/export verification. No model, signature, payment, job creation or reconciliation call performed.',...observed,checks,checksPassed:checks.filter(c=>c.pass).length,checksTotal:checks.length,
 boundary:'Local SDK settlement calls are counted; hosted facilitator internal retry/broadcast counts are not independently observed by this audit. Chain/output proof is recorded separately.'};
writeFileSync('docs/evidence/v2/delivery-verification.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,checksPassed:evidence.checksPassed,checksTotal:evidence.checksTotal,...observed,evidence:'docs/evidence/v2/delivery-verification.json'},null,2));
if(evidence.status!=='PASS')process.exitCode=1;
