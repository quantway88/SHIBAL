import {amounts} from './gifts.mjs';
export const captions={'18':'가볍게 툭. 18 도착!','180':'장난이 열 배. 180 도착!','1800':'리액션 폭발. 1800 도착!','28':'오늘은 색다르게. 28 도착!'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cardHead(amount,origin,url){
 if(!amounts.includes(amount))throw Error('Unsupported card amount');
 const image=origin+'/cards/'+amount+'-v1.png',title=captions[amount],description=`${amount} SHIBAL 선물 · DEVNET 테스트 · 실제 가치 없음`;
 return `<title>${esc(title)}</title><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(origin+url)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="${amount} SHIBAL devnet 선물 카드">`;
}
