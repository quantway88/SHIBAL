export const ORIGIN='https://shibal-devnet-gifts.spunkycamel22.chatgpt.site';
export const PUBLISHER='AzATsGNhjzmzPceHH8PyrYUUfRU4JFaRaU4yseHdviZv';
export const MINT='YrDkqvMwkF2pP8eJjZiq9N1Ph6voryK1FRTLX1KcoKk';
export const AMOUNTS=['18','180','1800','28'];
export function publicKeyBytes(s){
 if(typeof s!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s))throw Error('Invalid wallet');
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;
 for(const c of s)n=n*58n+BigInt(alphabet.indexOf(c));
 const bytes=[];while(n){bytes.unshift(Number(n%256n));n/=256n;}
 for(const c of s){if(c!=='1')break;bytes.unshift(0);}if(bytes.length!==32)throw Error('Invalid wallet');return new Uint8Array(bytes);
}
export const claimText=(id,amount,recipient,hash)=>`SHIBAL devnet gift\nOrigin: ${ORIGIN}\nGift: ${id}\nMint: ${MINT}\nAmount: ${amount}\nRecipient: ${recipient}\nInvitation hash: ${hash}\nI request this test gift. No payment or token approval.`;
export async function hashCode(code){if(typeof code!=='string'||! /^[a-f0-9]{64}$/.test(code))throw Error('Invalid invitation');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function verifyProof(address,text,signature){try{const bytes=Uint8Array.from(atob(signature),c=>c.charCodeAt(0));if(bytes.length!==64)return false;const key=await crypto.subtle.importKey('raw',publicKeyBytes(address),{name:'Ed25519'},false,['verify']);return await crypto.subtle.verify('Ed25519',key,bytes,new TextEncoder().encode(text));}catch{return false;}}
export const validGiftId=id=>typeof id==='string'&&/^gift-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
