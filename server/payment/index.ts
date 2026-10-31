import { resolve } from 'node:path';
import { orderHash as canonicalOrderHash } from '../acceptance.js';
import { slotToPosixMs } from '@x402/cardano';
import type { Request,Response,NextFunction } from 'express';
import { x402Client } from '@x402/core/client';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { decodePaymentRequiredHeader,decodePaymentSignatureHeader,decodePaymentResponseHeader,encodePaymentSignatureHeader,encodePaymentRequiredHeader,encodePaymentResponseHeader } from '@x402/core/http';
import { toClientCardanoSigner,decodeCardanoTransaction, type ClientCardanoSigner } from '@x402/cardano';
import { ExactCardanoScheme as ClientScheme } from '@x402/cardano/exact/client';
import { ExactCardanoScheme as ServerScheme } from '@x402/cardano/exact/server';
import type { PaymentRequired,PaymentPayload,SettleResponse } from '@x402/core/types';
import { NETWORK,ASSET,SERVICE_PRICE,PaymentPolicyError,validateMandate,validateQuote,inspectSignedTransaction,validateReceiptBinding,validatePaidCatalogResult,validateQuoteAcceptanceBinding,reject,type PaymentMandate } from './policy.js';
import { PaymentStore,publicPaymentIntent,type IntentRecord,type PublicPaymentIntent } from './store.js';
import { loadWalletConfig,readBuyerBalance } from './wallets.js';
export type { PaymentMandate } from './policy.js';
export { PaymentPolicyError } from './policy.js';
export type { PublicPaymentIntent } from './store.js';

