import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {authorize} from './web-guard.mjs';
import {giftAction,listGifts,validId,amounts} from './gifts.mjs';
import {cardHead,captions} from './gift-cards.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const host='127.0.0.1:8182',origin='http://'+host,token=randomBytes(32).toString('hex');
const shell=(head,body)=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}<link rel="stylesheet" href="/gift.css"><script type="module" src="/gift.js"></script></head><body><header><a href="/">SHIBAL / GIFT LAB</a><span>● DEVNET ONLY</span></header><main>${body}</main><footer>이 컴퓨터의 전용 테스트 지갑만 사용합니다. X 인증·외부 지갑 연결은 아직 없습니다.<br>로컬 서버가 테스트 키를 관리합니다. 공개 서비스나 스마트 컨트랙트 에스크로가 아닙니다.</footer></body></html>`;
const controls=`<p id="status" role="status" aria-live="polite">준비 중…</p><button id="retry" hidden>같은 요청 다시 확인</button>`;
function send(res,status,body,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(body):body);}
const server=http.createServer(async(req,res)=>{
 try{
 // Public page navigation is safe; API and subresource requests retain cross-origin guards.
 const page=req.method==='GET'&&(/^\/gift\/gift-[0-9a-f-]{36}$/.test(req.url)||/^\/preview\/(18|180|1800|28)$/.test(req.url));
 authorize(page?{method:req.method,url:'/',headers:req.headers}:req,token,host);
 }catch(e){send(res,403,{error:e.message});return;}
 try{
 if(req.method==='GET'&&req.url==='/api/session'){send(res,200,{token});return;}
 if(req.method==='GET'&&req.url==='/api/gifts'){send(res,200,listGifts());return;}
 if(req.method==='POST'&&req.url==='/api/gifts'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)throw Error('Request too large');}
  send(res,200,await giftAction(JSON.parse(body)));return;
 }
 if(req.method!=='GET'){send(res,405,{error:'Method not allowed'});return;}
 if(req.url==='/'){
  send(res,200,shell('<title>SHIBAL · 수량별 선물 링크</title>',`<p class="eyebrow">말 대신 보내는 링크</p><h1>몇 개만큼<br>얄미운가요?</h1><p class="intro">숫자를 고르면 카드도 달라져요. 선물을 맡기고, 링크를 열어 받아보세요.</p><div class="cards">${amounts.map(a=>`<article><a href="/preview/${a}"><img src="/cards/${a}-v1.png" alt="${a} SHIBAL 카드"></a><h2>${captions[a]}</h2><button data-amount="${a}">${a}개 맡기고 링크 만들기</button><a href="/preview/${a}">미리보기 ↗</a></article>`).join('')}</div>${controls}<h2>내 테스트 선물</h2><div id="gifts"></div>`),'text/html; charset=utf-8');return;
 }
 if(req.url.startsWith('/preview/')){
  const a=req.url.slice(9);if(!amounts.includes(a))throw Error('Unknown amount');
  send(res,200,shell(cardHead(a,origin,req.url),`<p class="eyebrow">링크 미리보기 시안</p><h1>${captions[a]}</h1><img class="hero" src="/cards/${a}-v1.png" alt="${a} SHIBAL"><p>이 페이지는 수량별 썸네일 확인용입니다. 선물이 생성되거나 전송되지 않습니다.</p><a href="/">선물 만들러 가기 →</a>`),'text/html; charset=utf-8');return;
 }
 if(req.url.startsWith('/gift/')){
  const id=validId(req.url.slice(6)),g=listGifts().find(x=>x.id===id);if(!g){send(res,404,{error:'Unknown gift'});return;}
  send(res,200,shell(cardHead(g.amount,origin,req.url),`<section id="gift" data-id="${g.id}" data-amount="${g.amount}"><p class="eyebrow">나한테 온 리액션</p><h1>${g.amount}개 도착!</h1><img class="hero" src="/cards/${g.amount}-v1.png" alt="${g.amount} SHIBAL"><p>지정된 테스트 지갑 B로만 받을 수 있는 devnet 선물입니다.</p><p id="gift-state"></p><div class="actions"><button id="claim">테스트 지갑 B로 받기</button><button class="secondary" id="refund">미수령 선물 취소 · A로 회수</button></div>${controls}<label>로컬 테스트 링크<input id="share-link" readonly value="${origin+req.url}"></label><button class="secondary" id="copy">링크 복사</button><p>외부에서는 열리지 않습니다. 공개 HTTPS 호스팅 후 X 미리보기 확인이 필요합니다.</p><div id="transactions"></div></section>`),'text/html; charset=utf-8');return;
 }
 const assets={'/gift.js':['web/gift.js','text/javascript; charset=utf-8'],'/gift.css':['web/gift.css','text/css; charset=utf-8']};
 for(const a of amounts)assets[`/cards/${a}-v1.png`]=[`assets/cards/${a}-v1.png`,'image/png'];
 if(assets[req.url]){const [file,type]=assets[req.url];send(res,200,fs.readFileSync(path.join(root,file)),type);return;}
 send(res,404,{error:'Not found'});
 }catch(e){send(res,400,{error:e.code==='EEXIST'?'다른 작업 진행 중 또는 이전 프로세스 잠금 확인 필요':e.message});}
});
server.listen(8182,'127.0.0.1',()=>console.log('Local: '+origin+' — local custodial devnet gift lab'));
