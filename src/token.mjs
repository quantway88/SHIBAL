import {getCreateAccountInstruction} from '@solana-program/system';
import {TOKEN_PROGRAM_ADDRESS,findAssociatedTokenPda,getInitializeMint2Instruction,getCreateAssociatedTokenIdempotentInstructionAsync,getMintToCheckedInstruction,getSetAuthorityInstruction,getTransferCheckedInstruction} from '@solana-program/token';
import {getCreateV1InstructionAsync,TokenStandard} from '@metaplex-foundation/mpl-token-metadata-kit';
export const DEVNET_GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export function units(text,decimals) {
 if(!Number.isInteger(decimals)||decimals<0||decimals>9) throw Error('Invalid decimals');
 if(typeof text!=='string'||!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text)) throw Error('Invalid amount');
 const [whole,fraction='']=text.split('.');
 if(fraction.length>decimals) throw Error('Too many decimal places');
 const value=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 if(value<=0n||value>18446744073709551615n) throw Error('Amount outside u64');
 return value;
}
export function validateConfig(c) {
 if(c.network!=='devnet') throw Error('Only devnet config permitted');
 units(c.supply,c.decimals); units(c.reactionAmount,c.decimals);
 if(typeof c.name!=='string'||!c.name||Buffer.byteLength(c.name)>32) throw Error('Invalid name');
 if(typeof c.symbol!=='string'||!c.symbol||Buffer.byteLength(c.symbol)>10) throw Error('Invalid symbol');
}
export function validateUri(uri) {
 if(typeof uri!=='string'||Buffer.byteLength(uri)>200) throw Error('Invalid metadata URI');
 if(uri!=='' && !['https:','http:','ipfs:','ar:'].includes(new URL(uri).protocol)) throw Error('Invalid metadata URI protocol');
 return uri;
}
export async function assertDevnet(rpc) {
 if(await rpc.getGenesisHash().send()!==DEVNET_GENESIS) throw Error('Only Solana devnet is supported');
}
export async function ata(mint,owner) { return (await findAssociatedTokenPda({mint,owner,tokenProgram:TOKEN_PROGRAM_ADDRESS}))[0]; }
export async function buildMint(payer,mint,c,rent,uri='') {
 validateConfig(c); validateUri(uri);
 const account=await ata(mint.address,payer.address);
 const instructions=[
 getCreateAccountInstruction({payer,newAccount:mint,lamports:rent,space:82n,programAddress:TOKEN_PROGRAM_ADDRESS}),
 getInitializeMint2Instruction({mint:mint.address,decimals:c.decimals,mintAuthority:payer.address,freezeAuthority:null}),
 await getCreateV1InstructionAsync({mint:mint.address,authority:payer,payer,updateAuthority:payer,name:c.name,symbol:c.symbol,uri,sellerFeeBasisPoints:0,isMutable:true,tokenStandard:TokenStandard.Fungible,decimals:c.decimals,splTokenProgram:TOKEN_PROGRAM_ADDRESS}),
 await getCreateAssociatedTokenIdempotentInstructionAsync({payer,owner:payer.address,mint:mint.address}),
 getMintToCheckedInstruction({mint:mint.address,token:account,mintAuthority:payer,amount:units(c.supply,c.decimals),decimals:c.decimals}),
 getSetAuthorityInstruction({owned:mint.address,owner:payer,authorityType:0,newAuthority:null})];
 return {instructions,account};
}
export async function buildSend(payer,mint,recipient,amount,decimals,feePayer=payer) {
 if(payer.address===recipient) throw Error('Recipient must be different');
 return [await getCreateAssociatedTokenIdempotentInstructionAsync({payer:feePayer,owner:recipient,mint}),getTransferCheckedInstruction({source:await ata(mint,payer.address),mint,destination:await ata(mint,recipient),authority:payer,amount:units(amount,decimals),decimals})];
}

