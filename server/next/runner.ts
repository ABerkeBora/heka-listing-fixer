import type {createPaymentService} from '../payment/index.ts';
import {NextJobStore,type NextJob} from './store.ts';
import {createDeliveryManifest} from '../acceptance.ts';
import {validatePaidCatalogResult} from '../payment/policy.ts';
import {safeError} from '../local-policy.ts';

export function createNextRunner(store:NextJobStore,payment:ReturnType<typeof createPaymentService>){
 const active=new Set<string>();
 function sync(id:string,p=payment.publicIntent(id)){
  if(!p)return store.get(id)!;
  const job=store.get(id)!;
  const patch:Partial<NextJob>={payment:p};
  if(p.status==='confirmed'){
   const result=job.resource??p.result as NextJob['resource'];
   if(!result||!p.transaction||!p.receipt?.success)throw new Error('Confirmed delivery is missing its bound result or receipt.');
   validatePaidCatalogResult(result,job.inputHash);
   const manifest=createDeliveryManifest({intentId:id,input:job.input,policy:job.acceptance,result,transaction:p.transaction,receipt:p.receipt});
   if(manifest.acceptanceHash!==job.acceptanceHash||manifest.orderHash!==job.orderHash)throw new Error('The delivered acceptance binding differs from the delegation.');
   patch.status='complete';patch.result=result;patch.manifest=manifest;patch.error=undefined;
  }else if(p.status==='acceptance_not_met'){
   patch.status='acceptance_not_met';patch.error=p.reason||'Acceptance not met. No settlement requested.';
  }else if(['blocked','rejected'].includes(p.status)){
   patch.status='blocked';patch.error=p.reason||'The bounded policy rejected this request.';
  }else if(p.status==='processing_failed'){
   patch.status='failed';patch.error=p.reason||'Catalog processing failed before settlement.';
  }else if(p.status==='receipt_unresolved'){
   patch.status='receipt_unresolved';patch.error=p.reason||'Reconcile the same signed transaction.';
  }else if(['signed','payment_pending'].includes(p.status)){
   patch.status=job.status==='processing'?'processing':'payment_pending';patch.error=undefined;
  }
  return store.patch(id,patch);
 }
 async function run(id:string){
  if(active.has(id))return;const original=store.get(id);if(!original||['complete','acceptance_not_met'].includes(original.status))return;
  active.add(id);
  try{
   const existing=payment.publicIntent(id);
   if(!existing){payment.prepare({intentId:id,inputHash:original.inputHash,mandate:original.mandate});}
   store.patch(id,{status:'payment_pending',error:undefined},{stage:existing?.hasSignedPayload?'reconciling':'payment',message:existing?.hasSignedPayload?'Reconciling the same signed transaction and fixed acceptance.':'Executing the one delegated request with fixed acceptance conditions.'});
   const p=payment.publicIntent(id);
   const next=p?.hasSignedPayload?await payment.reconcile(id):await payment.execute(id);
   const job=sync(id,next);
   if(job.status==='complete')store.patch(id,{}, {stage:'delivered',message:'Acceptance passed. Confirmed receipt, exact input and result hashes bound in the delivery manifest.'});
  }catch(error){
   const p=payment.publicIntent(id);
   try{sync(id,p);}catch{/* Keep the error visible without claiming a verified delivery. */}
   const current=store.get(id)!;
   if(!['complete','acceptance_not_met'].includes(current.status))store.patch(id,{status:p?.hasSignedPayload?'receipt_unresolved':'failed',error:safeError(error)},{stage:'attention',message:safeError(error)});
  }finally{active.delete(id);}
 }
 return {run,sync,isActive:(id:string)=>active.has(id)};
}
