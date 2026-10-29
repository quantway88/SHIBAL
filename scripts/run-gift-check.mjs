import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {address,createSolanaRpc} from '@solana/kit';
import {fetchToken} from '@solana-program/token';
import {ata,assertDevnet,units} from '../src/token.mjs';
import {save,read} from '../src/journal.mjs';
const base='http://127.0.0.1:8182',file='evidence/gift-test-run.json';
const run=fs.existsSync(file)?read(file):{cases:['180','1800','28'].map(amount=>({id:'gift-'+randomUUID(),amount,finish:amount==='1800'?'refund':'claim'})),results:[]};save(file,run);
const {token}=await (await fetch(base+'/api/session')).json();
const rpc=createSolanaRpc(process.env.DEVNET_RPC||'https://api.devnet.solana.com');await assertDevnet(rpc);
const d=read('evidence/deploy.json'),mint=address(d.mint);
async function call(c,action){
 for(let attempt=0;attempt<3;attempt++){
 await pause(attempt?20000:6000);
 const r=await fetch(base+'/api/gifts',{method:'POST',headers:{origin:base,'content-type':'application/json','x-shibal-token':token},body:JSON.stringify({id:c.id,amount:c.amount,action})});const data=await r.json();
 if(r.ok)return data;
 if(!data.error.includes('429')||attempt===2)throw Error(data.error);
 run.rpcErrors ||= [];run.rpcErrors.push({at:new Date().toISOString(),id:c.id,action,error:data.error});save(file,run);
 } }
async function balance(owner){return (await fetchToken(rpc,await ata(mint,address(owner)),{commitment:'confirmed'})).data.amount;}
for(const c of run.cases){
 if(run.results.some(x=>x.id===c.id))continue;
 const g=await call(c,'deposit');
 if(g.status==='funded')assert.equal(await balance(g.escrow),units(c.amount,6));
 const before=JSON.stringify(await (await fetch(base+'/api/gifts')).json());
 const html=await (await fetch(base+'/gift/'+c.id,{headers:{'user-agent':'Twitterbot/1.0'}})).text();assert.ok(html.includes(`/cards/${c.amount}-v1.png`));
 assert.equal(JSON.stringify(await (await fetch(base+'/api/gifts')).json()),before,'crawler GET must not change gift');
 const done=await call(c,c.finish),again=await call(c,c.finish);assert.equal(done.signatures[c.finish],again.signatures[c.finish]);assert.equal(await balance(g.escrow),0n);
 await assert.rejects(()=>call(c,c.finish==='claim'?'refund':'claim'),/committed/);
 const repeatedDeposit=await call(c,'deposit');assert.equal(repeatedDeposit.status,done.status);
 run.results=run.results.filter(x=>x.id!==c.id);run.results.push({...done,duplicateClaimOrRefund:'same signature',oppositeAction:'rejected',crawler:'no mutation',escrowBalance:'0'});save(file,run);console.log(c.amount+' '+done.status+' '+done.signatures[c.finish]);
}
const denied=await fetch(base+'/api/gifts',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'});assert.equal(denied.status,403);
run.finishedAt=new Date().toISOString();run.crossOrigin='403';save(file,run);console.log('Gift integration tests passed.');
