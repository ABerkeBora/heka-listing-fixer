import test from 'node:test';
import assert from 'node:assert/strict';
import {pollExistingJob,type ObservableJob} from '../scripts/lib/poll-existing-job.ts';
const job=(status:string,signed=true):ObservableJob=>({id:'batch_fixed',status,payment:{hasSignedPayload:signed,transaction:signed?'unit-fixture-hash':null}});
function clock(){let time=0;return{now:()=>time,delay:async(ms:number)=>{time+=ms;}};}
test('CLI survives a dropped polling connection and observes only the existing signed intent',async()=>{
 const time=clock();let reads=0;let reconciles=0;const ids:string[]=[];
 const result=await pollExistingJob(job('processing'),{...time,deadlineMs:10_000,intervalMs:1,read:async id=>{ids.push(id);if(++reads===1)throw new Error('ECONNREFUSED');return job(reads===2?'payment_pending':'complete');},reconcile:async()=>{reconciles++;throw new Error('Not needed');}});
 assert.equal(result.job.status,'complete');assert.equal(result.readFailures,1);assert.equal(reconciles,0);assert.deepEqual(ids,['batch_fixed','batch_fixed','batch_fixed']);
});
test('unresolved receipt recovery is bounded and never reconciles an unsigned attempt',async()=>{
 const time=clock();let calls=0;
 const result=await pollExistingJob(job('receipt_unresolved'),{...time,deadlineMs:100,intervalMs:1,maxReconciliations:2,reconcileGapMs:0,read:async()=>job('receipt_unresolved'),reconcile:async id=>{assert.equal(id,'batch_fixed');calls++;return job('receipt_unresolved');}});
 assert.equal(calls,2);assert.equal(result.reconciliations,2);assert.equal(result.job.status,'receipt_unresolved');
 const unsigned=await pollExistingJob(job('receipt_unresolved',false),{...clock(),read:async()=>{throw new Error('Must not read');},reconcile:async()=>{throw new Error('Must not reconcile unsigned attempt');}});assert.equal(unsigned.reconciliations,0);
});
test('mismatched intent response fails closed and deadline prevents further requests',async()=>{
 await assert.rejects(pollExistingJob(job('processing'),{...clock(),intervalMs:1,deadlineMs:10,read:async()=>({...job('complete'),id:'wrong_intent'}),reconcile:async()=>job('complete')}),/another payment intent/);
 let calls=0;await pollExistingJob(job('processing'),{...clock(),intervalMs:10,deadlineMs:5,read:async()=>{calls++;return job('complete');},reconcile:async()=>job('complete')});assert.equal(calls,0);
});
