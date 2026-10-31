import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JobStore,publicJob,type Job} from '../server/store.ts';

test('durable jobs keep one logical input and hide unpaid cached result',()=>{
 const folder=mkdtempSync(join(tmpdir(),'listing-fixer-'));const path=join(folder,'jobs.sqlite');
 let store=new JobStore(path);const now=new Date().toISOString();
 const j={id:'job-one',inputHash:'input-one',status:'payment_pending',createdAt:now,updatedAt:now,input:{schema:'listing-v1',language:'en',products:[]},resource:{secret:'not delivered'},mandate:{maxActions:1},events:[]} as unknown as Job;
 store.put(j);assert.equal((publicJob(j) as Record<string,unknown>).resource,undefined);assert.equal((publicJob(j) as Record<string,unknown>).input,undefined);store.close();
 store=new JobStore(path);assert.equal(store.byInput('input-one')?.id,'job-one');assert.equal(store.unfinished().length,1);
 assert.throws(()=>store.put({...j,id:'job-two'}),/UNIQUE/);
 store.patch(j.id,{status:'complete'},{stage:'delivered',message:'Confirmed receipt'});
 assert.equal(store.unfinished().length,0);assert.equal(store.get(j.id)?.events.length,1);
 store.close();rmSync(folder,{recursive:true});
});
