import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NextJobStore,publicNextJob,type NextJob} from '../server/next/store.ts';
import {acceptanceHash,orderHash} from '../server/acceptance.ts';
import {parseCatalog,hashInput} from '../server/catalog/index.ts';

test('V2 order namespace distinguishes acceptance conditions and keeps unpaid cached results private',()=>{
 const store=new NextJobStore(':memory:');
 try{
  const input=parseCatalog(readFileSync('samples/catalog.json','utf8'),'json'),inputHash=hashInput(input);
  const make=(minimum:number):NextJob=>{
   const acceptance={schema:'listing-acceptance-v1' as const,minimumReadyProducts:minimum,allowedDisplayEditFields:['title','description'] as ('title'|'description')[]};
   const aHash=acceptanceHash(acceptance),oHash=orderHash(inputHash,aHash),now=new Date().toISOString();
   return {id:`next_${oHash.slice(0,32)}`,inputHash,acceptanceHash:aHash,orderHash:oHash,acceptance,input,mandate:{} as NextJob['mandate'],status:'quoted',events:[],createdAt:now,updatedAt:now};
  };
  const first=make(5),second=make(6);store.put(first);store.put(second);
  assert.notEqual(first.id,second.id);assert.equal(store.byOrder(first.orderHash)?.id,first.id);assert.equal(store.byOrder(second.orderHash)?.id,second.id);
  assert.equal(store.get('batch_'+inputHash.slice(0,24)),undefined);
  store.patch(second.id,{status:'acceptance_not_met'});assert.deepEqual(store.unfinished().map(j=>j.id),[first.id]);
  const safe=publicNextJob({...second,resource:{privateModelDraft:true} as never});
  assert.equal('resource' in safe,false);assert.equal('input' in safe,false);assert.equal(safe.acceptanceHash,second.acceptanceHash);assert.equal(safe.result,undefined);
 }finally{store.close();}
});
