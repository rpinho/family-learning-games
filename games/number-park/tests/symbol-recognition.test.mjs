import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recognizeArt,validArtLabel,guessLine,digitGroups,guessVoiceLines} from '../lib/symbol-recognition.mjs';
import {numberPaths} from '../lib/number-trace.mjs';
import {inkStats} from '../lib/doodle.mjs';
import {freshProfile,action} from '../lib/math.mjs';
const picture=JSON.parse(await readFile(new URL('../data/doodle-model.json',import.meta.url))),symbols=JSON.parse(await readFile(new URL('../data/symbol-model.json',import.meta.url)));
const recognize=(ink,mode)=>recognizeArt(ink,picture,symbols,mode);
const printed=text=>{const cell=150/text.length,height=Math.min(65,cell*1.8),out=[];let x=4;for(const ch of text){const ink=symbols.glyphs[ch],b=inkStats(ink),width=Math.min(cell-3,height*b.w/b.h);for(const stroke of ink)out.push(stroke.map(([px,py])=>[x+(px-b.x)/Math.max(b.w,1)*width,12+(py-b.y)/Math.max(b.h,1)*height]));x+=cell;}return out;};
test('handwritten narrow-loop six and broad/sloping seven remain numbers in Anything mode',()=>{
 const six=[[[75,9],[57,24],[39,52],[33,73],[35,87],[44,92],[54,90],[61,84],[58,74],[49,62],[36,56]]];
 const seven=[[[12,27],[44,22],[75,17],[83,19],[76,29],[49,55],[18,86]]];
 for(const [label,ink] of [['6',six],['7',seven]])for(const mode of ['auto','numbers']){assert.equal(recognize(ink,mode).label,label);assert.equal(recognize(ink.map(s=>s.map(([x,y])=>[x*.7+10,y*.7+10])),mode).label,label);}
 for(const label of ['K','Z','z','R'])assert.ok(recognize(symbols.glyphs[label],'auto').candidates.includes(label),label+' not forced to a number');
});
test('all 62 authored manuscript forms are represented, including case ambiguity',()=>{
 for(const [label,ink] of Object.entries(symbols.glyphs)){
  const mode=/\d/.test(label)?'numbers':'letters';
  const result=recognize(ink,mode);assert.ok(result.candidates.includes(label),label);
  const offset=ink.map(s=>s.map(([x,y])=>[x*.85+3,y*.85+4]));assert.ok(recognize(offset,mode).candidates.includes(label),label+' resized');
 }
});
test('single and separated multi-digit numbers from 0 to 100, independent of stroke order',()=>{
 for(let n=0;n<=100;n++)assert.equal(recognize(numberPaths(n),'numbers').label,String(n),'number '+n);
 assert.equal(recognize([...numberPaths(13)].reverse(),'numbers').label,'13');
 assert.equal(digitGroups(symbols.glyphs.i).length,1);
 const three=[[55,10],[72,11],[79,22],[71,40],[57,50],[73,58],[83,76],[75,90],[55,90]];
 const handDrawn=[[[7,10],[8,90]],...three.slice(1).map((p,i)=>[three[i],p])];
 assert.equal(recognize(handDrawn,'numbers').label,'13');
});
test('printed words and large digit strings use the full drawing width',()=>{
 assert.equal(recognize(printed('1044'),'numbers').label,'1044');
 assert.equal(recognize(printed('1044'),'auto').label,'1044');
 assert.equal(recognize(printed('BEGINNER'),'words').label,'BEGINNER');
 assert.equal(recognize(printed('BEGINNER'),'auto').label,'BEGINNER');
});
test('no forced answer for blank/invalid ink; O/0/circle and I/l/1 remain explicit alternatives',()=>{
 for(const ink of [[],[[[NaN,5]]],[[[20,20],[20,20]]]])assert.equal(recognize(ink,'auto').label,null);
 const o=recognize(symbols.glyphs.O,'auto');assert.equal(o.label,null);for(const x of ['O','o','0','circle'])assert.ok(o.candidates.includes(x));
 const l=recognize(symbols.glyphs.l,'auto');assert.equal(l.label,null);for(const x of ['I','l','1'])assert.ok(l.candidates.includes(x));
 assert.equal(recognize(symbols.glyphs.l,'numbers').label,'1');
 assert.throws(()=>recognize(symbols.glyphs.R,'invalid'));
});
test('corrections support letters, words and big numbers without scores, label spoofing or stale replay',()=>{
 const p=freshProfile('explorer'),send=input=>action(p,{revision:p.revision,...input},123,{recognize});
 send({kind:'art_guess',mode:'letters',strokes:symbols.glyphs.R,label:'house'});assert.equal(p.art.lastGuess.label,'R');
 const id=p.art.lastGuess.id;send({kind:'art_label',guessId:id,label:'R'});assert.equal(p.art.lastGuess.childLabel,'R');assert.equal(p.xp,0);
 assert.throws(()=>send({kind:'art_label',guessId:id,label:'r'}));
 send({kind:'art_guess',mode:'numbers',strokes:numberPaths(13)});assert.equal(p.art.lastGuess.label,'13');
 send({kind:'art_label',guessId:p.art.lastGuess.id,label:'12'});assert.equal(p.art.lastGuess.childLabel,'12');
 for(const x of ['1000000','-1','3.5','001','two words','<script>'])assert.equal(validArtLabel(x),false);
 for(const x of ['1044','999999','Beginner','elephant'])assert.equal(validArtLabel(x),true);
 assert.equal(guessLine('R'),'Is it the letter R?');assert.equal(guessLine('a'),'Is it the letter A?');assert.equal(guessLine('13'),'Is it 13?');
 assert.equal(guessLine('1044'),'Is it 1,044?');assert.equal(guessLine('BEGINNER'),'Does it say Beginner?');
 assert.deepEqual(guessVoiceLines('1044'),['I see the number.','1','0','4','4']);
});
