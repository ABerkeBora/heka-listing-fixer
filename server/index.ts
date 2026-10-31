import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import { readFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import { CatalogError,parseCatalog,reviewCatalog,repairCatalog,hashInput,toCsv,sourceParts } from './catalog/index.ts';
import { JobStore,publicJob,type Job } from './store.ts';
import { localOnly,safeError } from './local-policy.ts';
import { createJobRunner } from './jobs.ts';
import { createPaymentService } from './payment/index.ts';
import { validatePaidCatalogResult,type PaymentMandate } from './payment/policy.ts';

const port=Number(process.env.PORT||3107);
if(port!==3107)throw new Error('Listing Fixer is isolated on port 3107.');
const baseUrl=`http://127.0.0.1:${port}`;
const store=new JobStore('data/jobs.sqlite');
const app=express();app.disable('x-powered-by');
app.use(localOnly(port));
app.use(express.json({limit:'128kb'}));
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');next();});
app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});

const payment=createPaymentService({dbPath:'data/payment.sqlite',resourceBaseUrl:baseUrl,
 onResource:async(intentId:string,inputHash:string)=>{
  const job=store.get(intentId);if(!job||job.inputHash!==inputHash)throw new Error('The paid request does not match its catalog.');
  if(job.resource){validatePaidCatalogResult(job.resource,inputHash);return job.resource;}
  store.patch(job.id,{status:'processing'},{stage:'processing',message:'Verified payment authorization. Creating a source-bound catalog draft; settlement is still pending.'});
  const result=await repairCatalog(job.input);
  validatePaidCatalogResult(result,inputHash);
  store.patch(job.id,{resource:result},{stage:'validated',message:`Draft checked: ${result.summary.ready} ready, ${result.summary.needsSource} need source, ${result.summary.review} require review.`});
  return result;
 }
});

const inputRequest=z.object({input:z.string().max(100000),format:z.enum(['json','csv'])});
const mandateRequest=z.object({serviceCapLovelace:z.string().max(20),feeCapLovelace:z.string().max(20),totalCapLovelace:z.string().max(20),expiresAt:z.string().max(40),maxActions:z.literal(1)}).strict();
function parseRequest(body:unknown){const value=inputRequest.parse(body);return {value,input:parseCatalog(value.input,value.format)};}
async function modelStatus(){try{const response=await fetch(`${process.env.OLLAMA_URL||'http://127.0.0.1:11434'}/api/tags`,{signal:AbortSignal.timeout(2500)});const body=await response.json() as {models?:{name:string}[]};const model=process.env.OLLAMA_MODEL||'qwen3:4b';return {available:response.ok&&!!body.models?.some(m=>m.name===model),model};}catch{return {available:false,model:process.env.OLLAMA_MODEL||'qwen3:4b'};}}
app.get('/api/status',async(_req,res)=>{const [p,model]=await Promise.all([payment.readiness(),modelStatus()]);res.json({payment:p,model});});
app.get('/api/sample',(_req,res)=>res.json({input:readFileSync(resolve('samples/catalog.json'),'utf8'),format:'json'}));
app.post('/api/review',(req,res)=>{const {input}=parseRequest(req.body);res.json({result:reviewCatalog(input)});});

