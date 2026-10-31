import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {PaymentRequired,SettleResponse} from '@x402/core/types';
import type {DecodedCardanoTransaction} from '@x402/cardano';
import {validateMandate,validateQuote,validateDecodedTransaction,validateReceiptBinding,validatePaidCatalogResult,PaymentPolicyError,type PaymentMandate} from '../server/payment/policy.js';
import {PaymentStore,publicPaymentIntent,type IntentRecord} from '../server/payment/store.js';

// Public test addresses only. Transaction objects below are synthetic unit fixtures, never chain evidence.
const seller='addr_test1qrj33p9fj9mu85q55fj9m3tdc4jexk7ehylm6qrta3vd66qysmcy6nrysklxspcs24erkzgt8yeelt4wa92swggjtczsawv229';
const buyer='addr_test1qr8dn6eysm3fp68f8gsrcxtvhqewztsutc7asvzk43s0fs7edlkjxxvq4qhdegzkn5gy06xqk7ktqdd3ulrmxxu4r55q0zvpkc';
const endpoint='http://127.0.0.1:3107/api/service/jobs/batch_test';
const m=():PaymentMandate=>({network:'cardano:preprod',asset:'lovelace',allowedSeller:seller,endpoint,beneficiary:'Local catalog owner',serviceCapLovelace:'2000000',feeCapLovelace:'300000',apiFeeCapLovelace:'0',totalCapLovelace:'2300000',maxActions:1,expiresAt:new Date(Date.now()+600_000).toISOString()});
const q=():PaymentRequired=>({x402Version:2,resource:{url:endpoint},accepts:[{scheme:'exact',network:'cardano:preprod',asset:'lovelace',amount:'2000000',payTo:seller,maxTimeoutSeconds:300,extra:{confirmationPolicy:{l1Confirmations:1},areFeesSponsored:false}}]});
const throws=(fn:()=>unknown,code:string)=>assert.throws(fn,(e:unknown)=>e instanceof PaymentPolicyError&&e.code===code);

