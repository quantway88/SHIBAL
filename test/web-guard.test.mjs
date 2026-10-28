import test from 'node:test';import assert from 'node:assert/strict';
import {authorize,validateTransfer} from '../src/web-guard.mjs';
const host='127.0.0.1:8181',token='local-test-session';
const valid=()=>({method:'POST',headers:{host,origin:`http://${host}`,'x-shibal-token':token,'content-type':'application/json','sec-fetch-site':'same-origin'}});
test('external navigation may open the page but cannot read its API',()=>{const r={method:'GET',url:'/',headers:{host,'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'}};authorize(r,token,host);r.url='/api/session';assert.throws(()=>authorize(r,token,host));});
test('local API accepts same-origin session only',()=>{authorize(valid(),token,host);for(const [key,value] of [['host','attacker.example'],['origin','https://attacker.example'],['x-shibal-token','wrong'],['sec-fetch-site','cross-site'],['content-type','text/plain']]){const r=valid();r.headers[key]=value;assert.throws(()=>authorize(r,token,host));}});
test('local API rejects arbitrary recipients, amounts and paths',()=>{const b={direction:'send',id:'ui-11111111-1111-1111-1111-111111111111'};validateTransfer(b);for(const changed of [{...b,amount:100},{...b,recipient:'external'},{...b,direction:'mint'},{...b,id:'../../secret'}])assert.throws(()=>validateTransfer(changed));});
