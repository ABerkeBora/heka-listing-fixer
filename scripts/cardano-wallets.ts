import { mkdirSync, existsSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { Address, PrivateKey } from '@evolution-sdk/evolution';
import { addressFromSeed } from '@evolution-sdk/evolution/sdk/wallet/Derivation';

const file = '.local/cardano-wallets.json';
mkdirSync('.local',{recursive:true,mode:0o700});
if (existsSync(file)) {
  chmodSync(file,0o600);
  const wallets = JSON.parse(readFileSync(file,'utf8'));
  console.log(JSON.stringify({created:false,network:'cardano:preprod',buyerAddress:wallets.buyer.address,sellerAddress:wallets.seller.address,walletFile:file},null,2));
} else {
  const role = () => {const mnemonic=PrivateKey.generateMnemonic();return {mnemonic,address:Address.toBech32(addressFromSeed(mnemonic,{networkId:0}).address)};};
  const wallets={network:'cardano:preprod',createdAt:new Date().toISOString(),buyer:role(),seller:role()};
  writeFileSync(file,JSON.stringify(wallets,null,2),{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({created:true,network:wallets.network,buyerAddress:wallets.buyer.address,sellerAddress:wallets.seller.address,walletFile:file},null,2));
}
console.log('Fund only the buyer with test ADA at https://docs.cardano.org/cardano-testnets/tools/faucet (Preprod). Keys remain in the ignored 0600 file.');
