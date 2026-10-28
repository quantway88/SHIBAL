import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {address,createSolanaRpc} from '@solana/kit';
import {fetchMint,fetchToken,TOKEN_PROGRAM_ADDRESS} from '@solana-program/token';
import {fetchMetadata,findMetadataPda,getUpdateV1InstructionAsync} from '@metaplex-foundation/mpl-token-metadata-kit';
import {validateConfig,validateUri,assertDevnet,units,buildMint,buildSend,ata} from './token.mjs';
import {wallet} from './wallet.mjs';
import {submit,reconcile,json,read,save} from './journal.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const c=read(path.join(root,'config.json')); validateConfig(c);
const dir=path.join(root,'evidence'); fs.mkdirSync(dir,{recursive:true});
const deployFile=path.join(dir,'deploy.json');
const rpc=createSolanaRpc(process.env.DEVNET_RPC||'https://api.devnet.solana.com');
const command=process.argv[2]||'plan';
const log=x=>{const {wire,...publicResult}=x;console.log(json(publicResult));};
async function verify(mint,payer,recipient) {
 const m=await fetchMint(rpc,mint,{commitment:'confirmed'});
 const a=await fetchToken(rpc,await ata(mint,payer.address),{commitment:'confirmed'});
 const [md]=await findMetadataPda({mint});const meta=await fetchMetadata(rpc,md,{commitment:'confirmed'});
 let b=0n;
 const recipientAta=await ata(mint,recipient.address);
 if((await rpc.getAccountInfo(recipientAta,{encoding:'base64',commitment:'confirmed'}).send()).value) {
 const recipientToken=await fetchToken(rpc,recipientAta,{commitment:'confirmed'});
 if(recipientToken.programAddress!==TOKEN_PROGRAM_ADDRESS||recipientToken.data.mint!==mint||recipientToken.data.owner!==recipient.address) throw Error('Recipient account invariant failed');
 b=recipientToken.data.amount;
 }
 if(m.programAddress!==TOKEN_PROGRAM_ADDRESS||!m.data.isInitialized||m.data.supply!==units(c.supply,c.decimals)||m.data.decimals!==c.decimals||m.data.mintAuthority.__option!=='None'||m.data.freezeAuthority.__option!=='None') throw Error('Mint invariant failed');
 if(a.programAddress!==TOKEN_PROGRAM_ADDRESS||a.data.mint!==mint||a.data.owner!==payer.address||a.data.amount+b!==m.data.supply) throw Error('Balance invariant failed');
 if(meta.data.mint!==mint||meta.data.updateAuthority!==payer.address||!meta.data.isMutable||meta.data.name.replace(/\0/g,'')!==c.name||meta.data.symbol.replace(/\0/g,'')!==c.symbol) throw Error('Metadata invariant failed');
 const result={checkedAt:new Date().toISOString(),mint,totalSupply:m.data.supply,decimals:m.data.decimals,mintAuthority:null,freezeAuthority:null,payer:payer.address,payerBalance:a.data.amount,recipient:recipient.address,recipientBalance:b,metadata:meta.data,explorer:`https://explorer.solana.com/address/${mint}?cluster=devnet`};
 save(path.join(dir,'verification.json'),result);return result;
}
try {
 if(command==='plan') log({...c,status:fs.existsSync(deployFile)?read(deployFile).status:'NOT DEPLOYED',metadata:'mutable; URI empty until hosting selected'});
 else {
 await assertDevnet(rpc);
 const payer=await wallet('payer'),recipient=await wallet('recipient');
 if(command==='wallets') log({payer:payer.address,recipient:recipient.address});
 else if(command==='fund') {
 const balance=(await rpc.getBalance(payer.address,{commitment:'confirmed'}).send()).value;
 if(balance>=100000000n) log({payer:payer.address,balance,status:'sufficient'});
 else {
 const record={at:new Date().toISOString(),payer:payer.address,balance,requestedLamports:'1000000000'};
 try {record.signature=await rpc.requestAirdrop(payer.address,1000000000n,{commitment:'confirmed'}).send();record.status='requested';}
 catch(e) {record.status='failed';record.error=e.message;}
 fs.appendFileSync(path.join(dir,'faucet.jsonl'),JSON.stringify(record,(_,x)=>typeof x==='bigint'?x.toString():x)+'\n');log(record);if(record.status==='failed') process.exitCode=1;
 }
 } else if(command==='deploy') {
 if(fs.existsSync(deployFile)) {log(await reconcile(rpc,deployFile));}
 else {
 if((await rpc.getBalance(payer.address).send()).value<100000000n) throw Error('Insufficient free devnet SOL; run fund');
 const mint=await wallet('mint');
 const rent=await rpc.getMinimumBalanceForRentExemption(82n).send();
 const {instructions}=await buildMint(payer,mint,c,rent,process.env.METADATA_URI||'');
 log(await submit(rpc,deployFile,payer,instructions,{mint:mint.address,holder:payer.address,config:c}));
 }
 } else if(command==='recover') {
 const id=process.argv[3]||'deploy';if(!/^[a-z0-9-]+$/.test(id)) throw Error('Invalid operation ID');
 log(await reconcile(rpc,path.join(dir,id+'.json'),{broadcast:process.argv.includes('--rebroadcast')}));
 } else {
 if(!fs.existsSync(deployFile)) throw Error('No deployment journal');
 const d=await reconcile(rpc,deployFile);if(!['confirmed','finalized'].includes(d.status)) throw Error('Deployment unresolved; run recover');
 if(d.holder!==payer.address||JSON.stringify(d.config)!==JSON.stringify(c)) throw Error('Wallet/config differs from deployment; restore original configuration');
 const mint=address(d.mint);
 if(command==='verify') log(await verify(mint,payer,recipient));
 else if(command==='roundtrip') {
 for(const [id,from,to,expected] of [['send-18',payer,recipient.address,units('18',c.decimals)],['return-18',recipient,payer.address,0n]]) {
 const file=path.join(dir,id+'.json');
 const sent=await submit(rpc,file,payer,await buildSend(from,mint,to,'18',c.decimals,payer),{mint,from:from.address,to,amount:'18'});
 log(sent);if(!['confirmed','finalized'].includes(sent.status)) throw Error('Transfer unresolved; run recover '+id);
 const v=await verify(mint,payer,recipient);
 // A completed roundtrip can be rerun read-only without expecting the historical intermediate balance.
 if(id==='return-18'||!fs.existsSync(path.join(dir,'return-18.json'))) {if(v.recipientBalance!==expected) throw Error('Roundtrip balance mismatch');}
 save(path.join(dir,id+'-verification.json'),v);
 }
 } else if(command==='send') {
 const to=address(process.argv[3]); const amount=process.argv[4]||'18'; const id=process.argv[5];
 if(!id||!/^send-custom-[a-z0-9-]+$/.test(id)) throw Error('Provide unique operation ID: send-custom-NAME');
 const state=await fetchMint(rpc,mint);if(state.data.decimals!==c.decimals) throw Error('Decimals mismatch');
 log(await submit(rpc,path.join(dir,id+'.json'),payer,await buildSend(payer,mint,to,amount,c.decimals),{mint,to,amount}));
 } else if(command==='metadata') {
 const uri=validateUri(process.argv[3]);if(!uri) throw Error('Non-empty URI required');
 const id=process.argv[4];if(!id||!/^metadata-[a-z0-9-]+$/.test(id)) throw Error('Provide operation ID metadata-NAME');
 const [md]=await findMetadataPda({mint});const current=await fetchMetadata(rpc,md);
 const ix=await getUpdateV1InstructionAsync({mint,authority:payer,payer,data:{name:current.data.name,symbol:current.data.symbol,uri,sellerFeeBasisPoints:current.data.sellerFeeBasisPoints,creators:current.data.creators}});
 const result=await submit(rpc,path.join(dir,id+'.json'),payer,[ix],{mint,uri});log(result);
 if(!['confirmed','finalized'].includes(result.status)) throw Error('Metadata update unresolved; run recover '+id);
 const verified=await verify(mint,payer,recipient);if(verified.metadata.uri.replace(/\0/g,'')!==uri) throw Error('Metadata URI verification failed');log(verified);
 } else throw Error('Commands: plan wallets fund deploy recover verify roundtrip send metadata');
 }
 }
} catch(e) {console.error(e.message);process.exitCode=1;}
