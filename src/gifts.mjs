import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {address,createSolanaRpc} from '@solana/kit';
import {fetchMint,TOKEN_PROGRAM_ADDRESS} from '@solana-program/token';
import {wallet} from './wallet.mjs';
import {assertDevnet,buildSend,units,validateConfig} from './token.mjs';
import {read,save,submit,reconcile} from './journal.mjs';
export const amounts=['18','180','1800','28'];
export function validId(id){if(typeof id!=='string'||!/^gift-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))throw Error('Invalid gift ID');return id;}
export function validateGiftRequest(b){
 if(!b||Object.keys(b).some(k=>!['id','amount','action'].includes(k)))throw Error('Unexpected gift fields');
 validId(b.id);if(!amounts.includes(b.amount)||!['deposit','claim','refund'].includes(b.action))throw Error('Invalid gift request');return b;
}
export function chooseAction(g,action){
 if(action==='deposit')return;
 if(!['funded','claimed','refunded'].includes(g.status))throw Error('Deposit must be confirmed first');
 if(g.intent&&g.intent!==action)throw Error('Gift already committed to '+g.intent);
}
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const giftsDir=path.join(root,'evidence/gifts');
export function listGifts(){fs.mkdirSync(giftsDir,{recursive:true});return fs.readdirSync(giftsDir).filter(n=>/^gift-[0-9a-f-]{36}\.json$/.test(n)).map(n=>read(path.join(giftsDir,n))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
export async function giftAction(input){
 const b=validateGiftRequest(input);fs.mkdirSync(giftsDir,{recursive:true});
 // Cross-process exclusion. A crash leaves this lock for explicit operator inspection.
 const lock=path.join(giftsDir,'operation.lock');const fd=fs.openSync(lock,'wx');
 try{
 fs.writeFileSync(fd,String(process.pid));
 const rpc=createSolanaRpc(process.env.DEVNET_RPC||'https://api.devnet.solana.com');await assertDevnet(rpc);
 const d=read(path.join(root,'evidence/deploy.json')),c=read(path.join(root,'config.json'));validateConfig(c);
 const payer=await wallet('payer'),recipient=await wallet('recipient'),mint=address(d.mint);
 if(d.holder!==payer.address||JSON.stringify(d.config)!==JSON.stringify(c))throw Error('Deployment mismatch');
 const m=await fetchMint(rpc,mint,{commitment:'confirmed'});
 if(m.programAddress!==TOKEN_PROGRAM_ADDRESS||m.data.supply!==units(c.supply,c.decimals)||m.data.decimals!==c.decimals||m.data.mintAuthority.__option!=='None'||m.data.freezeAuthority.__option!=='None')throw Error('Mint invariant failed');
 const file=path.join(giftsDir,b.id+'.json');let g=fs.existsSync(file)?read(file):null;
 if(!g){
  if(b.action!=='deposit')throw Error('Unknown gift');
  const escrow=await wallet(b.id);
  g={id:b.id,amount:b.amount,mint,payer:payer.address,recipient:recipient.address,escrow:escrow.address,status:'preparing',intent:null,signatures:{},createdAt:new Date().toISOString(),mode:'local custodial devnet test'};
  save(file,g);
 }
 if(g.amount!==b.amount||g.mint!==mint||g.payer!==payer.address||g.recipient!==recipient.address)throw Error('Gift details mismatch');
 const pending=listGifts().find(x=>x.id!==g.id&&(x.status==='preparing'||(x.status==='funded'&&x.intent)));
 if(pending)throw Error('Resolve previous gift first: '+pending.id);
 chooseAction(g,b.action);
 const txfile=path.join(giftsDir,`${b.id}.${b.action}.tx.json`);
 let tx;
 if(fs.existsSync(txfile))tx=await reconcile(rpc,txfile);
 else{
  if(b.action==='deposit'&&g.status!=='preparing')throw Error('Missing deposit journal');
  const escrow=await wallet(b.id);if(escrow.address!==g.escrow)throw Error('Escrow mismatch');
  if(b.action!=='deposit'){g.intent=b.action;save(file,g);}
  const from=b.action==='deposit'?payer:escrow;
  const to=b.action==='deposit'?escrow.address:b.action==='claim'?recipient.address:payer.address;
  tx=await submit(rpc,txfile,payer,await buildSend(from,mint,to,g.amount,c.decimals,payer),{giftId:g.id,action:b.action,amount:g.amount,mint,from:from.address,to});
 }
 if(!['confirmed','finalized'].includes(tx.status))throw Error('Transaction pending; retry the same gift action');
 g.signatures[b.action]=tx.signature;
 // Re-reading a deposit never rolls a claimed/refunded gift back to funded.
 if(b.action==='deposit'&&g.status==='preparing')g.status='funded';
 if(b.action==='claim')g.status='claimed';if(b.action==='refund')g.status='refunded';
 save(file,g);return g;
 }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
