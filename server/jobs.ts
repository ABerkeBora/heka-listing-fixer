import { JobStore,type Job } from './store.ts';
import type { PaymentMandate } from './payment/policy.ts';
import { safeError } from './local-policy.ts';
export interface PaymentSnapshot { status:string;reason?:string|null;result?:unknown;hasSignedPayload:boolean;transaction?:string|null; }
export interface JobPaymentPort {
 readiness():Promise<{ready:boolean;blockers:string[]}>;
 prepare(input:{intentId:string;inputHash:string;mandate:PaymentMandate}):PaymentSnapshot;
 execute(id:string):Promise<PaymentSnapshot>;
 reconcile(id:string):Promise<PaymentSnapshot>;
 publicIntent(id:string):PaymentSnapshot|null;
}
/** Orchestration uses the same durable intent after restarts; signed bytes never get replaced. */
export function createJobRunner(store:JobStore,payment:JobPaymentPort){
 const active=new Set<string>();
 function sync(id:string,p:PaymentSnapshot|null){
  if(!p)return store.get(id)!;
  const patch:Partial<Job>={payment:p};const status=p.status;
  if(status==='confirmed'){
   const cached=store.get(id)?.resource || p.result as Job['resource'];
   if(cached){patch.status='complete';patch.result=cached;patch.error=undefined;}
   else{patch.status='receipt_unresolved';patch.error='Payment receipt exists, but the catalog result needs recovery. Reconcile this intent.';}
  }else if(['blocked','rejected'].includes(status)){patch.status='blocked';patch.error=p.reason||'The bounded payment policy rejected this request.';}
  else if(['failed','processing_failed'].includes(status)){patch.status='failed';patch.error=p.reason||'The request failed before confirmed delivery.';}
  else if(status==='receipt_unresolved'){patch.status='receipt_unresolved';patch.error=p.reason||undefined;}
  else if(['signed','payment_pending','submitted','settling','pending','settlement_pending'].includes(status)){patch.status=store.get(id)?.status==='processing'?'processing':'payment_pending';patch.error=undefined;}
  return store.patch(id,patch);
 }
 async function run(id:string){
  if(active.has(id))return;active.add(id);
  try{
   const current=payment.publicIntent(id);
   store.patch(id,{status:'payment_pending',error:undefined},{stage:current?.hasSignedPayload?'reconciling':'payment',message:current?.hasSignedPayload?'Checking the persisted signed payment; no replacement will be signed.':'Resuming this bounded delegation. The buyer will validate the quote and exact fee before its first signature.'});
   if(!current){
    const stored=store.get(id)!;const ready=await payment.readiness();
    if(!ready.ready){store.patch(id,{status:'blocked',error:ready.blockers.join(' ')});return;}
    payment.prepare({intentId:id,inputHash:stored.inputHash,mandate:stored.mandate as unknown as PaymentMandate});
   }
   const intent=payment.publicIntent(id);
   const result=intent?.hasSignedPayload?await payment.reconcile(id):await payment.execute(id);
   const job=sync(id,result);
   if(job.status==='complete')store.patch(id,{}, {stage:'delivered',message:'Confirmed preprod payment and matching checked catalog delivered.'});
   else if(job.status==='payment_pending')store.patch(id,{status:'receipt_unresolved',error:'Payment outcome is unresolved. Check the existing transaction before continuing.'});
  }catch(error){
   const prior=payment.publicIntent(id);sync(id,prior);const job=store.get(id)!;
   store.patch(id,{status:job.status==='complete'?'complete':prior?.hasSignedPayload?'receipt_unresolved':'failed',error:safeError(error)},{stage:'attention',message:safeError(error)});
  }finally{active.delete(id);}
 }
 return {run,sync,isActive:(id:string)=>active.has(id)};
}
