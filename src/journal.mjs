import fs from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {createTransactionMessage,setTransactionMessageFeePayerSigner,setTransactionMessageLifetimeUsingBlockhash,appendTransactionMessageInstructions,signTransactionMessageWithSigners,getSignatureFromTransaction,getBase64EncodedWireTransaction} from '@solana/kit';
import {assertDevnet} from './token.mjs';
export const json=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2);
export function save(file,value) { fs.writeFileSync(file+'.tmp',json(value)); fs.renameSync(file+'.tmp',file); }
export function read(file) { return JSON.parse(fs.readFileSync(file,'utf8')); }
export async function reconcile(rpc,file,{broadcast=false}={}) {
 await assertDevnet(rpc);
 const r=read(file);
 if(r.network!=='devnet'||!r.signature||!r.wire) throw Error('Invalid journal');
 const status=(await rpc.getSignatureStatuses([r.signature],{searchTransactionHistory:true}).send()).value[0];
 if(status?.err) {r.status='failed';r.error=status.err;save(file,r);throw Error('Transaction failed; inspect journal');}
 if(['confirmed','finalized'].includes(status?.confirmationStatus)) {r.status=status.confirmationStatus;save(file,r);return r;}
 if(await rpc.getBlockHeight({commitment:'confirmed'}).send()>BigInt(r.lastValidBlockHeight)) {
 r.status='expired-unresolved';save(file,r);throw Error('Expired; no new transaction issued. Inspect chain and journal.');
 }
 if(broadcast) {
 try {await rpc.sendTransaction(r.wire,{encoding:'base64',skipPreflight:false,maxRetries:2n,preflightCommitment:'confirmed'}).send();}
 catch(e) {r.lastError=e.message;save(file,r);throw e;}
 }
 return r;
}
export async function submit(rpc,file,payer,instructions,details={}) {
 await assertDevnet(rpc);
 if(fs.existsSync(file)) {
 const prior=read(file);
 for(const [key,value] of Object.entries(details)) {
 if(json(prior[key])!==json(value)) throw Error('Operation ID already belongs to different transaction details');
 }
 return reconcile(rpc,file); // Never create a replacement signature implicitly.
 }
 const lifetime=(await rpc.getLatestBlockhash({commitment:'confirmed'}).send()).value;
 let msg=createTransactionMessage({version:0});
 msg=setTransactionMessageFeePayerSigner(payer,msg);
 msg=setTransactionMessageLifetimeUsingBlockhash(lifetime,msg);
 msg=appendTransactionMessageInstructions(instructions,msg);
 const tx=await signTransactionMessageWithSigners(msg);
 const wire=getBase64EncodedWireTransaction(tx);
 if(Buffer.from(wire,'base64').length>1232) throw Error('Transaction exceeds packet size');
 const r={...details,network:'devnet',signature:getSignatureFromTransaction(tx),wire,...lifetime,status:'prepared',createdAt:new Date().toISOString()};
 // Persist signed public transaction BEFORE any simulation/submission. Contains no private key.
 fs.writeFileSync(file,json(r),{flag:'wx'});
 await reconcile(rpc,file,{broadcast:true});
 for(let i=0;i<20;i++) {const result=await reconcile(rpc,file);if(['confirmed','finalized'].includes(result.status)) return result;await sleep(1500);}
 throw Error('Confirmation timeout; use recover, never delete journal or redeploy');
}
