const $=id=>document.getElementById(id),key='shibal-gift-request-v1';let token='',busy=false,pending=null;
try{pending=JSON.parse(localStorage.getItem(key)||'null');}catch{}
const say=s=>{if($('status'))$('status').textContent=s;};
async function api(url,options){const r=await fetch(url,options),d=await r.json();if(!r.ok)throw Error(d.error);return d;}
function disable(){document.querySelectorAll('button[data-amount],#claim,#refund').forEach(b=>{b.disabled=busy||!!pending||b.dataset.finished==='yes';});if($('retry')){$('retry').hidden=!pending;$('retry').disabled=busy;}}
function txLinks(g){const d=document.createElement('div');for(const [action,sig]of Object.entries(g.signatures)){const a=document.createElement('a');a.textContent=({deposit:'맡기기',claim:'수령',refund:'회수'})[action]+' 거래 ↗';a.href=`https://explorer.solana.com/tx/${sig}?cluster=devnet`;a.target='_blank';a.rel='noreferrer';d.append(a,document.createTextNode(' · '));}return d;}
async function refresh(){
 const all=await api('/api/gifts');
 if($('gifts')){$('gifts').replaceChildren();for(const g of all){const a=document.createElement('a');a.className='record';a.href='/gift/'+g.id;a.textContent=`${g.amount} SHIBAL · ${g.status} →`;$('gifts').append(a);}}
 if($('gift')){const g=all.find(x=>x.id===$('gift').dataset.id);if(!g)throw Error('Gift missing');
  $('gift-state').textContent='상태: '+({preparing:'입금 확인 필요',funded:'수령 대기',claimed:'수령 완료',refunded:'회수 완료'})[g.status];
  for(const action of ['claim','refund'])$(action).dataset.finished=g.status!=='funded'||(g.intent&&g.intent!==action)?'yes':'no';
  $('transactions').replaceChildren(txLinks(g));
 }disable();
}
async function perform(request){
 if(busy)return;pending ||= request;localStorage.setItem(key,JSON.stringify(pending));busy=true;disable();say('devnet 거래 확인 중… 재시도해도 같은 거래만 확인합니다.');
 try{const g=await api('/api/gifts',{method:'POST',headers:{'content-type':'application/json','x-shibal-token':token},body:JSON.stringify(pending)});pending=null;localStorage.removeItem(key);say('체인 확인 완료.');if(!$('gift'))location.assign('/gift/'+g.id);else await refresh();}
 catch(e){say(e.message+' · 기존 요청을 유지합니다.');}finally{busy=false;disable();}
}
document.querySelectorAll('button[data-amount]').forEach(b=>b.onclick=()=>perform({id:'gift-'+crypto.randomUUID(),amount:b.dataset.amount,action:'deposit'}));
for(const action of ['claim','refund'])if($(action))$(action).onclick=()=>perform({id:$('gift').dataset.id,amount:$('gift').dataset.amount,action});
if($('retry'))$('retry').onclick=()=>perform(pending);
if($('copy'))$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('share-link').value);say('로컬 링크를 복사했습니다. 다른 컴퓨터에서는 열리지 않습니다.');}catch{say('링크 입력란에서 주소를 직접 복사해 주세요.');}};
try{({token}=await api('/api/session'));await refresh();say(pending?'이전 요청이 남아 있습니다. 같은 요청 다시 확인을 눌러주세요.':'테스트 준비 완료.');}catch(e){say(e.message);}disable();
