import 'dotenv/config';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {loadWalletConfig,readBuyerBalance} from '../server/payment/wallets.js';
import {NETWORK,SERVICE_PRICE} from '../server/payment/policy.js';

const wallet=loadWalletConfig();
const supportedUrl='https://x402.preprod.dev.ecosyseng.cf-deployments.org/supported';
const startedAt=new Date().toISOString();
const sdkVersion=JSON.parse(readFileSync('node_modules/@x402/cardano/package.json','utf8')).version as string;
let supported:unknown=null;let facilitatorError:string|null=null;
try{const response=await fetch(supportedUrl,{signal:AbortSignal.timeout(15_000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);supported=await response.json();}catch(e){facilitatorError=e instanceof Error?e.message:'Network error';}
let balanceLovelace:string|null=null;let providerError:string|null=null;
try{balanceLovelace=await readBuyerBalance(wallet);}catch{providerError='Public preprod provider balance lookup failed.';}
const evidence={checkedAt:startedAt,network:NETWORK,sdkVersion,officialStarter:'https://developers.cardano.org/templates/x402-express/',
 provider:wallet.providerName,providerUrl:wallet.provider.koios?.baseUrl??wallet.provider.blockfrost?.baseUrl,
 facilitator:{url:supportedUrl,supported,error:facilitatorError},buyerAddress:wallet.buyerAddress??null,sellerAddress:wallet.sellerAddress??null,
 buyerBalanceLovelace:balanceLovelace,providerError,servicePriceLovelace:SERVICE_PRICE,
 qualifyingPaidRequest:{status:'BLOCKED',transaction:null,receipt:null,result:null,reason:!wallet.mnemonic?'Buyer wallet not generated.':BigInt(balanceLovelace??'0')<5_000_000n?'Buyer requires preprod test ADA; official faucet requires a human reCAPTCHA.':'Not attempted by this read-only preflight.'},
 fundingPaths:[{url:'https://docs.cardano.org/cardano-testnets/tools/faucet',state:'Browser verified: reCAPTCHA required; not solved or bypassed.'},{url:'https://dispenser.masumi.network/',state:'Requires verification code from registration email; no code available.'}],
 warning:'Wallet generation, public provider access and /supported are setup evidence, not a paid Cardano request.'};
mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/payment-preflight.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
