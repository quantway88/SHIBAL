import http from 'node:http';
import fs from 'node:fs';
const assets=new URL('../assets/',import.meta.url);
http.createServer((req,res)=>{
 const routes={'/18.svg':['18.svg','image/svg+xml'],'/metadata.json':['metadata.json','application/json']};
 const item=routes[req.url];if(!item){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':item[1],'Access-Control-Allow-Origin':'*'});res.end(fs.readFileSync(new URL(item[0],assets)));
}).listen(8180,'127.0.0.1',()=>console.log('Local test assets: http://127.0.0.1:8180/metadata.json (not public wallet hosting)'));
