import {mkdirSync,existsSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {Address,PrivateKey} from '@evolution-sdk/evolution';
import {addressFromSeed} from '@evolution-sdk/evolution/sdk/wallet/Derivation';
const file='.local/v2/cardano-wallets.json';mkdirSync('.local/v2',{recursive:true,mode:0o700});
let wallets:{network:string;buyer:{mnemonic:string;address:string};seller:{mnemonic:string;address:string}};
if(existsSync(file)){chmodSync(file,0o600);wallets=JSON.parse(readFileSync(file,'utf8'));}
else{const role=()=>{const mnemonic=PrivateKey.generateMnemonic();return {mnemonic,address:Address.toBech32(addressFromSeed(mnemonic,{networkId:0}).address)};};wallets={network:'cardano:preprod',buyer:role(),seller:role()};writeFileSync(file,JSON.stringify(wallets,null,2)+'\n',{mode:0o600,flag:'wx'});}
console.log(JSON.stringify({network:wallets.network,walletFile:file,buyerAddress:wallets.buyer.address,sellerAddress:wallets.seller.address,warning:'Isolated V2 roles. No keys printed, funding or payment performed.'},null,2));