test('one bounded preprod service quote fits separate integer caps',()=>{
 const mandate=m();validateMandate(mandate,seller,endpoint);assert.equal(validateQuote(q(),mandate,seller,endpoint).amount,'2000000');
});
test('over-budget quote, wrong recipient, different resource and script substitution fail before signing',()=>{
 throws(()=>validateQuote(q(),{...m(),serviceCapLovelace:'1000000'},seller,endpoint),'over_budget');
 const wrong=q();wrong.accepts[0]!.payTo=buyer;throws(()=>validateQuote(wrong,m(),seller,endpoint),'seller_denied');
 const resource=q();resource.resource.url=endpoint+'_other';throws(()=>validateQuote(resource,m(),seller,endpoint),'quote_binding');
 const script=q();script.accepts[0]!.extra={assetTransferMethod:'script'};throws(()=>validateQuote(script,m(),seller,endpoint),'unsupported_payment_terms');
});
test('expired delegation, mainnet, noninteger caps and multiple actions are blocked',()=>{
 throws(()=>validateMandate({...m(),expiresAt:new Date(Date.now()-1).toISOString()},seller,endpoint),'mandate_expired');
 throws(()=>validateMandate({...m(),network:'cardano:mainnet'} as unknown as PaymentMandate,seller,endpoint),'network_asset_denied');
 throws(()=>validateMandate({...m(),feeCapLovelace:'0.30'},seller,endpoint),'invalid_amount');
 throws(()=>validateMandate({...m(),maxActions:2} as unknown as PaymentMandate,seller,endpoint),'action_limit');
 throws(()=>validateMandate({...m(),feeCapLovelace:'300001'},seller,endpoint),'invalid_total_cap');
 throws(()=>validateMandate({...m(),apiFeeCapLovelace:'1'} as unknown as PaymentMandate,seller,endpoint),'api_fee_denied');
 const missing={...m()} as Partial<PaymentMandate>;delete missing.apiFeeCapLovelace;throws(()=>validateMandate(missing as PaymentMandate,seller,endpoint),'api_fee_denied');
});
const fixtureTx=():DecodedCardanoTransaction=>({txHash:'1'.repeat(64),networkId:0,ttlSlot:BigInt(Math.floor((Date.now()+180_000-1655769600000)/1000)+86400),inputs:['2'.repeat(64)+'#0'],fee:180000n,sizeBytes:400,balanceChangingOperations:[],outputs:[{address:seller,coin:2000000n,assets:{}},{address:buyer,coin:6000000n,assets:{}}],vkeyWitnessCount:1,vkeyHashes:[],scriptWitnessCount:0,redeemerCount:0,signaturesValid:true,isValid:true});
test('exact signed transaction inspection catches fee excess, extra recipient and edited seller amount',()=>{
 const tx=fixtureTx();validateDecodedTransaction(tx,tx.inputs[0]!,buyer,m(),'2000000');
 throws(()=>validateDecodedTransaction({...tx,fee:300001n},tx.inputs[0]!,buyer,m(),'2000000'),'fee_over_budget');
 throws(()=>validateDecodedTransaction({...tx,outputs:[...tx.outputs,{address:'unapproved',coin:1n,assets:{}}]},tx.inputs[0]!,buyer,m(),'2000000'),'unauthorized_output');
 throws(()=>validateDecodedTransaction({...tx,outputs:[{address:seller,coin:2000001n,assets:{}}]},tx.inputs[0]!,buyer,m(),'2000000'),'seller_output_mismatch');
 throws(()=>validateDecodedTransaction({...tx,signaturesValid:false},tx.inputs[0]!,buyer,m(),'2000000'),'invalid_transaction');
 throws(()=>validateDecodedTransaction(tx,'3'.repeat(64)+'#0',buyer,m(),'2000000'),'nonce_mismatch');
});
const receipt=():SettleResponse=>({success:true,network:'cardano:preprod',transaction:'1'.repeat(64),extra:{status:'confirmed',confirmations:1}});
test('wrong transaction, input, intent, network and weak receipt never authorize delivery',()=>{
 const bound={intentId:'batch_test',inputHash:'a'.repeat(64)};validateReceiptBinding(receipt(),'1'.repeat(64),bound,bound);
 throws(()=>validateReceiptBinding({...receipt(),transaction:'2'.repeat(64)},'1'.repeat(64),bound,bound),'receipt_mismatch');
 throws(()=>validateReceiptBinding(receipt(),'1'.repeat(64),bound,{...bound,intentId:'different'}),'receipt_mismatch');
 throws(()=>validateReceiptBinding(receipt(),'1'.repeat(64),bound,{...bound,inputHash:'b'.repeat(64)}),'receipt_mismatch');
 throws(()=>validateReceiptBinding({...receipt(),network:'cardano:mainnet'},'1'.repeat(64),bound,bound),'receipt_mismatch');
 throws(()=>validateReceiptBinding({...receipt(),extra:{status:'mempool',confirmations:-1}},'1'.repeat(64),bound,bound),'confirmation_policy');
 throws(()=>validateReceiptBinding({...receipt(),extra:{status:'confirmed',confirmations:'1'}},'1'.repeat(64),bound,bound),'confirmation_policy');
});
test('durable intent retains same signed payload after restart; unique input and tx binding reject duplicates',()=>{
 const dir=mkdtempSync(join(tmpdir(),'listing-fixer-pay-'));const path=join(dir,'payment.sqlite');const now=new Date().toISOString();
 const r:IntentRecord={id:'batch_test',inputHash:'a'.repeat(64),mandate:m(),status:'receipt_unresolved',reason:'timeout',quote:q(),payload:{x402Version:2,resource:{url:endpoint},accepted:q().accepts[0]!,payload:{transaction:'synthetic-unit-fixture',nonce:'2'.repeat(64)+'#0'}},transaction:'1'.repeat(64),networkFeeLovelace:'180000',result:{privateResult:true},receipt:null,events:[],createdAt:now,updatedAt:now,verified:true};
 try{let store=new PaymentStore(path);store.save(r);store.close();store=new PaymentStore(path);const resumed=store.get(r.id)!;
  assert.deepEqual(resumed.payload,r.payload);assert.equal(resumed.transaction,r.transaction);assert.equal(publicPaymentIntent(resumed).result,null);assert.equal(publicPaymentIntent(resumed).hasSignedPayload,true);
  assert.equal('payload' in publicPaymentIntent(resumed),false);
  assert.throws(()=>store.save({...r,id:'batch_other'}));assert.throws(()=>store.save({...r,id:'batch_other',inputHash:'b'.repeat(64)}));
  resumed.status='confirmed';resumed.receipt=receipt();store.save(resumed);assert.deepEqual(publicPaymentIntent(store.get(r.id)!).result,{privateResult:true});store.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('purchased result must match input and actual model service; free review and mismatched counts cannot settle',()=>{
 const result={inputHash:'a'.repeat(64),schema:'listing-v1',language:'en',mode:'model_checked',model:{provider:'ollama',called:true,acceptedEdits:1,rejectedEdits:0},products:[{status:'needs_source',diffs:[{before:'Mug',after:'Mug · 350 ml',source:{parts:[{field:'title',text:'Mug'},{field:'sourceText',text:'350 ml'}]}}]}],summary:{total:1,ready:0,needsSource:1,review:0}};
 validatePaidCatalogResult(result,'a'.repeat(64));
 throws(()=>validatePaidCatalogResult({...result,mode:'source_review'},'a'.repeat(64)),'result_binding');
 throws(()=>validatePaidCatalogResult({...result,model:{provider:'ollama',called:false,acceptedEdits:1,rejectedEdits:0}},'a'.repeat(64)),'result_binding');
 throws(()=>validatePaidCatalogResult({...result,model:{provider:'ollama',called:true,acceptedEdits:0,rejectedEdits:1}},'a'.repeat(64)),'result_binding');
 throws(()=>validatePaidCatalogResult({...result,model:{provider:'ollama',called:true,acceptedEdits:1,rejectedEdits:-1}},'a'.repeat(64)),'result_binding');
 throws(()=>validatePaidCatalogResult(result,'b'.repeat(64)),'result_binding');
 throws(()=>validatePaidCatalogResult({...result,summary:{...result.summary,ready:1}},'a'.repeat(64)),'result_binding');
 throws(()=>validatePaidCatalogResult({...result,products:[{status:'needs_source',diffs:[]}]},'a'.repeat(64)),'result_binding');
 throws(()=>validatePaidCatalogResult({...result,products:[{status:'needs_source',diffs:[{before:'Mug 350 ml',after:'Mug · 350 ml',source:{parts:[{field:'title',text:'Mug'},{field:'sourceText',text:'350 ml'}]}}]}]},'a'.repeat(64)),'result_binding');
});