const runner=createJobRunner(store,payment);
app.post('/api/jobs',async(req,res)=>{
 const {input}=parseRequest(req.body);const caps=mandateRequest.parse(req.body.mandate);
 if(!input.products.some(row=>row.description.trim()&&sourceParts(row).some(part=>part.sourceField==='sourceText'&&!row.description.toLowerCase().includes(part.text.toLowerCase()))))return res.status(422).json({error:'No additional source specifications are available for paid composition. Use the free source review, or add supplied Material, Dimensions, Capacity, Colour or Pages clauses.'});
 const inputHash=hashInput(input);let job=store.byInput(inputHash);
 if(job&&job.status!=='blocked'&&job.status!=='failed'){
  // Same input is one paid intent. A retry only observes or reconciles that intent.
  if(job.status!=='complete'&&!runner.isActive(job.id))void runner.run(job.id);
  return res.status(200).json({job:publicJob(store.get(job.id)!),duplicate:true});
 }
 const ready=await payment.readiness();const model=await modelStatus();const id=job?.id||`batch_${inputHash.slice(0,24)}`;
 const now=new Date().toISOString();
 const mandate:PaymentMandate={...caps,apiFeeCapLovelace:'0',network:'cardano:preprod',asset:'lovelace',allowedSeller:ready.sellerAddress||'',endpoint:`${baseUrl}/api/service/jobs/${id}`,beneficiary:'Catalog owner: local workspace'};
 if(!job)job={id,inputHash,status:'quoted',input,mandate:mandate as unknown as Record<string,unknown>,createdAt:now,updatedAt:now,events:[{at:now,stage:'intent',message:'Catalog validated before any payment. One logical batch intent recorded.'}]};
 else job={...job,mandate:mandate as unknown as Record<string,unknown>,error:undefined};
 store.put(job);
 const existing=payment.publicIntent(id);
 if(existing){
  if(existing.hasSignedPayload){void runner.run(id);}
  else if(ready.ready&&model.available){payment.prepare({intentId:id,inputHash,mandate});void runner.run(id);}
  else{job=store.patch(id,{status:'blocked',error:ready.blockers.join(' ')||'The local catalog model is unavailable.'});}
  return res.status(202).json({job:publicJob(store.get(id)!)});
 }
 if(!ready.ready||!model.available){
  const reason=[...ready.blockers,...(!model.available?['The local catalog model is unavailable.']:[])].join(' ');
  job=store.patch(id,{status:'blocked',error:reason},{stage:'blocked',message:reason});
  return res.status(202).json({job:publicJob(job)});
 }
 try{payment.prepare({intentId:id,inputHash,mandate});}
 catch(error){job=store.patch(id,{status:'blocked',error:safeError(error)},{stage:'rejected',message:safeError(error)});return res.status(202).json({job:publicJob(job)});}
 store.patch(id,{status:'quoted'},{stage:'delegated',message:'One fixed seller, one batch and separate service/network fee caps authorized. Limits are enforced in this local executor.'});
 void runner.run(id);res.status(202).json({job:publicJob(store.get(id)!)});
});
app.get('/api/jobs/:id',(req,res)=>{const job=store.get(req.params.id);if(!job)return res.status(404).json({error:'Batch not found.'});const p=payment.publicIntent(job.id);if(p)runner.sync(job.id,p);res.json({job:publicJob(store.get(job.id)!)});});
app.post('/api/jobs/:id/reconcile',(req,res)=>{const job=store.get(req.params.id);if(!job)return res.status(404).json({error:'Batch not found.'});if(job.status!=='complete')void runner.run(job.id);res.status(202).json({job:publicJob(store.get(job.id)!)});});
app.get('/api/jobs/:id/download/:format',(req,res)=>{
 const job=store.get(req.params.id);if(!job?.result||job.status!=='complete')return res.status(409).json({error:'A confirmed paid catalog is required for this download.'});
 const format=req.params.format;
 if(!['json','csv','report'].includes(format))return res.status(404).json({error:'Unknown export format.'});
 const filename=`listing-fixer-${job.id}.${format==='csv'?'csv':'json'}`;
 res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);
 if(format==='csv')return res.type('text/csv').send(toCsv(job.result,{readyOnly:true}));
 return res.json(format==='report'?{intentId:job.id,inputHash:job.inputHash,payment:job.payment,result:job.result}:{...job.result,products:job.result.products.filter(row=>row.status==='ready')});
});
app.get('/api/service/jobs/:id',payment.sellerMiddleware,payment.sellerHandler);
app.use('/api',(_req,res)=>res.status(404).json({error:'Unknown API route.'}));
const onError:ErrorRequestHandler=(error,_req,res,_next)=>{
 if(error instanceof z.ZodError)return void res.status(422).json({error:'Check the input and delegation fields.',issues:error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
 if(error instanceof CatalogError)return void res.status(422).json({error:error.message,issues:error.issues});
 if(error?.type==='entity.too.large')return void res.status(413).json({error:'Catalog request is too large. Maximum 100 KB source text.'});
 if(error instanceof SyntaxError)return void res.status(400).json({error:'Request body is not valid JSON.'});
 console.error('Request failed:',error instanceof Error?error.name:'unknown');res.status(500).json({error:'The request could not be completed. Check the local service and retry the same batch.'});
};
app.use(onError);
if(existsSync(resolve('dist/client/index.html'))){app.use(express.static(resolve('dist/client')));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/client/index.html')));}
else{const vite=await createViteServer({server:{middlewareMode:true,host:'127.0.0.1',hmr:false},appType:'spa'});app.use(vite.middlewares);}
app.listen(port,'127.0.0.1',()=>{console.log(`Listing Fixer: ${baseUrl}`);for(const job of store.unfinished())void runner.run(job.id);});
