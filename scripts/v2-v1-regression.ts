import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:3107';
const original=JSON.parse(readFileSync('docs/evidence/payment-live.json','utf8'));
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const response=await fetch(`${base}/api/jobs/${original.intentId}`);if(!response.ok)throw new Error('V1 job unavailable.');
const {job}=await response.json();
const state={id:job.id,status:job.status,inputHash:job.inputHash,resultHash:sha(job.result),receiptHash:sha(job.payment.receipt),transaction:job.payment.transaction,signatures:job.payment.events.filter((e:{decision:string})=>e.decision==='signed_payment_persisted').length};
const path='docs/evidence/v2/v1-baseline-state.json';
if(process.argv.includes('--capture')){
 if(state.status!=='complete'||state.transaction!==original.transaction||state.resultHash!==original.resultHash||state.signatures!==1)throw new Error('V1 does not match its confirmed baseline.');
 writeFileSync(path,JSON.stringify({checkedAt:new Date().toISOString(),state},null,2)+'\n');console.log('Confirmed V1 state captured before V2 restart.');
}else{
 const before=JSON.parse(readFileSync(path,'utf8')).state;
 const [shell,nextShell]=await Promise.all([fetch(base+'/'),fetch(base+'/next')]);
 const input=readFileSync('samples/catalog.json','utf8');
 const reviewResponse=await fetch(base+'/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,format:'json'})});
 const review=await reviewResponse.json();
 const checks={v1StateUnchanged:JSON.stringify(before)===JSON.stringify(state),v1ResultHashMatches:state.resultHash===original.resultHash,v1ShellAvailable:shell.status===200,v2ShellAvailable:nextShell.status===200,v1ReviewAvailable:reviewResponse.status===200&&review.result.inputHash===original.inputHash&&review.result.summary.total===10,v1OneSignature:state.signatures===1};
 const evidence={checkedAt:new Date().toISOString(),status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,before,after:state,note:'The original V1 receipt, exact source/result digest and one-signature history remain intact. The separately documented setup transfer changes spare test-wallet balance; it does not replace or reuse this V1 paid intent.'};
 writeFileSync('docs/evidence/v2/v1-regression.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));if(evidence.status!=='PASS')process.exitCode=1;
}
