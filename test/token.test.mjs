import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSigner,createTransactionMessage,setTransactionMessageFeePayerSigner,setTransactionMessageLifetimeUsingBlockhash,appendTransactionMessageInstructions,signTransactionMessageWithSigners,getBase64EncodedWireTransaction} from '@solana/kit';
import {parseInitializeMint2Instruction,parseMintToCheckedInstruction,parseSetAuthorityInstruction,parseTransferCheckedInstruction,TOKEN_PROGRAM_ADDRESS} from '@solana-program/token';
import {parseCreateV1Instruction,TokenStandard} from '@metaplex-foundation/mpl-token-metadata-kit';
import {units,buildMint,buildSend,assertDevnet,DEVNET_GENESIS,validateConfig,validateUri,ata} from '../src/token.mjs';
import {submit,reconcile,read} from '../src/journal.mjs';
const payer=await generateKeyPairSigner(),mint=await generateKeyPairSigner(),recipient=await generateKeyPairSigner();
const c={network:'devnet',name:'SHIBAL',symbol:'SHIBAL',supply:'1800000000',decimals:6,reactionAmount:'18'};
const response=v=>({send:async()=>v});
test('exact decimals and u64 boundaries',()=>{
 assert.equal(units(c.supply,6),1800000000000000n);assert.equal(units('18',6),18000000n);
 assert.equal(units('0.000001',6),1n);assert.equal(units('18446744073709551615',0),18446744073709551615n);
 for(const s of ['0','-18','1e9','01','1.',' 18','0.0000001','18446744073709551616',18,null]) assert.throws(()=>units(s,6));
 for(const d of [-1,10,1.5,NaN]) assert.throws(()=>units('18',d));
});
test('reject invalid network, metadata length and URI',()=>{
 validateConfig(c);validateUri('');validateUri('https://example.org/metadata.json');
 assert.throws(()=>validateConfig({...c,network:'mainnet'}));assert.throws(()=>validateConfig({...c,name:'가'.repeat(11)}));
 assert.throws(()=>validateUri('javascript:alert(1)'));assert.throws(()=>validateUri('https://example.org/'+ 'a'.repeat(200)));
});
test('full genesis only; reject mainnet, testnet, truncated hash and RPC failure',async()=>{
 await assertDevnet({getGenesisHash:()=>response(DEVNET_GENESIS)});
 for(const h of ['5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d','4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY','EtWTRABZaYq6iMfeYKouRu166VU2xqa1']) await assert.rejects(assertDevnet({getGenesisHash:()=>response(h)}));
 await assert.rejects(assertDevnet({getGenesisHash:()=>({send:async()=>{throw Error('RPC down');}})}));
});
test('metadata precedes issuance and atomic revocation; no freeze authority',async()=>{
 const {instructions:i}=await buildMint(payer,mint,c,1461600n);
 assert.equal(i.length,6);assert.equal(i[1].programAddress,TOKEN_PROGRAM_ADDRESS);
 const init=parseInitializeMint2Instruction(i[1]);assert.equal(init.data.freezeAuthority.__option,'None');assert.equal(init.data.decimals,6);
 const md=parseCreateV1Instruction(i[2]);assert.equal(md.data.name,'SHIBAL');assert.equal(md.data.symbol,'SHIBAL');assert.equal(md.data.isMutable,true);assert.equal(md.data.tokenStandard,TokenStandard.Fungible);assert.equal(md.accounts.updateAuthority.address,payer.address);
 assert.equal(parseMintToCheckedInstruction(i[4]).data.amount,1800000000000000n);
 const revoke=parseSetAuthorityInstruction(i[5]);assert.equal(revoke.data.newAuthority.__option,'None');assert.equal(revoke.data.authorityType,0);
 let msg=createTransactionMessage({version:0});msg=setTransactionMessageFeePayerSigner(payer,msg);msg=setTransactionMessageLifetimeUsingBlockhash({blockhash:'11111111111111111111111111111111',lastValidBlockHeight:100n},msg);msg=appendTransactionMessageInstructions(i,msg);
 const signed=await signTransactionMessageWithSigners(msg);assert.ok(Buffer.from(getBase64EncodedWireTransaction(signed),'base64').length<=1232);
});
test('18 transfer checks exact mint, recipient ATA, signer and decimals',async()=>{
 const i=await buildSend(payer,mint.address,recipient.address,'18',6);
 const t=parseTransferCheckedInstruction(i[1]);assert.equal(t.data.amount,18000000n);assert.equal(t.data.decimals,6);assert.equal(t.accounts.destination.address,await ata(mint.address,recipient.address));assert.equal(t.accounts.authority.address,payer.address);
 await assert.rejects(buildSend(payer,mint.address,payer.address,'18',6));
 const back=parseTransferCheckedInstruction((await buildSend(recipient,mint.address,payer.address,'18',6,payer))[1]);assert.equal(back.accounts.authority.address,recipient.address);
});
test('persist signature before uncertain submission; rerun never builds a second mint',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shibal-test-'));const file=path.join(dir,'deploy.json');let sends=0,blocks=0;
 const rpc={getGenesisHash:()=>response(DEVNET_GENESIS),getLatestBlockhash:()=>{blocks++;return response({value:{blockhash:'11111111111111111111111111111111',lastValidBlockHeight:100n}});},getSignatureStatuses:()=>response({value:[null]}),getBlockHeight:()=>response(1n),sendTransaction:()=>({send:async()=>{sends++;assert.ok(read(file).signature);throw Error('timeout');}})};
 const {instructions}=await buildMint(payer,mint,c,1461600n);
 await assert.rejects(submit(rpc,file,payer,instructions,{mint:mint.address}),/timeout/);
 const signature=read(file).signature;await submit(rpc,file,payer,instructions);assert.equal(blocks,1);assert.equal(sends,1);assert.equal(read(file).signature,signature);
 rpc.getSignatureStatuses=()=>response({value:[{confirmationStatus:'confirmed',err:null}]});assert.equal((await reconcile(rpc,file)).status,'confirmed');
 fs.rmSync(dir,{recursive:true});
});
test('expired or failed transactions cannot silently retry',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shibal-test-'));const file=path.join(dir,'tx.json');
 fs.writeFileSync(file,JSON.stringify({network:'devnet',signature:'test',wire:'test',lastValidBlockHeight:'1'}));
 const rpc={getGenesisHash:()=>response(DEVNET_GENESIS),getSignatureStatuses:()=>response({value:[null]}),getBlockHeight:()=>response(2n)};
 await assert.rejects(reconcile(rpc,file,{broadcast:true}),/Expired/);assert.equal(read(file).status,'expired-unresolved');
 rpc.getSignatureStatuses=()=>response({value:[{err:{InstructionError:[0,'Custom']}}]});await assert.rejects(reconcile(rpc,file),/failed/);
 fs.rmSync(dir,{recursive:true});
});

