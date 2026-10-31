export interface ObservableJob {id:string;status:string;payment?:{hasSignedPayload?:boolean;transaction?:string|null};}
export interface PollOptions<T extends ObservableJob> {
 read:(id:string)=>Promise<T>;
 reconcile:(id:string)=>Promise<T>;
 now?:()=>number;
 delay?:(milliseconds:number)=>Promise<void>;
 deadlineMs?:number;
 intervalMs?:number;
 maxReconciliations?:number;
 reconcileGapMs?:number;
 onTransition?:(job:T)=>void;
 onReadError?:(error:unknown)=>void;
}
/** Watches one existing intent. Recovery may reuse signed bytes; this function cannot create a job. */
export async function pollExistingJob<T extends ObservableJob>(initial:T,options:PollOptions<T>){
 const now=options.now??Date.now;
 const delay=options.delay??(ms=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
 const deadline=options.deadlineMs??now()+240_000;
 const interval=options.intervalMs??2000;
 const maximum=options.maxReconciliations??4;
 const gap=options.reconcileGapMs??15_000;
 if(!Number.isInteger(maximum)||maximum<0||maximum>4||interval<1||interval>10_000||gap<0)throw new Error('Invalid bounded recovery policy.');
 let job=initial;let reconciliations=0;let readFailures=0;let lastReconcile=-Infinity;
 const accept=(next:T)=>{if(next.id!==initial.id)throw new Error('Response belongs to another payment intent.');if(next.status!==job.status)options.onTransition?.(next);job=next;};
 while(!['complete','blocked','failed'].includes(job.status)&&now()<deadline){
  if(job.status==='receipt_unresolved'){
   if(!job.payment?.hasSignedPayload||!job.payment.transaction||reconciliations>=maximum)break;
   if(now()-lastReconcile>=gap){
    lastReconcile=now();reconciliations++;
    let response:T|undefined;
    try{response=await options.reconcile(initial.id);}catch(error){readFailures++;options.onReadError?.(error);}
    if(response)accept(response);
    if(['complete','blocked','failed'].includes(job.status))break;
   }
  }
  await delay(interval);if(now()>=deadline)break;
  let response:T|undefined;
  try{response=await options.read(initial.id);}catch(error){readFailures++;options.onReadError?.(error);}
  if(response)accept(response);
 }
 return {job,reconciliations,readFailures};
}
