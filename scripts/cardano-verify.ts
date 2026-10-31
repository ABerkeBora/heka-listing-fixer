import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeCardanoTransaction} from '@x402/cardano';

/** Read-only: no wallet configuration, signer, facilitator, submit or settlement API is imported. */
const KOIOS='https://preprod.koios.rest/api/v1';
const publicJson=(file:string):Record<string,unknown>=>existsSync(file)?JSON.parse(readFileSync(file,'utf8')) as Record<string,unknown>:{};
const asRecord=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const latestPath='docs/evidence/payment-live.json';
const latest=publicJson(latestPath);
const hash=String(process.argv[2]??latest.transaction??'').toLowerCase();
if(!/^[0-9a-f]{64}$/.test(hash))throw new Error('Pass the actual Cardano preprod transaction hash: npm run cardano:verify -- <hash>. This command only reads chain data.');
const archivePath=`docs/evidence/payment-${hash}.json`;
const archive=publicJson(archivePath);
const matchesPaidRecord=(record:Record<string,unknown>)=>{const receipt=asRecord(record.receipt);return record.status==='PASS'&&record.transaction===hash&&record.network==='cardano:preprod'&&receipt.success===true&&receipt.transaction===hash&&receipt.network==='cardano:preprod';};
const paidRecordSource=matchesPaidRecord(latest)?latestPath:matchesPaidRecord(archive)?archivePath:null;
const live=paidRecordSource===latestPath?latest:paidRecordSource===archivePath?archive:{};
const hasMatchingPaidRecord=paidRecordSource!==null;
const receipt=asRecord(live.receipt),mandate=asRecord(live.mandate);
// Mutable setup is diagnostic only. A historical paid transaction always pins its own roles.
const preflight=hasMatchingPaidRecord?{}:publicJson('docs/evidence/payment-preflight.json');
const buyer=String(hasMatchingPaidRecord?receipt.payer??'':preflight.buyerAddress??'');
const seller=String(hasMatchingPaidRecord?mandate.allowedSeller??'':preflight.sellerAddress??'');
if(!buyer.startsWith('addr_test1')||!seller.startsWith('addr_test1')||buyer===seller)throw new Error('Matching paid evidence must pin distinct receipt.payer and mandate.allowedSeller addresses. Preflight addresses are used only for an unqualified chain diagnostic when no paid record matches. No keys are read.');
const checkedAt=new Date().toISOString();
const canonicalAmount=(value:unknown):bigint=>{if(typeof value!=='string'||!/^(0|[1-9]\d*)$/.test(value))throw new Error('Chain provider returned a noncanonical lovelace amount.');return BigInt(value);};
async function read(path:string,body?:unknown):Promise<unknown>{
 const response=await fetch(KOIOS+path,{method:body?'POST':'GET',redirect:'error',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20_000)});
 if(!response.ok)throw new Error(`Read-only Koios ${path} returned HTTP ${response.status}.`);
 const text=await response.text();if(text.length>512_000)throw new Error('Single-transaction chain response exceeded the verifier limit.');return JSON.parse(text);
}
type Check={name:string;status:'PASS'|'FAIL'|'PENDING';detail:string};
const checks:Check[]=[];
const check=(name:string,pass:boolean,detail:string)=>checks.push({name,status:pass?'PASS':'FAIL',detail});
const txBody={_tx_hashes:[hash]};
const [infoRows,cborRows,statusRows,tipRows]=await Promise.all([
 read('/tx_info',{...txBody,_inputs:true,_assets:true,_metadata:true,_withdrawals:true,_certs:true,_scripts:true,_bytecode:false,_governance:true}),
 read('/tx_cbor',txBody),read('/tx_status',txBody),read('/tip'),
]);
const findRow=(rows:unknown,key='tx_hash',value=hash)=>Array.isArray(rows)?asRecord(rows.find(row=>asRecord(row)[key]===value)):{};
const info=findRow(infoRows),raw=findRow(cborRows),chainStatus=findRow(statusRows);
const tip=Array.isArray(tipRows)?asRecord(tipRows[0]):{};
const observed=info.tx_hash===hash&&raw.tx_hash===hash&&typeof raw.cbor==='string'&&raw.cbor.length>0;
let chain:Record<string,unknown>={transaction:hash,observed:false};
if(!observed){
 checks.push({name:'canonical_transaction_observed',status:'PENDING',detail:'The preprod indexer has not returned both transaction details and public CBOR yet. This is not proof of failure or permission to pay again.'});
}else{
 const cbor=String(raw.cbor);if(!/^(?:[0-9a-f]{2})+$/i.test(cbor))throw new Error('Public transaction CBOR is malformed.');
 const decoded=decodeCardanoTransaction(Buffer.from(cbor,'hex').toString('base64'));
 const inputs=Array.isArray(info.inputs)?info.inputs.map(asRecord):[];
 const outputs=Array.isArray(info.outputs)?info.outputs.map(asRecord):[];
 const address=(row:Record<string,unknown>)=>String(asRecord(row.payment_addr).bech32??'');
 const inputTotal=inputs.reduce((sum,row)=>sum+canonicalAmount(row.value),0n);
 const outputTotal=outputs.reduce((sum,row)=>sum+canonicalAmount(row.value),0n);
 const fee=canonicalAmount(info.fee);
 const blockHeight=Number(info.block_height),tipHeight=Number(tip.block_height);
 const newerBlocks=Number.isSafeInteger(blockHeight)&&Number.isSafeInteger(tipHeight)?tipHeight-blockHeight:null;
 const reportedConfirmations=chainStatus.num_confirmations;
 const sellerOutputs=outputs.filter(row=>address(row)===seller);
 const buyerOutputs=outputs.filter(row=>address(row)===buyer);
 const decodedSeller=decoded.outputs.filter(row=>row.address===seller);
 const indexedInputRefs=inputs.map(row=>`${String(row.tx_hash)}#${Number(row.tx_index)}`).sort();
 const decodedInputRefs=[...decoded.inputs].sort();
 const indexedOutputs=outputs.map(row=>({index:Number(row.tx_index),address:address(row),value:String(row.value)})).sort((a,b)=>a.index-b.index);
 check('canonical_transaction_hash',decoded.txHash===hash,'Canonical hash computed from the public transaction body matches the requested hash.');
 check('valid_transaction',info.valid_contract!==false&&raw.valid_contract!==false&&decoded.isValid&&decoded.signaturesValid&&decoded.vkeyWitnessCount>0&&decoded.scriptWitnessCount===0&&decoded.redeemerCount===0,'The observed Koios responses omit valid_contract. The exact public CBOR has ledger is_valid=true, valid Ed25519 signatures and no scripts/redeemers; its canonical indexed outputs match the body. Any explicit provider invalid flag is rejected.');
 check('preprod_provider_and_testnet_body',decoded.networkId!==1,'Data is queried only from the preprod endpoint; the decoded body does not select mainnet. Testnet address syntax alone cannot distinguish preview from preprod.');
 check('distinct_payer_and_recipient',buyer!==seller&&inputs.length>0&&inputs.every(row=>address(row)===buyer),'Every consumed regular input belongs to the pinned buyer; buyer and seller are distinct addresses.');
 check('input_binding',JSON.stringify(indexedInputRefs)===JSON.stringify(decodedInputRefs),'Public CBOR inputs agree exactly with indexed input references.');
 check('exact_seller_payment',sellerOutputs.length===1&&canonicalAmount(sellerOutputs[0]!.value)===2_000_000n&&decodedSeller.length===1&&decodedSeller[0]!.coin===2_000_000n,'Exactly 2000000 lovelace is delivered to the pinned seller in both indexed outputs and public CBOR.');
 check('change_and_output_allowlist',buyerOutputs.length>=1&&outputs.every(row=>[buyer,seller].includes(address(row)))&&decoded.outputs.every(row=>[buyer,seller].includes(row.address)),'Every remaining output returns change to the buyer; no third-party fee recipient exists in this transaction.');
 check('indexed_outputs_match_signed_body',indexedOutputs.length===decoded.outputs.length&&indexedOutputs.every((row,i)=>row.index===i&&row.address===decoded.outputs[i]!.address&&BigInt(row.value)===decoded.outputs[i]!.coin),'Every indexed output address and lovelace amount matches the signed transaction body.');
 check('lovelace_only',decoded.outputs.every(row=>Object.keys(row.assets).length===0)&&inputs.every(row=>!Array.isArray(row.asset_list)||row.asset_list.length===0),'This paid request transfers lovelace only; no native token output is included.');
 check('no_other_balance_actions',decoded.balanceChangingOperations.length===0&&decoded.scriptWitnessCount===0&&decoded.redeemerCount===0,'No mint, withdrawal, deposit, donation or script execution can obscure this direct payment balance.');
 check('network_fee_and_value_conservation',fee===decoded.fee&&inputTotal===outputTotal+fee&&canonicalAmount(info.total_output)===outputTotal,'All consumed lovelace equals all outputs plus the exact network fee; no balance is inferred from a UI label.');
 check('canonical_depth',newerBlocks!==null&&newerBlocks>=1&&Number.isInteger(reportedConfirmations)&&Number(reportedConfirmations)>=1,'At least one newer canonical block exists in both tip-height subtraction and the separate tx_status query.');
 chain={transaction:hash,observed:true,explorerUrl:`https://preprod.cardanoscan.io/transaction/${hash}`,blockHash:info.block_hash,blockHeight,tipHeight,newerCanonicalBlocks:newerBlocks,reportedNewerBlocks:reportedConfirmations,transactionTimestamp:info.tx_timestamp,networkFeeLovelace:fee.toString(),servicePriceLovelace:'2000000',sellerNetOutputLovelace:sellerOutputs.reduce((sum,row)=>sum+canonicalAmount(row.value),0n).toString(),buyerInputLovelace:inputTotal.toString(),buyerChangeLovelace:buyerOutputs.reduce((sum,row)=>sum+canonicalAmount(row.value),0n).toString(),totalOutputLovelace:outputTotal.toString(),payer:buyer,recipient:seller,inputs:inputs.map(row=>({transaction:String(row.tx_hash),index:Number(row.tx_index),address:address(row),lovelace:String(row.value)})),outputs:indexedOutputs,publicCborSha256:createHash('sha256').update(Buffer.from(cbor,'hex')).digest('hex'),rawCborPublishedByThisVerifier:false,indexerValidContractFlagAvailable:typeof info.valid_contract==='boolean'||typeof raw.valid_contract==='boolean',publicCborLedgerIsValid:decoded.isValid,publicCborSignaturesValid:decoded.signaturesValid,scriptWitnessCount:decoded.scriptWitnessCount,redeemerCount:decoded.redeemerCount};
}
const archivedResultPath=`docs/evidence/payment-${hash}-result.json`;
const resultSource=existsSync(archivedResultPath)?archivedResultPath:latest.transaction===hash?'docs/evidence/payment-live-result.json':null;
const result=resultSource?publicJson(resultSource):{};
const resultHash=Object.keys(result).length?createHash('sha256').update(JSON.stringify(result)).digest('hex'):null;
const deliveryMatches=hasMatchingPaidRecord&&live.status==='PASS'&&live.transaction===hash&&receipt.success===true&&receipt.transaction===hash&&receipt.network==='cardano:preprod'&&live.inputHash===result.inputHash&&typeof live.inputHash==='string'&&live.resultHash===resultHash&&result.mode==='model_checked'&&asRecord(result.model).called===true&&mandate.allowedSeller===seller;
const delivery={status:deliveryMatches?'PASS':'PENDING',paidRecordSource,resultSource,intentId:live.intentId??null,inputHash:live.inputHash??null,resultHash,receiptTransaction:receipt.transaction??null,detail:deliveryMatches?'The separately recorded paid receipt and delivered catalog hash match this observed chain transaction and input.':'The complete paid-result evidence has not yet been recorded for this hash. Chain observation alone does not prove delivery.'};
if(deliveryMatches&&observed){
 const fee=canonicalAmount(chain.networkFeeLovelace);
 check('delegated_fee_and_total_caps',fee<=canonicalAmount(mandate.feeCapLovelace)&&2_000_000n<=canonicalAmount(mandate.serviceCapLovelace)&&2_000_000n+fee<=canonicalAmount(mandate.totalCapLovelace)&&mandate.apiFeeCapLovelace==='0','The independently observed economic action stays within the recorded initial service, network fee, API fee and total caps.');
}
const chainStatusFinal=checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='PENDING')?'PENDING':'PASS';
const evidence={checkedAt,checkedAtEuropeBerlin:new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'long',timeZone:'Europe/Berlin'}).format(new Date(checkedAt)),network:'cardano:preprod',status:chainStatusFinal==='PASS'&&deliveryMatches?'PASS':chainStatusFinal==='FAIL'?'FAIL':'PENDING',chainStatus:chainStatusFinal,readOnly:true,expectedRolesSource:paidRecordSource??'diagnostic preflight fallback; never qualifies delivery',verificationSources:[{url:'https://api.koios.rest/koiosapi.yaml',purpose:'Official request/response schema for tx_info, tx_cbor, tx_status and tip.'},{url:'https://raw.githubusercontent.com/cardano-community/koios-artifacts/master/files/grest/rpc/transactions/tx_status.sql',purpose:'Confirmation convention: blocks newer than the block containing the transaction.'},{url:KOIOS,purpose:'Independent public preprod chain-indexer observations; no facilitator response used as chain evidence.'}],chain,checks,delivery,trust:'This independently checks the hosted facilitator receipt against the public Koios preprod indexer and exact public signed CBOR. It is not a self-hosted Cardano node or a proof of irreversible finality. The catalog input/result association is application evidence; the direct address payment does not commit catalog hashes on chain.'};
mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/payment-chain.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,chainStatus:evidence.chainStatus,transaction:hash,networkFeeLovelace:chain.networkFeeLovelace??null,sellerLovelace:chain.sellerNetOutputLovelace??null,newerCanonicalBlocks:chain.newerCanonicalBlocks??null,deliveryStatus:delivery.status,checks:checks.map(({name,status})=>({name,status})),evidence:'docs/evidence/payment-chain.json'},null,2));
if(evidence.status!=='PASS')process.exitCode=2;