test('same operation ID rejects a changed recipient or amount',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shibal-test-'));const file=path.join(dir,'send.json');
 fs.writeFileSync(file,JSON.stringify({network:'devnet',to:recipient.address,amount:'18'}));
 const rpc={getGenesisHash:()=>response(DEVNET_GENESIS)};
 await assert.rejects(submit(rpc,file,payer,[],{to:recipient.address,amount:'19'}),/different transaction details/);
 fs.rmSync(dir,{recursive:true});
});

test('metadata URI update preserves mutable authority and existing metadata fields',async()=>{
 const {getUpdateV1InstructionAsync,parseUpdateV1Instruction}=await import('@metaplex-foundation/mpl-token-metadata-kit');
 const ix=await getUpdateV1InstructionAsync({mint:mint.address,authority:payer,payer,data:{name:c.name,symbol:c.symbol,uri:'https://example.org/metadata.json',sellerFeeBasisPoints:0,creators:null}});
 const parsed=parseUpdateV1Instruction(ix);
 assert.equal(parsed.accounts.authority.address,payer.address);
 assert.equal(parsed.data.data.value.uri,'https://example.org/metadata.json');
 assert.equal(parsed.data.newUpdateAuthority.__option,'None');
 assert.equal(parsed.data.isMutable.__option,'None');
});
