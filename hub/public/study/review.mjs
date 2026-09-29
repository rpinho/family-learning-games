import {mountBook} from '../book.mjs';
import {mountStudy,TITLE,PROMPT} from './activity.mjs';
const root=document.querySelector('#study'),q=new URLSearchParams(location.search),mode=q.get('mode')==='reader'?'reader':'early';
// Preview uses only a picture library, never an account's chapter, progress or preferences.
let dispose=()=>{},background='/book-art/bg/forest.svg';
const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),2000);
try{const r=await fetch('/api/book/library',{signal:timeout.signal});if(r.ok){const lib=await r.json();background=lib.backgrounds?.['forest-path']?.url||lib.backgrounds?.forest?.url||background;}}catch{}finally{clearTimeout(timer);}
const scene={bg:'woods',actors:[],props:[],fx:'none'};
function originalPage(){dispose();const book={date:'study',chapter:{name:'Our journey',number:1,title:TITLE,level:'reader',art:{backgrounds:{woods:{url:background}},actors:{},props:{}},pages:[{kind:'story',scene,caption:'The path is open. Our story can carry on.',say:[]}]}};dispose=mountBook(root,{player:'admin',book,preview:true,onDone:()=>{dispose();root.innerHTML='<article class="ending"><h1>A quiet place to pause.</h1><a href="/preview/exit">Close the book</a></article>';}});root.querySelector('.bk-open')?.click();}
if(q.has('before'))originalPage();else dispose=mountStudy(root,{mode,background,onDone:originalPage}).destroy;
addEventListener('pagehide',()=>{dispose();},{once:true});
