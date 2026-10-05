// Asset URLs resolve next to this module: the hub serves each game under /g/<game>/<player>/ and only rewrites
// literal root paths, so a built-up "/calm-${art}.svg" would miss the prefix and 404 there.
const art=name=>new URL(`./calm-${name}.svg`,import.meta.url).href;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function calmHome(p){
 const cards=[['letters','Letters','Five little discoveries','start'],['words','Words','Build and listen with Rook','tab:matches'],['reading','Read','Sounds, stories and handwriting','tab:reading'],['story','Explore','Follow the story trail','tab:adventure']];
 return `<section class="calm-intro"><span class="eyebrow">THE LETTER STUDY</span><h1>A little discovery, ${esc(p.name)}.</h1><p>Choose something to explore. Take your time.</p></section><section class="calm-choices" aria-label="Choose an activity">${cards.map(([art_,label,hint,action])=>`<button class="calm-choice" data-action="${action}"><img src="${art(art_)}" alt="" width="240" height="200"><strong>${label}</strong><span>${hint}</span></button>`).join('')}</section><details class="calm-more"><summary>More places</summary><div><button data-action="tab:maze">Letter labyrinth</button><button data-action="tab:rescue">Rescue friends</button><button data-action="tab:soccer">Word soccer</button></div></details><p class="calm-note">Your work is kept. You can stop after any little lesson.</p>`;
}
export function calmNav(tab){return [['practice','Study'],['reading','Read'],['matches','Words'],['parents','Grown-ups']].map(([key,label])=>`<button class="nav-item ${tab===key?'selected':''}" data-action="tab:${key}" ${tab===key?'aria-current="page"':''}>${label}</button>`).join('');}
export function calmFeedback(challenge){return challenge.type==='trace'?`You traced ${challenge.char}.`:challenge.word?`You built ${challenge.word}.`:challenge.char?`You found ${challenge.char}.`:'You found the missing piece.';}
