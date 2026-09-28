import {mountPond} from './pond.mjs';
const query=new URLSearchParams(location.search),root=document.querySelector('#pond');
if(query.has('before')){
 root.innerHTML='<article class="pond-book"><header class="pond-heading"><div><div class="pond-kicker">The little book of noticing</div><h1>A moment in the meadow</h1></div><div class="pond-page-number">existing illustration baseline</div></header><div class="pond-world"><img class="pond-baseline" src="/book-art/bg/meadow.svg" alt="The existing generic picture-book meadow"></div><footer class="pond-copy"><div><p class="pond-prompt">Pause and look at the picture.</p><p class="pond-note">Existing public Book artwork, shown in the same review frame.</p></div></footer></article>';
}else{
 let audio=null,manifest={clips:{}},speechToken=0;
 const ready=fetch('/voice/manifest.json').then(r=>r.ok?r.json():manifest).then(m=>manifest=m).catch(()=>manifest);
 function stopSpeech(){speechToken++;if(audio){audio.pause();audio=null;}}
 async function speak(line){stopSpeech();const token=speechToken;await ready;if(token!==speechToken)return;const url=manifest.clips?.[line];if(!url)return;audio=new Audio(url);audio.play().catch(()=>{});}
 const scene=mountPond(root,{mode:query.get('mode'),speak,stopSpeech,onContinue(){scene.destroy();root.innerHTML='<article class="pond-book"><header class="pond-heading"><div><div class="pond-kicker">The story continues</div><h1>A small thing, noticed together.</h1></div></header><footer class="pond-copy"><p class="pond-prompt pond-finish">Leave the pond quiet. Tell someone what you saw.</p><a class="pond-tool" href="/">Close the study</a></footer></article>';}});
 window.__pondReview=scene;window.addEventListener('pagehide',()=>scene.destroy(),{once:true});
 // First touch unlocks recorded narration; the exercise remains available when audio is blocked.
 root.addEventListener('pointerdown',e=>{if(!e.target.closest('button'))scene.start();},{once:true});
}
