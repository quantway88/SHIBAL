import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {address,createSolanaRpc} from '@solana/kit';
import {fetchMint,fetchAllToken,TOKEN_PROGRAM_ADDRESS} from '@solana-program/token';
import {fetchMetadata,findMetadataPda} from '@metaplex-foundation/mpl-token-metadata-kit';
import {wallet} from './wallet.mjs';
import {giftBalances} from './gift-balances.mjs';
import {assertDevnet,validateConfig,units,ata,buildSend} from './token.mjs';
import {read,save,json,submit,reconcile} from './journal.mjs';
import {authorize,validateTransfer} from './web-guard.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dir=path.join(root,'evidence');
const c=read(path.join(root,'config.json'));validateConfig(c);
const d=read(path.join(dir,'deploy.json')),mint=address(d.mint);
const rpc=createSolanaRpc(process.env.DEVNET_RPC||'https://api.devnet.solana.com');
await assertDevnet(rpc);
const payer=await wallet('payer'),recipient=await wallet('recipient');
if(d.holder!==payer.address||JSON.stringify(c)!==JSON.stringify(d.config))throw Error('Deployment wallet/config mismatch');
const a=await ata(mint,payer.address),b=await ata(mint,recipient.address),[md]=await findMetadataPda({mint});
const host='127.0.0.1:8181',token=randomBytes(32).toString('hex');let busy=false,cached=null,cacheTime=0;
const history=()=>fs.readdirSync(dir).filter(n=>/^ui-[0-9a-f-]{36}\.json$/.test(n)).map(n=>{const {wire,...r}=read(path.join(dir,n));return r;}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
async function state(force=false){
 if(!force&&cached&&Date.now()-cacheTime<10000)return cached;
 await assertDevnet(rpc);
 const m=await fetchMint(rpc,mint,{commitment:'confirmed'}),[ta,tb]=await fetchAllToken(rpc,[a,b],{commitment:'confirmed'});
 if(m.programAddress!==TOKEN_PROGRAM_ADDRESS||m.data.supply!==units(c.supply,c.decimals)||m.data.decimals!==c.decimals||m.data.mintAuthority.__option!=='None'||m.data.freezeAuthority.__option!=='None')throw Error('Mint invariant failed');
 for(const [t,owner] of [[ta,payer.address],[tb,recipient.address]])if(t.programAddress!==TOKEN_PROGRAM_ADDRESS||t.data.owner!==owner||t.data.mint!==mint)throw Error('Token account mismatch');
 const escrow=await giftBalances(rpc,mint);
 if(ta.data.amount+tb.data.amount+escrow.total!==m.data.supply)throw Error('Test wallet balance invariant failed');
 const metadata=await fetchMetadata(rpc,md,{commitment:'confirmed'});
 cached={mint,network:'devnet',supply:c.supply,decimals:c.decimals,payer:payer.address,recipient:recipient.address,payerBalance:ta.data.amount,recipientBalance:tb.data.amount,mintAuthority:null,freezeAuthority:null,metadataUpdateAuthority:metadata.data.updateAuthority,metadataMutable:metadata.data.isMutable,checkedAt:new Date().toISOString(),history:history()};cacheTime=Date.now();return cached;
}
function respond(res,code,data,type='application/json'){res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});res.end(type==='application/json'?json(data):data);}
async function bodyOf(req){let body='';for await(const part of req){body+=part;if(body.length>1024)throw Error('Request too large');}return JSON.parse(body);}
const server=http.createServer(async(req,res)=>{
 try{authorize(req,token,host);}catch(e){respond(res,403,{error:e.message});return;}
 try{
 if(req.method==='GET'&&req.url==='/api/session'){respond(res,200,{token});return;}
 if(req.method==='GET'&&req.url==='/api/state'){respond(res,200,await state());return;}
 if(req.method==='POST'&&req.url==='/api/transfer'){
 const body=validateTransfer(await bodyOf(req));if(busy){respond(res,409,{error:'다른 거래를 확인 중입니다. 잠시 후 다시 확인하세요.'});return;}
 busy=true;
 try{
 const file=path.join(dir,body.id+'.json');
 const prior=history().find(r=>r.status!=='confirmed'&&r.status!=='finalized');
 if(prior&&prior.operationId!==body.id)throw Error('이전 거래 확인 필요: '+prior.operationId);
 const from=body.direction==='send'?payer:recipient,to=body.direction==='send'?recipient.address:payer.address;
 let tx;
 if(fs.existsSync(file)){
  const stored=read(file);if(stored.direction!==body.direction)throw Error('Operation ID direction mismatch');tx=await reconcile(rpc,file);
 }else{
  const s=await state(true);const bal=BigInt(body.direction==='send'?s.payerBalance:s.recipientBalance);
  if(bal<units('18',c.decimals))throw Error('전송할 SHIBAL이 부족합니다.');
  tx=await submit(rpc,file,payer,await buildSend(from,mint,to,'18',c.decimals,payer),{operationId:body.id,direction:body.direction,mint,from:from.address,to,amount:'18'});
 }
 cacheTime=0;const {wire,...safe}=tx;respond(res,200,{transaction:safe});
 }finally{busy=false;}
 return;
 }
 const files={'/':['web/index.html','text/html; charset=utf-8'],'/app.js':['web/app.js','text/javascript; charset=utf-8'],'/style.css':['web/style.css','text/css; charset=utf-8'],'/logo.png':['assets/shibal-18-cute-v1.png','image/png']};
 if(req.method==='GET'&&files[req.url]){const [file,type]=files[req.url];respond(res,200,fs.readFileSync(path.join(root,file)),type);return;}
 respond(res,404,{error:'Not found'});
 }catch(e){respond(res,400,{error:e.message});}
});
await state(true);
server.listen(8181,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8181 — new devnet test wallets only'));
