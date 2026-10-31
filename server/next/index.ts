import {Router} from 'express';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {parseCatalog,reviewCatalog,repairCatalog,hashInput,sourceParts,toCsv} from '../catalog/index.ts';
import {parseAcceptancePolicy} from '../../shared/acceptance.ts';
import {acceptanceHash,orderHash,validateAcceptance} from '../acceptance.ts';
import {createPaymentService,PaymentPolicyError} from '../payment/index.ts';
import {validatePaidCatalogResult,type PaymentMandate} from '../payment/policy.ts';
import {NextJobStore,publicNextJob,type NextJob} from './store.ts';
import {createNextRunner} from './runner.ts';

const capsSchema=z.object({serviceCapLovelace:z.string().max(20),feeCapLovelace:z.string().max(20),totalCapLovelace:z.string().max(20),expiresAt:z.string().max(40),maxActions:z.literal(1)}).strict();
const sourceSchema=z.object({input:z.string().max(100000),format:z.enum(['json','csv']),acceptance:z.unknown()});
const jobSchema=sourceSchema.extend({acceptanceHash:z.string().regex(/^[a-f0-9]{64}$/),mandate:capsSchema}).strict();
const reviewSchema=sourceSchema.strict();
export function createNextApi(baseUrl:string,modelStatus:()=>Promise<{available:boolean;model:string}>){
 const store=new NextJobStore();
 function bind(body:unknown,paid=false){
  const request=paid?jobSchema.parse(body):reviewSchema.parse(body);
  const input=parseCatalog(request.input,request.format);
  const acceptance=parseAcceptancePolicy(request.acceptance,input.products.length);
  const inputHash=hashInput(input),aHash=acceptanceHash(acceptance),oHash=orderHash(inputHash,aHash);
  return {request,input,acceptance,inputHash,acceptanceHash:aHash,orderHash:oHash};
 }
 function assertBinding(job:NextJob,actualInputHash:string,mandate:PaymentMandate){
  if(hashInput(job.input)!==actualInputHash||acceptanceHash(job.acceptance)!==job.acceptanceHash||orderHash(actualInputHash,job.acceptanceHash)!==job.orderHash||mandate.acceptanceHash!==job.acceptanceHash||mandate.orderHash!==job.orderHash)throw new PaymentPolicyError('acceptance_binding','Acceptance, input or mandate differs from the immutable delegation.');
 }
 const payment=createPaymentService({dbPath:'data/v2-payment.sqlite',walletFile:'.local/v2/cardano-wallets.json',resourceBaseUrl:baseUrl,resourcePathPrefix:'/api/next/service/jobs',dedupeBy:'orderHash',
  onResource:async(id,inputHash)=>{
   const job=store.get(id);if(!job)throw new Error('Unknown V2 catalog.');assertBinding(job,inputHash,job.mandate);
   if(job.resource){validatePaidCatalogResult(job.resource,inputHash);return job.resource;}
   store.patch(id,{status:'processing'},{stage:'processing',message:'Verified signed authorization. Creating a source-bound result before any settlement request.'});
   const result=await repairCatalog(job.input,{allowedDisplayEditFields:job.acceptance.allowedDisplayEditFields});
   validatePaidCatalogResult(result,inputHash);
   store.patch(id,{resource:result},{stage:'validated',message:`Real model result validated: ${result.summary.ready} ready. Checking the buyer’s fixed acceptance next.`});
   return result;
  },
  beforeSettle:async({intentId,inputHash,result,mandate})=>{
   const job=store.get(intentId);if(!job)throw new Error('Unknown V2 catalog.');assertBinding(job,inputHash,mandate);
   validatePaidCatalogResult(result,inputHash);
   const decision=validateAcceptance(job.input,result as NonNullable<NextJob['resource']>,job.acceptance);
   store.patch(intentId,{decision},{stage:decision.code,message:decision.met?'Fixed buyer acceptance passed before settlement.':`Acceptance not met. ${decision.readyProducts} of ${decision.minimumReadyProducts} required ready products; settlement not requested.`});
   if(!decision.met)throw new PaymentPolicyError('acceptance_not_met',`Acceptance not met: ${decision.readyProducts} ready; ${decision.minimumReadyProducts} required. No settlement requested.`);
  }
 });
 const runner=createNextRunner(store,payment),router=Router();
 router.get('/status',async(_req,res)=>{const [p,model]=await Promise.all([payment.readiness(),modelStatus()]);res.json({payment:p,model});});
 router.get('/sample',(_req,res)=>res.json({input:readFileSync('samples/catalog.json','utf8'),format:'json'}));
 router.post('/review',(req,res)=>{
  const b=bind(req.body);res.json({result:reviewCatalog(b.input),inputHash:b.inputHash,acceptance:b.acceptance,acceptanceHash:b.acceptanceHash,orderHash:b.orderHash});
 });
 router.post('/jobs',async(req,res)=>{
  const b=bind(req.body,true);const body=jobSchema.parse(req.body);
  if(body.acceptanceHash!==b.acceptanceHash)return res.status(409).json({error:'acceptance_binding',message:'The acceptance hash differs from the selected conditions. Review before delegating.'});
  if(!b.input.products.some(row=>b.acceptance.allowedDisplayEditFields.some(field=>row[field].trim()&&sourceParts(row).some(part=>part.sourceField==='sourceText'&&!row[field].toLowerCase().includes(part.text.toLowerCase())))))return res.status(422).json({error:'No additional source specifications are available for paid composition in the allowed fields. Use the free source review or add source clauses.'});
  // Finish external reads before the synchronous check-and-record section. Concurrent
  // initial POSTs must observe the first immutable delegation, never replace it.
  const [ready,model]=await Promise.all([payment.readiness(),modelStatus()]);
  const existing=store.byOrder(b.orderHash);
  if(existing){
   const previous=existing.mandate;
   if(['serviceCapLovelace','feeCapLovelace','totalCapLovelace','maxActions'].some(key=>previous[key as keyof PaymentMandate]!==body.mandate[key as keyof typeof body.mandate]))return res.status(409).json({error:'mandate_immutable',message:'This intent already has fixed spending limits. Observe or reconcile it; its mandate cannot be replaced.'});
   assertBinding(existing,b.inputHash,previous);
   if(!['complete','acceptance_not_met','blocked','failed'].includes(existing.status)&&!runner.isActive(existing.id))void runner.run(existing.id);
   runner.sync(existing.id);return res.json({job:publicNextJob(store.get(existing.id)!),duplicate:true});
  }
  const id=`next_${b.orderHash.slice(0,32)}`;
  if(store.get(id))return res.status(409).json({error:'intent_collision',message:'This intent identifier already belongs to another order.'});
  const mandate:PaymentMandate={...body.mandate,apiFeeCapLovelace:'0',network:'cardano:preprod',asset:'lovelace',allowedSeller:ready.sellerAddress||'',endpoint:payment.endpoint(id),beneficiary:'Catalog owner: local V2 workspace',acceptanceHash:b.acceptanceHash,orderHash:b.orderHash};
  const now=new Date().toISOString();const job:NextJob={id,inputHash:b.inputHash,orderHash:b.orderHash,acceptanceHash:b.acceptanceHash,acceptance:b.acceptance,input:b.input,mandate,status:'quoted',createdAt:now,updatedAt:now,events:[{at:now,stage:'intent',message:'V2 source and buyer acceptance bound before delegation. One request; fixed spending limits.'}]};
  store.put(job);
  if(!ready.ready||!model.available){const reason=[...ready.blockers,...(!model.available?['The local catalog model is unavailable.']:[])].join(' ');store.patch(id,{status:'blocked',error:reason});return res.status(202).json({job:publicNextJob(store.get(id)!)});}
  try{payment.prepare({intentId:id,inputHash:b.inputHash,mandate});}
  catch(error){store.patch(id,{status:'blocked',error:error instanceof Error?error.message:'Delegation rejected.'});return res.status(202).json({job:publicNextJob(store.get(id)!)});}
  void runner.run(id);res.status(202).json({job:publicNextJob(store.get(id)!)});
 });
 router.get('/jobs/:id',(req,res)=>{
  if(!store.get(req.params.id))return res.status(404).json({error:'V2 batch not found.'});runner.sync(req.params.id);res.json({job:publicNextJob(store.get(req.params.id)!)});
 });
 router.post('/jobs/:id/reconcile',(req,res)=>{
  const job=store.get(req.params.id);if(!job)return res.status(404).json({error:'V2 batch not found.'});
  if(!['complete','acceptance_not_met'].includes(job.status))void runner.run(job.id);
  res.status(202).json({job:publicNextJob(store.get(job.id)!)});
 });
 router.get('/jobs/:id/download/:format',(req,res)=>{
  const job=store.get(req.params.id);if(!job?.result||job.status!=='complete'||!job.manifest)return res.status(409).json({error:'A confirmed, acceptance-bound paid result is required.'});
  const format=req.params.format;if(!['json','csv','report'].includes(format))return res.status(404).json({error:'Unknown export format.'});
  res.setHeader('Content-Disposition',`attachment; filename="listing-fixer-${job.id}.${format==='csv'?'csv':'json'}"`);
  if(format==='csv')return res.type('text/csv').send(toCsv(job.result,{readyOnly:true}));
  res.json(format==='report'?{manifest:job.manifest,payment:job.payment,result:job.result}:{manifest:job.manifest,...job.result,products:job.result.products.filter(row=>row.status==='ready')});
 });
 router.get('/service/jobs/:id',payment.sellerMiddleware,payment.sellerHandler);
 return {router,start:()=>{for(const job of store.unfinished())void runner.run(job.id);},store,payment,runner};
}
