import { readFileSync, existsSync, statSync } from 'node:fs';
import { Address, Client, preprod } from '@evolution-sdk/evolution';
import { toClientCardanoSigner, type CardanoProviderConfig } from '@x402/cardano';
import { NETWORK } from './policy.js';
export const DEFAULT_WALLET_FILE = '.local/cardano-wallets.json';
export interface WalletConfig { mnemonic?: string; buyerAddress?: string; sellerAddress?: string; provider: CardanoProviderConfig; providerName: 'koios'|'blockfrost'; }
export function loadWalletConfig(file = process.env.CARDANO_WALLET_FILE ?? DEFAULT_WALLET_FILE,options:{fileOnly?:boolean}={}): WalletConfig {
  let local: {buyer?:{mnemonic?:string;address?:string}; seller?:{address?:string}} = {};
  if (existsSync(file)) {
    if ((statSync(file).mode & 0o077) !== 0) throw new Error('Cardano wallet file must have mode 0600.');
    local = JSON.parse(readFileSync(file, 'utf8'));
  }
  const mnemonic = options.fileOnly?local.buyer?.mnemonic:process.env.CARDANO_BUYER_MNEMONIC ?? local.buyer?.mnemonic;
  const providerName = process.env.BLOCKFROST_PROJECT_ID ? 'blockfrost' : 'koios';
  const provider: CardanoProviderConfig = providerName === 'blockfrost'
    ? {blockfrost:{baseUrl:'https://cardano-preprod.blockfrost.io/api/v0',projectId:process.env.BLOCKFROST_PROJECT_ID!},requestTimeoutMs:20_000}
    : {koios:{baseUrl:'https://preprod.koios.rest/api/v1'},requestTimeoutMs:20_000};
  const buyerAddress = mnemonic ? toClientCardanoSigner({mnemonic,network:NETWORK,provider}).getAddress() : undefined;
  return {mnemonic,buyerAddress,sellerAddress:options.fileOnly?local.seller?.address:process.env.SELLER_ADDRESS ?? local.seller?.address,provider,providerName};
}
export async function readBuyerBalance(c: WalletConfig): Promise<string|null> {
  if (!c.buyerAddress) return null;
  const chain = Client.make(preprod);
  const client = c.provider.blockfrost ? chain.withBlockfrost(c.provider.blockfrost) : chain.withKoios(c.provider.koios);
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const rows = await Promise.race([client.getUtxos(Address.fromBech32(c.buyerAddress)), new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Balance lookup timed out.')),12_000);})]);
    return rows.reduce((sum,row)=>sum+row.assets.lovelace,0n).toString();
  } finally {if(timer)clearTimeout(timer);}
}
