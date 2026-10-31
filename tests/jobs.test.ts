import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobRunner,type JobPaymentPort,type PaymentSnapshot} from '../server/jobs.ts';
import {JobStore,type Job} from '../server/store.ts';

function setup(snapshot:PaymentSnapshot|null){
 const dir=mkdtempSync(join(tmpdir(),'listing-job-'));const store=new JobStore(join(dir,'jobs.sqlite'));const now=new Date().toISOString();
 store.put({id:'batch_one',inputHash:'a'.repeat(64),input:{schema:'listing-v1',language:'en',products:[]},mandate:{},createdAt:now,updatedAt:now,status:'quoted',events:[]} as Job);
 let current=snapshot;const calls:string[]=[];
 const payment:JobPaymentPort={readiness:async()=>({ready:true,blockers:[]}),publicIntent:()=>current,prepare:()=>{calls.push('prepare');return current={status:'ready',hasSignedPayload:false};},execute:async()=>{calls.push('sign-first');return current={status:'blocked',hasSignedPayload:false,reason:'Unit test ends before actual signing.'};},reconcile:async()=>{calls.push('reuse-signed');return current={status:'receipt_unresolved',hasSignedPayload:true,reason:'Unit receipt pending.'};}};
 return {store,payment,calls,close:()=>{store.close();rmSync(dir,{recursive:true,force:true});}};
}
test('crash before first signature resumes the stored delegation instead of becoming permanently unresolved',async()=>{
 const h=setup({status:'quoted',hasSignedPayload:false});try{await createJobRunner(h.store,h.payment).run('batch_one');assert.deepEqual(h.calls,['sign-first']);assert.equal(h.store.get('batch_one')?.status,'blocked');assert.match(h.store.get('batch_one')!.events[0].message,/before its first signature/);}finally{h.close();}
});
test('crash after signed bytes persisted only reconciles and never creates a replacement payment',async()=>{
 const h=setup({status:'signed',hasSignedPayload:true,transaction:'test-unit-hash'});try{await createJobRunner(h.store,h.payment).run('batch_one');assert.deepEqual(h.calls,['reuse-signed']);assert.equal(h.store.get('batch_one')?.status,'receipt_unresolved');}finally{h.close();}
});
test('crash between job creation and intent preparation safely prepares once; concurrent requests share one runner',async()=>{
 const h=setup(null);let finish!:()=>void;const gate=new Promise<void>(r=>finish=r);h.payment.execute=async()=>{h.calls.push('sign-first');await gate;return {status:'blocked',hasSignedPayload:false,reason:'Unit execution boundary.'};};
 try{const runner=createJobRunner(h.store,h.payment);const first=runner.run('batch_one');await Promise.resolve();const second=runner.run('batch_one');finish();await Promise.all([first,second]);assert.deepEqual(h.calls,['prepare','sign-first']);}finally{h.close();}
});
test('a signed pending state does not prematurely terminate the browser processing poll',()=>{
 const h=setup(null);try{h.store.patch('batch_one',{status:'processing'});const runner=createJobRunner(h.store,h.payment);runner.sync('batch_one',{status:'payment_pending',hasSignedPayload:true});assert.equal(h.store.get('batch_one')?.status,'processing');assert.equal(h.store.get('batch_one')?.result,undefined);}finally{h.close();}
});
