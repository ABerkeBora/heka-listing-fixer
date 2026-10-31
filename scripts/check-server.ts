import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3107';
const evidence:{at:string;checks:{name:string;status:string;detail:unknown}[]}={at:new Date().toISOString(),checks:[]};
function pass(name:string,detail:unknown){evidence.checks.push({name,status:'PASS',detail});}
async function post(path:string,body:unknown,headers:Record<string,string>={}){return fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});}
const status=await(await fetch(base+'/api/status')).json();assert.equal(status.payment.network,'cardano:preprod');pass('Real service status',{ready:status.payment.ready,provider:status.payment.provider,buyerBalanceLovelace:status.payment.buyerBalanceLovelace,model:status.model});
const input=readFileSync('samples/catalog.json','utf8');let response=await post('/api/review',{input,format:'json'});assert.equal(response.status,200);const {result}=await response.json();assert.equal(result.summary.total,10);assert.equal(result.summary.total,result.summary.ready+result.summary.needsSource+result.summary.review);pass('10-row source review reconciles',{summary:result.summary,mode:result.mode,model:result.model});
const withoutSpecs=JSON.parse(input);for(const row of withoutSpecs.products)row.sourceText='';response=await post('/api/jobs',{input:JSON.stringify(withoutSpecs),format:'json',mandate:{serviceCapLovelace:'2000000',feeCapLovelace:'500000',totalCapLovelace:'2500000',expiresAt:new Date(Date.now()+600000).toISOString(),maxActions:1}});assert.equal(response.status,422);pass('No charge for free lint without useful source composition',{http:response.status,error:await response.json()});
let bad=JSON.parse(input);bad.products[1].sku=bad.products[0].sku;response=await post('/api/jobs',{input:JSON.stringify(bad),format:'json',mandate:{}});assert.equal(response.status,422);pass('Invalid duplicate SKU rejected before payment',{http:response.status,error:await response.json()});
response=await post('/api/review',{input,format:'json'},{origin:'https://untrusted.example'});assert.equal(response.status,403);pass('Cross-site request blocked',{http:response.status});
response=await fetch(base+'/api/jobs/nonexistent/download/json');assert.equal(response.status,409);pass('No unpaid result via paid export',{http:response.status});
if(!status.payment.ready||process.argv.includes('--allow-test-payment')) {
const mandate={serviceCapLovelace:'2000000',feeCapLovelace:'500000',totalCapLovelace:'2500000',expiresAt:new Date(Date.now()+15*60_000).toISOString(),maxActions:1};
response=await post('/api/jobs',{input,format:'json',mandate});const first=(await response.json()).job;assert.ok(first.id);
response=await post('/api/jobs',{input,format:'json',mandate});const second=(await response.json()).job;assert.equal(first.id,second.id);assert.equal(first.inputHash,second.inputHash);
pass('Duplicate source input retains same logical intent',{intentId:first.id,inputHash:first.inputHash,status:second.status,transaction:second.payment?.transaction??null});
if(!status.payment.ready){assert.equal(second.status,'blocked');assert.equal(second.payment?.transaction??null,null);pass('Unfunded wallet fails closed',{status:second.status,error:second.error,paidResult:!!second.result,transaction:null});}
}
writeFileSync('docs/evidence/server-checks.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
