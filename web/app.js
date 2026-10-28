const $=id=>document.getElementById(id);let token='',busy=false,ready=false,canSend=false,canReturn=false;
const key='shibal-pending-v1';let pending;
try{pending=JSON.parse(sessionStorage.getItem(key)||'null');}catch{pending=null;}
const status=(text,error=false)=>{$('status').textContent=text;$('status').className=error?'error':'';};
function buttons(){for(const id of ['send','return'])$(id).disabled=busy||!ready||Boolean(pending);$('send').disabled ||= !canSend;$('return').disabled ||= !canReturn;$('refresh').disabled=busy;$('retry').hidden=!pending;$('retry').disabled=busy;}
async function api(url,options={}){const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Error(data.error||'요청 실패');return data;}
function amount(v,d){const n=BigInt(v),base=10n**BigInt(d),whole=(n/base).toLocaleString('ko-KR'),f=(n%base).toString().padStart(d,'0').replace(/0+$/,'');return whole+(f?'.'+f:'');}
async function refresh(){
 const s=await api('/api/state');$('balance-a').textContent=amount(s.payerBalance,s.decimals);$('balance-b').textContent=amount(s.recipientBalance,s.decimals);
 canSend=BigInt(s.payerBalance)>=18n*10n**BigInt(s.decimals);canReturn=BigInt(s.recipientBalance)>=18n*10n**BigInt(s.decimals);
 for(const [id,addr] of [['wallet-a',s.payer],['wallet-b',s.recipient],['mint',s.mint]]){$(id).href=`https://explorer.solana.com/address/${addr}?cluster=devnet`;if(id!=='mint')$(id).textContent=addr;}
 $('authority').textContent=s.mintAuthority===null&&s.freezeAuthority===null?'권한 없음 ✓':'확인 필요';$('metadata-authority').textContent=s.metadataMutable?(s.metadataUpdateAuthority===s.payer?'테스트 지갑 A에 유지':'다른 주소에 유지'):'변경 불가';$('checked').textContent=new Date(s.checkedAt).toLocaleTimeString('ko-KR');
 $('history').replaceChildren();for(const tx of s.history.slice(0,8)){const li=document.createElement('li');li.textContent=`${tx.direction==='send'?'A → B':'B → A'} · 18 SHIBAL · ${tx.status} `;const a=document.createElement('a');a.textContent='거래 보기 ↗';a.href=`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`;a.target='_blank';a.rel='noreferrer';li.append(a);$('history').append(li);}
 if(!s.history.length){const li=document.createElement('li');li.textContent='첫 18을 보내보세요.';$('history').append(li);}ready=true;buttons();
}
async function transfer(direction){
 if(busy)return;busy=true;
 if(!pending){pending={direction,id:'ui-'+crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(pending));}
 buttons();status('거래를 확인 중입니다. 창을 닫아도 같은 요청 ID로 확인할 수 있습니다.');
 try{
 const result=await api('/api/transfer',{method:'POST',headers:{'Content-Type':'application/json','X-Shibal-Token':token},body:JSON.stringify(pending)});
 if(!['confirmed','finalized'].includes(result.transaction.status))throw Error('아직 확정되지 않았습니다. 이전 요청 상태 확인을 눌러주세요.');
 pending=null;sessionStorage.removeItem(key);status('18개 전송 완료! 거래가 체인에서 확인됐습니다.');
 try{await refresh();}catch(e){status('거래는 완료됐습니다. 잔액 조회 오류: '+e.message,true);}
 }catch(e){status(e.message+' · 중복 전송을 막기 위해 요청 ID를 유지합니다.',true);}
 finally{busy=false;buttons();}
}
$('send').onclick=()=>transfer('send');$('return').onclick=()=>transfer('return');$('retry').onclick=()=>transfer(pending?.direction);
$('refresh').onclick=async()=>{try{await refresh();status(pending?'이전 요청 상태를 확인해 주세요.':'체인 잔액을 확인했습니다.');}catch(e){status(e.message,true);}};
try{({token}=await api('/api/session'));await refresh();status(pending?'이전 요청이 남아 있습니다. 상태 확인부터 진행하세요.':'준비 완료. A에서 B로 18개를 보내보세요.');}catch(e){status('연결 실패: '+e.message,true);}buttons();
