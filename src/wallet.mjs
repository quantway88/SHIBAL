import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {generateKeyPair,createKeyPairSignerFromBytes} from '@solana/kit';
export const walletDir=path.join(process.env.LOCALAPPDATA||os.homedir(),'SHIBAL-devnet-private');
export async function wallet(role) {
 if(!['payer','recipient','mint'].includes(role)) throw Error('Unknown wallet role');
 fs.mkdirSync(walletDir,{recursive:true,mode:0o700});
 if(process.platform==='win32') {
 const user=execFileSync('whoami',[],{encoding:'utf8'}).trim();
 execFileSync('icacls',[walletDir,'/inheritance:r','/grant:r',`${user}:(OI)(CI)F`],{stdio:'pipe'});
 }
 const filename=path.join(walletDir,`${role}.keypair.json`);
 if(!fs.existsSync(filename)) {
 const pair=await generateKeyPair(true);
 const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
 const secret=Buffer.concat([Buffer.from(jwk.d,'base64url'),Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey))]);
 fs.writeFileSync(filename,JSON.stringify([...secret]),{flag:'wx',mode:0o600});
 secret.fill(0);
 }
 const raw=JSON.parse(fs.readFileSync(filename,'utf8'));
 if(!Array.isArray(raw)||raw.length!==64||raw.some(v=>!Number.isInteger(v)||v<0||v>255)) throw Error('Invalid local test key');
 return createKeyPairSignerFromBytes(Uint8Array.from(raw));
}
