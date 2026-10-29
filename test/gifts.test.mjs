import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {amounts,validId,validateGiftRequest,chooseAction} from '../src/gifts.mjs';
import {cardHead} from '../src/gift-cards.mjs';
const id='gift-11111111-1111-4111-8111-111111111111';
test('gift input cannot choose external recipient, arbitrary amount or filesystem path',()=>{
 for(const amount of amounts)validateGiftRequest({id,amount,action:'deposit'});
 for(const b of [{id,amount:'19',action:'deposit'},{id,amount:18,action:'deposit'},{id,amount:'18',action:'mint'},{id,amount:'18',action:'claim',recipient:'attacker'}])assert.throws(()=>validateGiftRequest(b));
 for(const bad of ['../payer','gift-../payer','payer',id+'.json'])assert.throws(()=>validId(bad));
});
test('unconfirmed deposits cannot be claimed; claim and refund are mutually exclusive',()=>{
 assert.throws(()=>chooseAction({status:'preparing',intent:null},'claim'));
 chooseAction({status:'funded',intent:null},'claim');
 for(const status of ['funded','claimed']){chooseAction({status,intent:'claim'},'claim');assert.throws(()=>chooseAction({status,intent:'claim'},'refund'));}
 assert.throws(()=>chooseAction({status:'refunded',intent:'refund'},'claim'));
});
test('four distinct PNG cards and server-rendered metadata match immutable amounts',()=>{
 const hashes=new Set();
 for(const amount of amounts){const bytes=fs.readFileSync(new URL(`../assets/cards/${amount}-v1.png`,import.meta.url));assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);hashes.add(createHash('sha256').update(bytes).digest('hex'));
 const h=cardHead(amount,'https://example.test','/gift/'+id);assert.ok(h.includes(`https://example.test/cards/${amount}-v1.png`));assert.ok(h.includes('summary_large_image'));assert.ok(h.includes('og:image'));}
 assert.equal(hashes.size,4);assert.throws(()=>cardHead('<script>','https://example.test','/'));
 assert.ok(!cardHead('18','https://example.test','/" onload="bad').includes('onload="bad'));
});
