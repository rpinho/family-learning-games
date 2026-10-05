import {mountBook} from '../book.mjs';
import {LINES} from './model.mjs';
import {pondNarrator} from './narration.mjs';
const q=new URLSearchParams(location.search),root=document.querySelector('#pond');
const narrator=pondNarrator(),manifest=await narrator.ready();
const spoken=text=>({text,clip:manifest.clips?.[text],noClip:!manifest.clips?.[text]});
// This synthetic chapter uses the actual Book page lifecycle, never a child's chapter or save.
let companions={};try{const r=await fetch('/pond/companions.json');if(r.ok)companions=await r.json();}catch{}
const mode=q.get('mode')==='flow'||(!q.has('mode')&&companions.modes?.[q.get('player')]==='flow')?'flow':'count';
const bg={url:'/pond/destination.svg'},scene={bg:'journey',actors:[],props:[],fx:[]};
const next=mode==='count'?LINES.at(-2):LINES.at(-1);
const book={date:'preview-pond',chapter:{name:'Our journey',number:1,title:mode==='count'?'A raft for a friend':'The missing map',level:mode==='count'?'early':'reader',art:{backgrounds:{journey:bg},actors:{},props:{}},ui:{},pages:[{kind:'beat',scene,say:[],beat:{kind:'pond',mode,companion:companions[mode]||null}},{kind:'story',scene,caption:next,say:[spoken(next)]}]}};
const dispose=mountBook(root,{player:'admin',book,preview:true,onDone(){root.innerHTML='<article class="pond-book"><header class="pond-heading"><h1>The pond is quiet again.</h1></header><footer class="pond-copy"><p>Our friend has a way forward.</p><a class="pond-tool" href="/preview/exit">Close the book</a></footer></article>';}});
window.addEventListener('pagehide',()=>{dispose();narrator.stop();},{once:true});
