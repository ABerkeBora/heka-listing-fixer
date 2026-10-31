import { readFileSync,writeFileSync } from 'node:fs';
import { parseCatalog,repairCatalog,reviewCatalog } from '../server/catalog/index.ts';
import type { RepairOptions } from '../server/catalog/index.ts';
const input=parseCatalog(readFileSync('samples/catalog.json','utf8'),'json');
const quick=process.argv.includes('--quick');if(quick)input.products=input.products.slice(0,2);
const before=reviewCatalog(input);let draft:Parameters<NonNullable<RepairOptions['onDraft']>>[0]|undefined;
const at=new Date().toISOString();
try{
 const result=await repairCatalog(input,{onDraft:value=>{draft=value;},timeoutMs:60_000});
 const pricesPreserved=result.products.every((p,i)=>p.priceMinor===before.products[i].priceMinor&&p.currency===before.products[i].currency);
 if(!pricesPreserved)throw new Error('Price preservation check failed.');
 const evidence={at,status:'PASS',scope:'Real local model call and deterministic source validation; unpaid integration evidence, not Cardano qualification.',inputRows:input.products.length,draft,result,pricesPreserved};
 writeFileSync(`docs/evidence/catalog-llm-${quick?'quick':'full'}.json`,JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({status:evidence.status,inputRows:input.products.length,model:result.model,summary:result.summary,pricesPreserved},null,2));
}catch(error){writeFileSync(`docs/evidence/catalog-llm-${quick?'quick':'full'}.json`,JSON.stringify({at,status:'FAIL',inputRows:input.products.length,error:error instanceof Error?error.message:'Unknown model error'},null,2)+'\n');throw error;}
