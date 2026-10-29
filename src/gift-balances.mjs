import {address} from '@solana/kit';
import {fetchAllMaybeToken,TOKEN_PROGRAM_ADDRESS} from '@solana-program/token';
import {ata} from './token.mjs';
import {listGifts} from './gifts.mjs';
export async function giftBalances(rpc,mint){
 const gifts=listGifts().filter(g=>g.mint===mint);if(!gifts.length)return {total:0n,accounts:[]};
 const addresses=await Promise.all(gifts.map(g=>ata(mint,address(g.escrow))));
 const tokens=await fetchAllMaybeToken(rpc,addresses,{commitment:'confirmed'});
 const accounts=tokens.map((t,i)=>{const g=gifts[i];
  if(!t.exists){if(g.status!=='preparing')throw Error('Gift token account missing');return {id:g.id,owner:g.escrow,balance:0n};}
  if(t.programAddress!==TOKEN_PROGRAM_ADDRESS||t.data.mint!==mint||t.data.owner!==g.escrow)throw Error('Gift account invariant failed');
  return {id:g.id,owner:g.escrow,balance:t.data.amount};
 });
 return {total:accounts.reduce((n,a)=>n+a.balance,0n),accounts};
}
