// Letter names and word examples are explicitly paired. This is not a full
// phonics curriculum: spelling letter names is not the same as blending sounds.
import {namePositionLine} from './maze-curriculum.mjs';
export const mazeWordLine=word=>`The word is ${word}.`;
export function mazeLearning(q){
 if(q.type==='name')return {name:q.name,word:q.name,focus:q.focus,letter:q.char,line:namePositionLine(q.name,q.focus)};
 const word=q.word||'',focus=q.type==='gap'?q.blank:0,letter=['word','read','blend'].includes(q.type)?word[0]:q.answer;
 const line=word?(q.type==='gap'?`Letter ${letter.toUpperCase()} ${focus===0?'starts':'is in'} ${word}.`:mazeWordLine(word)):`Letter ${q.answer.toUpperCase()}.`;
 return {word,picture:q.picture||'',focus,letter,line};
}
export const mazeTapLine=(answer,q)=>q?.type==='name'?`Letter ${q.name[Number(answer)].toUpperCase()}.`:answer.length===1?`Letter ${answer.toUpperCase()}.`:mazeWordLine(answer);
export function mazeLearningLines(words){
 return words.flatMap(({word})=>[mazeWordLine(word),...Array.from(word,(letter,i)=>`Letter ${letter.toUpperCase()} ${i===0?'starts':'is in'} ${word}.`)]);
}
