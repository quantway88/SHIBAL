import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {randomBytes,randomUUID} from 'node:crypto';import {setTimeout as pause} from 'node:timers/promises';
import {address,createSolanaRpc,createSignableMessage} from '@solana/kit';
import {fetchMint,TOKEN_PROGRAM_ADDRESS} from '@solana-program/token';
import {wallet,walletDir} from './wallet.mjs';import {read,save,submit} from './journal.mjs';import {assertDevnet,buildSend,units} from './token.mjs';
import {ORIGIN,PUBLISHER,MINT,AMOUNTS,hashCode,claimText,verifyProof,validGiftId} from './gift-proof.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dir=path.join(root,'evidence/public-gifts');fs.mkdirSync(dir,{recursive:true});
export async function signText(signer,text){const [s]=await signer.signMessages([createSignableMessage(text)]);return Buffer.from(s[signer.address]).toString('base64');}
async function admin(signer,action,data={}){const text=JSON.stringify({domain:ORIGIN,at:Date.now(),nonce:randomUUID(),action,data});const signature=await signText(signer,text);const r=await fetch(ORIGIN+'/api/gifts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({admin:{text,signature}})});if(!r.ok)throw Error('Hosted API '+r.status+': '+(await r.text()).slice(0,300));return r.json();}
async function context(){const rpc=createSolanaRpc(process.env.DEVNET_RPC||'https://api.devnet.solana.com');await assertDevnet(rpc);const payer=await wallet('payer');if(payer.address!==PUBLISHER)throw Error('Publisher mismatch');const m=await fetchMint(rpc,address(MINT));if(m.programAddress!==TOKEN_PROGRAM_ADDRESS||m.data.supply!==units('1800000000',6)||m.data.decimals!==6||m.data.mintAuthority.__option!=='None'||m.data.freezeAuthority.__option!=='None')throw Error('Mint mismatch');return {rpc,payer};}
export async function createPublicGift(amount,label){
 const lock=path.join(dir,'create.lock'),fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));
 try{return await createGift(amount,label);}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
async function createGift(amount,label){
 if(!AMOUNTS.includes(amount)||! /^[a-z0-9-]{1,40}$/.test(label))throw Error('Expected allowed amount and stable label');
 const {rpc,payer}=await context();const invitations=path.join(walletDir,'invitations.json');
 const map=fs.existsSync(invitations)?read(invitations):{};
 if(!map[label]){map[label]={id:'gift-'+randomUUID(),code:randomBytes(32).toString('hex')};save(invitations,map);}
 const {id,code}=map[label],file=path.join(dir,id+'.gift.json');const escrow=await wallet(id);
 let g=fs.existsSync(file)?read(file):{id,amount,hash:await hashCode(code),escrow:escrow.address,expiresAt:Date.now()+48*3600000};
 if(g.amount!==amount||g.escrow!==escrow.address)throw Error('Existing label mismatch');save(file,g);
 const tx=await submit(rpc,path.join(dir,id+'.deposit.json'),payer,await buildSend(payer,address(MINT),escrow.address,amount,6),{id,amount,mint:MINT,to:escrow.address});
 if(!['confirmed','finalized'].includes(tx.status))throw Error('Deposit pending');g.deposit=tx.signature;save(file,g);
 await admin(payer,'register',g);return {id,amount,url:ORIGIN+'/gift/'+id+'#code='+code};
}
export async function relayOnce(){
 const {rpc,payer}=await context();const queue=await admin(payer,'queue');
 for(const q of queue){
  if(!validGiftId(q.id))continue;const file=path.join(dir,q.id+'.gift.json');if(!fs.existsSync(file))continue;
  const g=read(file);if(g.amount!==q.amount||g.hash!==q.hash||g.escrow!==q.escrow||g.deposit!==q.deposit)throw Error('Queue differs from local funded gift');
  if(!await verifyProof(q.recipient,claimText(g.id,g.amount,q.recipient,g.hash),q.proof))throw Error('Invalid receiver proof');
  if(g.recipient&&g.recipient!==q.recipient)throw Error('Recipient already bound');g.recipient=q.recipient;save(file,g);
  const escrow=await wallet(g.id);if(escrow.address!==g.escrow)throw Error('Escrow key mismatch');
  const tx=await submit(rpc,path.join(dir,g.id+'.claim.json'),payer,await buildSend(escrow,address(MINT),address(q.recipient),g.amount,6,payer),{id:g.id,amount:g.amount,mint:MINT,to:q.recipient});
  if(!['confirmed','finalized'].includes(tx.status))throw Error('Claim pending');g.signature=tx.signature;save(file,g);
  await admin(payer,'settle',{id:g.id,recipient:q.recipient,signature:tx.signature});console.log(JSON.stringify({id:g.id,status:'claimed',signature:tx.signature}));
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv[2];
 if(mode==='create'){const g=await createPublicGift(process.argv[3],process.argv[4]);const out=path.join(walletDir,process.argv[4]+'-link.txt');fs.writeFileSync(out,g.url,{mode:0o600});console.log(JSON.stringify({id:g.id,amount:g.amount,linkFile:out}));}
 else if(mode==='relay'||mode==='once'){
  const lock=path.join(dir,'relay.lock'),fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));
  const cleanup=()=>{try{fs.closeSync(fd);fs.unlinkSync(lock);}catch{}};process.on('SIGINT',()=>{cleanup();process.exit(0)});process.on('SIGTERM',()=>{cleanup();process.exit(0)});
  try{do{try{await relayOnce();}catch(e){fs.appendFileSync(path.join(dir,'relay-errors.jsonl'),JSON.stringify({at:new Date().toISOString(),error:e.message})+'\n');console.error(e.message);if(mode==='once')throw e;}if(mode==='relay')await pause(15000);}while(mode==='relay');}finally{cleanup();}
 }else throw Error('Use create AMOUNT LABEL | once | relay');
}
