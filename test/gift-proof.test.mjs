import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSigner,createSignableMessage} from '@solana/kit';
import {claimText,hashCode,verifyProof,publicKeyBytes} from '../src/gift-proof.mjs';
test('receiver proof binds gift, amount, recipient and invitation; forged proof is rejected',async()=>{
 const s=await generateKeyPairSigner(),hash=await hashCode('ab'.repeat(32)),id='gift-11111111-1111-4111-8111-111111111111';const text=claimText(id,'18',s.address,hash);
 const [signatures]=await s.signMessages([createSignableMessage(text)]);const sig=Buffer.from(signatures[s.address]).toString('base64');
 assert.equal(await verifyProof(s.address,text,sig),true);assert.equal(await verifyProof(s.address,claimText(id,'180',s.address,hash),sig),false);assert.equal(await verifyProof(s.address,text,Buffer.alloc(64).toString('base64')),false);assert.equal(publicKeyBytes(s.address).length,32);
 assert.throws(()=>publicKeyBytes('../secret'));await assert.rejects(()=>hashCode('short'));
});
