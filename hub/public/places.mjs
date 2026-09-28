// Where each child was last (a game he left in the middle), so the hub can bring him back. Tiny on purpose:
// the hub home loads it at start without loading the book.
export function lastPlace(player,storage=globalThis.localStorage){try{const v=JSON.parse(storage.getItem('family-games-last:'+player)||'null');return v&&Date.now()-v.at<36*36e5&&typeof v.hash==='string'?v.hash:'';}catch{return '';}}
export function rememberPlace(player,hash,storage=globalThis.localStorage){try{if(hash&&hash!=='#')storage.setItem('family-games-last:'+player,JSON.stringify({hash,at:Date.now()}));}catch{}}
