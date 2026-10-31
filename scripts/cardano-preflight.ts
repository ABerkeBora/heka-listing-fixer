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
const blockers:string[]=[];
if(!wallet.mnemonic||!wallet.buyerAddress)blockers.push('Buyer wallet not generated.');
if(!wallet.sellerAddress)blockers.push('Seller address not configured.');
if(wallet.buyerAddress&&wallet.buyerAddress===wallet.sellerAddress)blockers.push('Buyer and seller must be distinct.');
if(providerError)blockers.push(providerError);
else if(BigInt(balanceLovelace??'0')<5_000_000n)blockers.push('Buyer requires at least 5 preprod test ADA for service, bounded fee and change.');
if(facilitatorError)blockers.push('Hosted preprod facilitator is unavailable.');
const evidence={checkedAt:startedAt,network:NETWORK,sdkVersion,officialStarter:'https://developers.cardano.org/templates/x402-express/',
 provider:wallet.providerName,providerUrl:wallet.provider.koios?.baseUrl??wallet.provider.blockfrost?.baseUrl,
 facilitator:{url:supportedUrl,supported,error:facilitatorError},buyerAddress:wallet.buyerAddress??null,sellerAddress:wallet.sellerAddress??null,
 buyerBalanceLovelace:balanceLovelace,providerError,servicePriceLovelace:SERVICE_PRICE,
 paymentPrerequisites:{status:blockers.length?'BLOCKED':'PASS',ready:blockers.length===0,blockers},
 qualifyingPaidRequest:{status:'PENDING',assessed:false,reason:'This read-only setup check does not submit or verify a completed paid request. It never overwrites payment-live.json; inspect that actual transaction/receipt/result evidence separately.'},
 fundingPaths:[{url:'https://docs.cardano.org/cardano-testnets/tools/faucet',state:'Prior browser inspection required human reCAPTCHA; not solved or bypassed. This command does not repeat that UI inspection.'},{url:'https://dispenser.masumi.network/',state:'Prior inspection required a registration verification code; none was available. This command does not inspect email or repeat that UI inspection.'}],
 warning:'Wallet generation, public provider access and /supported are setup evidence, not a paid Cardano request.'};
mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/payment-preflight.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