const HOSTED_FACILITATOR='https://x402.preprod.dev.ecosyseng.cf-deployments.org';
export interface PaymentServiceConfig {
  dbPath?:string; resourceBaseUrl:string; sellerAddress?:string; walletFile?:string;
  resourcePathPrefix?:string;
  dedupeBy?:'inputHash'|'orderHash';
  beforeSettle?:(context:{intentId:string;inputHash:string;result:unknown;mandate:PaymentMandate;quote:PaymentRequired;transaction:string})=>Promise<void>;
  onResource:(intentId:string,inputHash:string)=>Promise<unknown>;
}
export function createPaymentService(config:PaymentServiceConfig) {
  if(config.dedupeBy==='orderHash'&&(!config.walletFile||resolve(config.walletFile)===resolve('.local/cardano-wallets.json')))throw new Error('V2 requires its own explicit wallet file.');
  if(config.dedupeBy==='orderHash'&&(!config.dbPath||resolve(config.dbPath)===resolve('data/payment.sqlite')||!config.resourcePathPrefix||config.resourcePathPrefix==='/api/service/jobs'))throw new Error('V2 requires a separate database and resource endpoint.');
  const wallet=loadWalletConfig(config.walletFile,{fileOnly:config.dedupeBy==='orderHash'});
  const seller=config.sellerAddress??wallet.sellerAddress??'';
  const base=new URL(config.resourceBaseUrl);
  if(base.protocol!=='http:' || !['127.0.0.1','localhost'].includes(base.hostname)) throw new Error('The delegated buyer only calls the local Listing Fixer service.');
  const store=new PaymentStore(config.dbPath??'data/payment.sqlite',{dedupeBy:config.dedupeBy});
  const facilitator=new HTTPFacilitatorClient({url:HOSTED_FACILITATOR,timeoutMs:90_000});
  const server=new x402ResourceServer(facilitator).register(NETWORK,new ServerScheme());
  let initialized:Promise<void>|null=null;
  const initialize=()=> initialized??=(server.initialize().catch(e=>{initialized=null;throw e;}));
  const prefix=config.resourcePathPrefix??'/api/service/jobs';
  if(!/^\/api\/[A-Za-z0-9/_-]+$/.test(prefix)||prefix.includes('//')||prefix.endsWith('/'))throw new Error('Resource path prefix must be a fixed local API path.');
  const endpoint=(id:string)=>new URL(`${prefix}/${encodeURIComponent(id)}`,base).href;
  function assertBinding(inputHash:string,mandate:PaymentMandate){
    if(config.dedupeBy==='orderHash'&&(!mandate.acceptanceHash||!mandate.orderHash))reject('acceptance_binding','An acceptance-bound order hash is required.');
    if(mandate.acceptanceHash&&canonicalOrderHash(inputHash,mandate.acceptanceHash)!==mandate.orderHash)reject('acceptance_binding','Order hash does not match the input and fixed acceptance.');
  }
  const bindingMetadata=(r:IntentRecord)=>r.mandate.acceptanceHash?{acceptanceHash:r.mandate.acceptanceHash,orderHash:r.mandate.orderHash}:{};
  function expiredUnsettledRejection(r:IntentRecord):boolean {
    if(r.status!=='acceptance_not_met'||(r.settlementCalls??0)!==0||r.receipt||!r.payload)return false;
    try{const tx=decodeCardanoTransaction(String(r.payload.payload.transaction));return tx.ttlSlot!==undefined&&slotToPosixMs(NETWORK,tx.ttlSlot)+30_000<Date.now();}catch{return false;}
  }
  const buyer=wallet.buyerAddress??'';
  let busy=Promise.resolve<unknown>(null);
  const sellerLocks=new Map<string,Promise<void>>();
  async function acquireSellerLock(id:string):Promise<()=>void> {
    const prior=sellerLocks.get(id)??Promise.resolve();
    let unlock!:()=>void;
    const gate=new Promise<void>(resolve=>{unlock=resolve;});
    const tail=prior.catch(()=>{}).then(()=>gate);
    sellerLocks.set(id,tail);await prior.catch(()=>{});
    let released=false;
    return ()=>{if(released)return;released=true;unlock();if(sellerLocks.get(id)===tail)sellerLocks.delete(id);};
  }
  let readinessCache:{at:number;value:Awaited<ReturnType<typeof readinessUncached>>}|null=null;

  async function readinessUncached() {
    const blockers:string[]=[];let balance:string|null=null;
    if(!seller)blockers.push('Seller address is not configured. Run npm run cardano:wallets.');
    if(!wallet.mnemonic||!buyer)blockers.push('Buyer test wallet is not configured. Run npm run cardano:wallets.');
    if(seller&&buyer&&seller===buyer)blockers.push('Buyer and seller addresses must be distinct.');
    if(wallet.mnemonic&&buyer)try{balance=await readBuyerBalance(wallet);if(BigInt(balance??'0')<5_000_000n)blockers.push('Fund the buyer with 5 test ADA on Cardano preprod to cover the service, bounded network fee and a valid change output.');}catch{blockers.push('Cardano preprod balance lookup failed. Retry the connection check.');}
    try{await initialize();}catch{blockers.push('The official preprod facilitator is not reachable.');}
    return {configured:Boolean(seller&&wallet.mnemonic&&buyer&&seller!==buyer),ready:blockers.length===0,network:NETWORK,asset:ASSET,sellerAddress:seller||null,buyerAddress:buyer||null,provider:wallet.providerName,buyerBalanceLovelace:balance,blockers,servicePriceLovelace:SERVICE_PRICE,facilitatorUrl:HOSTED_FACILITATOR,limitsEnforcedBy:'application validator and signed transaction; no budget smart contract',refundPolicy:'Direct payment; no escrow or automatic refund guarantee.'};
  }
  async function readiness(force=false) {if(force||!readinessCache||Date.now()-readinessCache.at>30_000)readinessCache={at:Date.now(),value:await readinessUncached()};return readinessCache.value;}
  function requireIntent(id:string):IntentRecord {const r=store.get(id);if(!r)reject('unknown_intent','Unknown payment intent.');return r;}
  function prepare(input:{intentId:string;inputHash:string;mandate:PaymentMandate}):PublicPaymentIntent {
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(input.intentId)||!/^[a-f0-9]{64}$/.test(input.inputHash))reject('invalid_intent','A stable intent ID and SHA-256 input hash are required.');
    validateMandate(input.mandate,seller,endpoint(input.intentId));
    if(buyer===seller)reject('self_payment_denied','Buyer and seller addresses must differ.');
    assertBinding(input.inputHash,input.mandate);
    const previous=store.get(input.intentId);
    if(previous) {
      if(previous.inputHash!==input.inputHash)reject('intent_conflict','Intent ID is already bound to another input.');
      if(previous.mandate.acceptanceHash!==input.mandate.acceptanceHash||previous.mandate.orderHash!==input.mandate.orderHash)reject('acceptance_binding','An intent cannot replace its initially fixed acceptance.');
      if(previous.mandate.acceptanceHash&&JSON.stringify(previous.mandate)!==JSON.stringify(input.mandate))reject('mandate_immutable','An acceptance-bound intent cannot replace its initial mandate, including expiry.');
      if(previous.payload||previous.transaction||previous.status==='confirmed')return publicPaymentIntent(store.event(previous.id,'duplicate_intent_reused','Existing intent retained; no new payment can be signed.'));
      if(JSON.stringify(previous.mandate)!==JSON.stringify(input.mandate)) {
        previous.mandate=input.mandate;previous.quote=null;previous.status='ready';previous.reason=null;store.save(previous);
        return publicPaymentIntent(store.event(previous.id,'mandate_replaced_before_signing','Fresh initial delegation replaced an unsigned attempt.'));
      }
      return publicPaymentIntent(previous);
    }
    const dedupeKey=config.dedupeBy==='orderHash'?input.mandate.orderHash!:input.inputHash;
    const same=store.byDedupeKey(dedupeKey);if(same)reject('duplicate_input','This exact batch already has a payment intent. Resume that intent.');
    const now=new Date().toISOString();
    const r:IntentRecord={id:input.intentId,inputHash:input.inputHash,mandate:input.mandate,status:'ready',reason:null,quote:null,payload:null,transaction:null,networkFeeLovelace:null,result:null,receipt:null,verified:false,settlementCalls:0,...(config.dedupeBy==='orderHash'?{dedupeKey}:{}),events:[{at:now,decision:'mandate_accepted',detail:'One catalog batch; fixed seller, endpoint, network, asset, expiry and separate integer spend caps.'}],createdAt:now,updatedAt:now};
    store.save(r);return publicPaymentIntent(r);
  }
  async function quoteFor(r:IntentRecord):Promise<PaymentRequired> {
    if(r.quote){validateQuoteAcceptanceBinding(r.quote,r.mandate);return r.quote;}
    await initialize();
    const seconds=Math.min(600,Math.floor((Date.parse(r.mandate.expiresAt)-Date.now())/1000));
    if(seconds<1)reject('mandate_expired','Delegation expired before a quote could be issued.');
    const requirements=await server.buildPaymentRequirements({scheme:'exact',network:NETWORK,payTo:seller,price:{amount:SERVICE_PRICE,asset:ASSET},maxTimeoutSeconds:seconds,extra:{confirmationPolicy:{l1Confirmations:1},areFeesSponsored:false}});
    const quote=await server.createPaymentRequiredResponse(requirements,{url:endpoint(r.id),description:'Source-linked repair, field diff and deterministic validation for up to ten catalog products.',mimeType:'application/json'},undefined,r.mandate.acceptanceHash?{'listing-acceptance':{info:{inputHash:r.inputHash,acceptanceHash:r.mandate.acceptanceHash,orderHash:r.mandate.orderHash}}}:undefined);
    validateQuote(quote,r.mandate,seller,endpoint(r.id));r.quote=quote;store.save(r);store.event(r.id,'quote_issued','The x402 v2 offer is bound to this exact catalog batch endpoint.','quoted');return quote;
  }
  async function sellerMiddleware(req:Request,res:Response,next:NextFunction) {
    let release:(()=>void)|undefined;let continued=false;
    try {
      release=await acquireSellerLock(String(req.params.id));
      res.locals.paymentRelease=release;
      const id=String(req.params.id);const r=requireIntent(id);
      assertBinding(r.inputHash,r.mandate);
      if(r.status==='acceptance_not_met'){res.status(422).json({error:'acceptance_not_met',reason:r.reason,intentId:id,...bindingMetadata(r),settlementCalls:r.settlementCalls??0});return;}
      res.setHeader('Cache-Control','no-store');
      const quote=await quoteFor(r);
      const header=req.get('PAYMENT-SIGNATURE');
      if(!header) {res.setHeader('PAYMENT-REQUIRED',encodePaymentRequiredHeader(quote));res.status(402).json({error:'payment_required',intentId:r.id,inputHash:r.inputHash});return;}
      if(header.length>150_000)reject('invalid_payload','Payment header is too large.');
      const payload=decodePaymentSignatureHeader(header);
      if(payload.x402Version!==2||JSON.stringify(payload.accepted)!==JSON.stringify(quote.accepts[0])||payload.resource?.url!==endpoint(id))reject('quote_binding','Payment proof is bound to another offer or resource.');
      if(r.mandate.acceptanceHash&&payload.extensions?.['listing-acceptance']&&JSON.stringify(payload.extensions['listing-acceptance'])!==JSON.stringify(quote.extensions?.['listing-acceptance']))reject('acceptance_binding','Payment echo changed the pinned quote acceptance.');
      const transaction=payload.payload.transaction;const nonce=payload.payload.nonce;
      if(typeof transaction!=='string'||typeof nonce!=='string')reject('invalid_payload','Signed transaction and nonce are required.');
      // A completed proof is still checked against its exact canonical hash before serving a cached receipt.
      const tx=decodeCardanoTransaction(transaction);
      if(r.transaction&&r.transaction!==tx.txHash)reject('duplicate_payment','A second transaction cannot replace this intent.');
      const bound=store.byTransaction(tx.txHash);if(bound&&bound.id!==id)reject('duplicate_payment','This transaction already belongs to another catalog job.');
      if(r.payload&&JSON.stringify(r.payload)!==JSON.stringify(payload))reject('duplicate_payment','Only the previously persisted signed payment may be retried.');
      if(r.receipt?.success&&r.status==='confirmed') {res.setHeader('PAYMENT-RESPONSE',encodePaymentResponseHeader(r.receipt));res.json({intentId:id,inputHash:r.inputHash,result:r.result,receipt:r.receipt,...bindingMetadata(r)});return;}
      if(!r.payload) {
        inspectSignedTransaction(transaction,nonce,buyer,r.mandate,quote.accepts[0]!.amount);
        r.payload=payload;r.transaction=tx.txHash;r.networkFeeLovelace=tx.fee.toString();store.save(r);
      } else if(JSON.stringify(r.payload)!==JSON.stringify(payload))reject('duplicate_payment','Only the previously persisted signed payment may be retried.');
      // A persisted quote/proof survives restart; the SDK facilitator map must be rebuilt.
      await initialize();
      if(!r.verified) {
        const verification=await server.verifyPayment(payload,quote.accepts[0]!);
        if(!verification.isValid) {store.event(id,'verification_rejected',verification.invalidReason??'Payment proof was rejected.','rejected',verification.invalidReason??'Payment proof was rejected.');res.status(402).json({error:'verification_rejected',reason:verification.invalidReason});return;}
        if(verification.payer!==buyer)reject('payer_mismatch','Payment is not from the delegated buyer.');
        r.verified=true;store.save(r);store.event(id,'payment_verified','Official facilitator accepted the exact signed transaction; no result released.');
      }
      continued=true;next();
    }catch(error){const code=error instanceof PaymentPolicyError?error.code:'payment_service_unavailable';res.status(error instanceof PaymentPolicyError?400:503).json({error:code,message:error instanceof PaymentPolicyError?error.message:'Payment service unavailable; no replacement payment was signed.'});}
    finally{if(!continued)release?.();}
  }
  async function sellerHandler(req:Request,res:Response) {
    const id=String(req.params.id);
    const release=res.locals.paymentRelease as (()=>void)|undefined;
    if(!release){res.status(400).json({error:'payment_not_verified'});return;}
    try{await servePaidResult(id,res);}finally{release();}
  }
  async function servePaidResult(id:string,res:Response) {
    try {
      let r=requireIntent(id);
      assertBinding(r.inputHash,r.mandate);
      if(r.status==='acceptance_not_met'){res.status(422).json({error:'acceptance_not_met',reason:r.reason,intentId:id,...bindingMetadata(r),settlementCalls:r.settlementCalls??0});return;}
      if(r.status==='confirmed'&&r.receipt?.success){res.setHeader('PAYMENT-RESPONSE',encodePaymentResponseHeader(r.receipt));res.json({intentId:id,inputHash:r.inputHash,result:r.result,receipt:r.receipt,...bindingMetadata(r)});return;}
      if(!r.payload||!r.quote||!r.verified)reject('payment_not_verified','Payment proof has not passed verification.');
      if(r.result===null) {
        try {r.result=await config.onResource(id,r.inputHash);validatePaidCatalogResult(r.result,r.inputHash);store.save(r);store.event(id,'result_validated','Catalog result is cached privately before settlement; no second model call on retry.');}
        catch(error) {if(error instanceof PaymentPolicyError&&error.code==='acceptance_not_met')throw error;store.event(id,'processing_failed','Catalog processing failed before settlement; no settle request sent.','processing_failed','Catalog processing failed before settlement.');res.status(422).json({error:'catalog_processing_failed'});return;}
      }
      r=requireIntent(id);validatePaidCatalogResult(r.result,r.inputHash);assertBinding(r.inputHash,r.mandate);validateQuoteAcceptanceBinding(r.quote!,r.mandate);
      if(config.beforeSettle) {
        const before=JSON.stringify({inputHash:r.inputHash,mandate:r.mandate,result:r.result});
        await config.beforeSettle(structuredClone({intentId:id,inputHash:r.inputHash,result:r.result,mandate:r.mandate,quote:r.quote!,transaction:r.transaction!}));
        r=requireIntent(id);assertBinding(r.inputHash,r.mandate);
        if(before!==JSON.stringify({inputHash:r.inputHash,mandate:r.mandate,result:r.result}))reject('acceptance_binding','Protected input, acceptance or result changed while checking acceptance.');
      }
      r=requireIntent(id);r.settlementCalls=(r.settlementCalls??0)+1;store.save(r);
      store.event(id,'settlement_requested','The local SDK settlement method receives the same persisted signed bytes. Counter counts local calls, not remote broadcasts.','payment_pending');
      const receipt=await server.settlePayment(r.payload!,r.quote!.accepts[0]!);
      if(receipt.transaction&&receipt.transaction!==r.transaction)reject('receipt_mismatch','Facilitator receipt names a different transaction.');
      r=requireIntent(id);r.receipt=receipt;
      if(receipt.success) {
        validateReceiptBinding(receipt,r.transaction,{intentId:id,inputHash:r.inputHash},{intentId:id,inputHash:r.inputHash});
        r.status='confirmed';r.reason=null;store.save(r);store.event(id,'payment_confirmed','One newer canonical block confirmed the seller payment; cached result released.');readinessCache=null;
        res.setHeader('PAYMENT-RESPONSE',encodePaymentResponseHeader(receipt));res.json({intentId:id,inputHash:r.inputHash,result:r.result,receipt,...bindingMetadata(r)});return;
      }
      r.status='receipt_unresolved';r.reason=receipt.errorReason??'Confirmation policy not yet met.';store.save(r);store.event(id,'receipt_unresolved','Funds may already have moved. Reconcile the same transaction; never sign a replacement.');
      res.setHeader('PAYMENT-RESPONSE',encodePaymentResponseHeader(receipt));res.status(202).json({error:'receipt_unresolved',intentId:id,transaction:r.transaction,receipt});
    }catch(error) {if(error instanceof PaymentPolicyError&&error.code==='acceptance_not_met'){const r=store.event(id,'acceptance_not_met',error.message,'acceptance_not_met',error.message);res.status(422).json({error:'acceptance_not_met',reason:error.message,intentId:id,inputHash:r.inputHash,...bindingMetadata(r),settlementCalls:r.settlementCalls??0});return;}store.event(id,'receipt_unresolved','Settlement outcome is unknown. Existing signed bytes and transaction hash are retained.','receipt_unresolved','Settlement outcome unknown; reconcile the existing payment.');res.status(202).json({error:'receipt_unresolved',intentId:id,transaction:store.get(id)?.transaction??null});}
  }
  async function paidRequest(id:string):Promise<PublicPaymentIntent> {
    let r=requireIntent(id);
    if(!r.payload)reject('missing_payload','There is no signed payment to reconcile.');
    try {
      const response=await fetch(endpoint(id),{method:'GET',redirect:'error',headers:{'PAYMENT-SIGNATURE':encodePaymentSignatureHeader(r.payload)},signal:AbortSignal.timeout(210_000)});
      const receiptHeader=response.headers.get('PAYMENT-RESPONSE');
      const body=await response.json() as {intentId?:string;inputHash?:string;result?:unknown;receipt?:SettleResponse;error?:string;acceptanceHash?:string;orderHash?:string};
      const receipt=receiptHeader?decodePaymentResponseHeader(receiptHeader):body.receipt;
      r=requireIntent(id);
      if(receipt?.success) {
        if(r.mandate.acceptanceHash&&(body.acceptanceHash!==r.mandate.acceptanceHash||body.orderHash!==r.mandate.orderHash))reject('acceptance_binding','Delivered acceptance binding differs from the initial delegation.');
        validateReceiptBinding(receipt,r.transaction,{intentId:id,inputHash:r.inputHash},body);
        validatePaidCatalogResult(body.result,r.inputHash);
        if(JSON.stringify(body.result)!==JSON.stringify(r.result))reject('result_binding','Delivered catalog differs from the privately cached paid result.');
        r.receipt=receipt;r.result=body.result;r.status='confirmed';r.reason=null;store.save(r);
      } else if(r.status!=='processing_failed'&&r.status!=='rejected'&&r.status!=='acceptance_not_met')store.event(id,'payment_pending','No final receipt was received. A second payment is prohibited.','receipt_unresolved','Payment receipt unresolved; check the existing transaction.');
    }catch(error) {
      r=requireIntent(id);
      if(r.status!=='confirmed'&&r.status!=='acceptance_not_met')store.event(id,'receipt_unresolved',error instanceof PaymentPolicyError?error.message:'Connection ended without a final receipt. Existing transaction retained.','receipt_unresolved',error instanceof PaymentPolicyError?error.message:'Payment outcome unknown; reconcile the existing transaction.');
    }
    return publicPaymentIntent(requireIntent(id));
  }
  async function run(id:string):Promise<PublicPaymentIntent> {
    let r=requireIntent(id);
    if(r.status==='acceptance_not_met')return publicPaymentIntent(r);
    if(r.status==='confirmed')return publicPaymentIntent(store.event(id,'duplicate_intent_reused','Confirmed result and receipt returned; no second charge.'));
    if(r.payload)return paidRequest(id);
    try {
      validateMandate(r.mandate,seller,endpoint(id));assertBinding(r.inputHash,r.mandate);
      const other=store.all().find(o=>o.id!==id&&o.payload&&o.status!=='confirmed'&&!expiredUnsettledRejection(o));
      if(other)reject('wallet_payment_unresolved','Another signed intent must be reconciled before a new payment can be signed.');
      if(!wallet.mnemonic||!buyer)reject('wallet_unavailable','Buyer test wallet is not configured.');
      store.event(id,'service_selected','The source-bound catalog request fits the approved one-batch service.','quoting');
      const response=await fetch(endpoint(id),{redirect:'error',signal:AbortSignal.timeout(20_000)});
      if(response.status!==402)reject('missing_challenge','Seller did not issue an x402 payment challenge.');
      const header=response.headers.get('PAYMENT-REQUIRED');if(!header)reject('missing_challenge','Seller omitted the x402 payment requirements.');
      const q=decodePaymentRequiredHeader(header);const requirement=validateQuote(q,r.mandate,seller,endpoint(id));
      r=requireIntent(id);r.quote=q;store.save(r);store.event(id,'quote_accepted','Pinned seller, resource, price, network, asset and confirmation policy match the delegation.','signing');
      const reference=toClientCardanoSigner({mnemonic:wallet.mnemonic,network:NETWORK,provider:wallet.provider});
      let actualFee:string|null=null;let txHash:string|null=null;
      const guarded:ClientCardanoSigner={getAddress:()=>reference.getAddress(),buildAndSignPaymentTransaction:async input=>{
        // Reduce the transaction lifetime to the remaining mandate, even when the quote outlives it.
        validateMandate(r.mandate,seller,endpoint(id));
        const remaining=Math.floor((Date.parse(r.mandate.expiresAt)-Date.now())/1000)-2;
        if(remaining<1)reject('mandate_expired','Delegation expired before signing.');
        const signed=await reference.buildAndSignPaymentTransaction({...input,maxTimeoutSeconds:Math.min(input.maxTimeoutSeconds,remaining)});
        const tx=inspectSignedTransaction(signed.transaction,signed.nonce,buyer,r.mandate,requirement.amount);actualFee=tx.fee.toString();txHash=tx.txHash;return signed;
      }};
      const client=new x402Client().setSpendControls({allowedAssets:[{network:NETWORK,asset:ASSET,maxAmountPerPayment:r.mandate.serviceCapLovelace}]}).register(NETWORK,new ClientScheme(guarded));
      const payload=await client.createPaymentPayload(q);
      r=requireIntent(id);r.payload=payload;r.transaction=txHash;r.networkFeeLovelace=actualFee;r.status='signed';r.reason=null;store.save(r);
      store.event(id,'signed_payment_persisted','Exact signed transaction, nonce and intent were durably checkpointed before network submission.');
      return paidRequest(id);
    }catch(error) {
      r=requireIntent(id);
      if(r.payload)return publicPaymentIntent(store.event(id,'receipt_unresolved','Existing signed intent retained; no replacement payment.','receipt_unresolved','Reconcile the existing payment.'));
      const policy=error instanceof PaymentPolicyError;const message=policy?error.message:'Payment cannot be built. Verify that the buyer has preprod test ADA and the chain provider is reachable.';
      return publicPaymentIntent(store.event(id,policy?error.code:'payment_prerequisite_blocked',message,policy?'rejected':'blocked',message));
    }
  }
  function exclusive<T>(action:()=>Promise<T>):Promise<T>{const result=busy.then(action,action);busy=result.catch(()=>null);return result;}
  return {
    readiness,prepare,sellerMiddleware,sellerHandler,
    execute:(id:string)=>exclusive(()=>run(id)),
    reconcile:(id:string)=>exclusive(async()=>{const r=requireIntent(id);if(!r.payload)return publicPaymentIntent(store.event(id,'reconcile_without_payment','No transaction was signed; no funds were charged.'));return run(id);}),
    publicIntent:(id:string)=>{const r=store.get(id);return r?publicPaymentIntent(r):null;},
    endpoint,sellerAddress:seller,buyerAddress:buyer,
    close:()=>store.close(),
  };
}
