import {address} from '@solana/kit';
import {fetchAllMaybeToken,TOKEN_PROGRAM_ADDRESS} from '@solana-program/token';
import {ata} from './token.mjs';
import {listGifts} from './gifts.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function giftBalances(rpc,mint,excludedOwners=[]){
 const publicDir=path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))),'evidence/public-gifts');
 const publicGifts=fs.existsSync(publicDir)?fs.readdirSync(publicDir).filter(n=>/^gift-[0-9a-f-]{36}\.gift\.json$/.test(n)).map(n=>{const g=JSON.parse(fs.readFileSync(path.join(publicDir,n),'utf8'));return {...g,status:g.deposit?'funded':'preparing'};}):[];
 const gifts=[...listGifts().filter(g=>g.mint===mint),...publicGifts];
 const seen=new Set([...excludedOwners,...gifts.map(g=>g.escrow)]);
 for(const g of publicGifts)if(g.recipient&&!seen.has(g.recipient)){seen.add(g.recipient);gifts.push({id:'recipient:'+g.recipient,escrow:g.recipient,status:'preparing'});}
 if(!gifts.length)return {total:0n,accounts:[]};
 const addresses=await Promise.all(gifts.map(g=>ata(mint,address(g.escrow))));
 const tokens=await fetchAllMaybeToken(rpc,addresses,{commitment:'confirmed'});
 const accounts=tokens.map((t,i)=>{const g=gifts[i];
  if(!t.exists){if(g.status!=='preparing')throw Error('Gift token account missing');return {id:g.id,owner:g.escrow,balance:0n};}
  if(t.programAddress!==TOKEN_PROGRAM_ADDRESS||t.data.mint!==mint||t.data.owner!==g.escrow)throw Error('Gift account invariant failed');
  return {id:g.id,owner:g.escrow,balance:t.data.amount};
 });
 return {total:accounts.reduce((n,a)=>n+a.balance,0n),accounts};
}
