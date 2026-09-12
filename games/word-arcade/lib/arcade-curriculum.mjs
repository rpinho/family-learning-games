import {builderQuestion,builderAttempt} from './builder.mjs';
function mix(values,seed){const a=[...values];for(let i=a.length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function arcadeQuestion(p,game,pools,deck='words'){
 p.drills??={};const key=game+':'+deck,proxy={id:p.id,builder:p.drills[key],variety:p.variety};
 const q=builderQuestion(proxy,pools);p.drills[key]=proxy.builder;
 q.game=game;q.drillKey=key;q.deck=deck;
 if(game==='orbit'){
  q.nodes=mix([...q.word,...q.tiles.filter(c=>!q.word.includes(c)).slice(0,3)],proxy.builder.serial*7919);
  q.prompt=`The word is ${q.word}.`;q.help=`The word is ${q.word}.`;
 }else if(deck==='letters'){
  const letters='amstcpndoghrbfliuekvwyjxzq',c=letters[(proxy.builder.serial-1)%letters.length];
  q.word=c;q.upperCue=c.toUpperCase();q.answer=c;q.tiles=mix([c,letters[(proxy.builder.serial+3)%letters.length],letters[(proxy.builder.serial+6)%letters.length],letters[(proxy.builder.serial+9)%letters.length]],proxy.builder.serial*7919);
  q.prompt=`Find little ${c.toUpperCase()}.`;q.help=`Big ${c.toUpperCase()} pairs with little ${c.toUpperCase()}.`;q.printCase='lower';
 }else if(deck==='words'){
  const position=(proxy.builder.serial-1)%q.word.length;q.display=[...q.word].map((c,i)=>i===position?'_':c.toUpperCase()).join(' ');q.answer=q.word[position];q.position=position;q.prompt=`The word is ${q.word}.`;
 }else q.prompt=`The word is ${q.word}.`;
 return q;
}
export function arcadeAttempt(p,q,result){
 const proxy={builder:p.drills?.[q.drillKey]};builderAttempt(proxy,q,result);p.drills??={};p.drills[q.drillKey]=proxy.builder;return proxy.builder.stage;
}
