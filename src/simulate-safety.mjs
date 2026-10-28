import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {address,createSolanaRpc,createTransactionMessage,setTransactionMessageFeePayerSigner,setTransactionMessageLifetimeUsingBlockhash,appendTransactionMessageInstructions,signTransactionMessageWithSigners,getBase64EncodedWireTransaction} from '@solana/kit';
import {fetchMint,fetchToken,getMintToCheckedInstruction,getFreezeAccountInstruction,getTransferCheckedInstruction} from '@solana-program/token';
import {wallet} from './wallet.mjs';
import {assertDevnet,ata,units} from './token.mjs';
import {read,save,json} from './journal.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rpc=createSolanaRpc(process.env.DEVNET_RPC||'https://api.devnet.solana.com');
await assertDevnet(rpc);
const d=read(path.join(root,'evidence/deploy.json')),c=d.config;
const payer=await wallet('payer'),recipient=await wallet('recipient');
if(d.holder!==payer.address)throw Error('Test payer mismatch');
const mint=address(d.mint),a=await ata(mint,payer.address),b=await ata(mint,recipient.address);
const beforeMint=await fetchMint(rpc,mint),beforeA=await fetchToken(rpc,a),beforeB=await fetchToken(rpc,b);
if(beforeB.data.amount!==0n)throw Error('Recipient must be empty for insufficient-balance test');
const cases=[
 ['revoked-mint-authority',getMintToCheckedInstruction({mint,token:a,mintAuthority:payer,amount:units('18',c.decimals),decimals:c.decimals}),/total supply of this token is fixed/i],
 ['no-freeze-authority',getFreezeAccountInstruction({account:a,mint,owner:payer}),/cannot freeze accounts/i],
 ['insufficient-token-balance',getTransferCheckedInstruction({source:b,mint,destination:a,authority:recipient,amount:units('18',c.decimals),decimals:c.decimals}),/insufficient funds/i]
];
const results=[];
for(const [name,ix,expected] of cases){
 const life=(await rpc.getLatestBlockhash({commitment:'confirmed'}).send()).value;
 let msg=createTransactionMessage({version:0});msg=setTransactionMessageFeePayerSigner(payer,msg);msg=setTransactionMessageLifetimeUsingBlockhash(life,msg);msg=appendTransactionMessageInstructions([ix],msg);
 const tx=await signTransactionMessageWithSigners(msg);
 const {value}=await rpc.simulateTransaction(getBase64EncodedWireTransaction(tx),{encoding:'base64',sigVerify:true,commitment:'confirmed'}).send();
 const ok=Boolean(value.err)&&expected.test((value.logs||[]).join('\n'));
 results.push({name,passed:ok,error:value.err,logs:value.logs});
}
const afterMint=await fetchMint(rpc,mint),afterA=await fetchToken(rpc,a),afterB=await fetchToken(rpc,b);
const unchanged=beforeMint.data.supply===afterMint.data.supply&&beforeA.data.amount===afterA.data.amount&&beforeB.data.amount===afterB.data.amount;
const report={checkedAt:new Date().toISOString(),mode:'RPC simulation only; no transactions submitted',mint,results,balancesAndSupplyUnchanged:unchanged};
save(path.join(root,'evidence/negative-simulations.json'),report);console.log(json(report));
if(!unchanged||results.some(r=>!r.passed))process.exitCode=1;

