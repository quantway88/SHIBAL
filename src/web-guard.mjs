import {timingSafeEqual} from 'node:crypto';
export function authorize(req,token,host){
 if(req.headers.host!==host)throw Error('Invalid host');
 const navigation=req.method==='GET'&&req.url==='/'&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document';
 if(!navigation&&['cross-site','same-site'].includes(req.headers['sec-fetch-site']))throw Error('Cross-origin access denied');
 if(req.method==='POST'){
  if(req.headers.origin!==`http://${host}`)throw Error('Invalid origin');
  const supplied=Buffer.from(req.headers['x-shibal-token']||'');const wanted=Buffer.from(token);
  if(supplied.length!==wanted.length||!timingSafeEqual(supplied,wanted))throw Error('Invalid session');
  if(req.headers['content-type']!=='application/json')throw Error('JSON required');
 }
}
export function validateTransfer(body){
 if(!body||!['send','return'].includes(body.direction)||typeof body.id!=='string'||!/^ui-[0-9a-f-]{36}$/.test(body.id))throw Error('Invalid transfer request');
 if(Object.keys(body).some(k=>!['direction','id'].includes(k)))throw Error('Only fixed 18-token test-wallet transfers allowed');
 return body;
}
