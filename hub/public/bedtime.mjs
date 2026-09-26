// Bedtime page for the grown-ups: each child's chapter to read aloud together, how the book went,
// and what he did today. Opened from Grown-ups; nothing here is shown to the children.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const shift=(date,n)=>{const [y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
export function itemLine(it){
 if(it.kind==='sentence')return `Build the sentence: “${it.sentence}”`;
 if(it.kind==='math')return `${it.display||it.spoken} (${it.answer})`;
 if(it.kind==='count')return `${it.spoken} ${it.picture} (${it.answer})`;
 return `${it.spoken}${it.picture?' '+it.picture:''} (${it.answer})`;
}
export function howItWent(ch,progress){
 if(!ch)return [];
 const out=[];
 if(progress.finished)out.push('Read the whole chapter ✓');else if(progress.opens)out.push(`Started the chapter (page ${progress.page+1} of ${ch.pages.length})`);else out.push('Has not opened today’s chapter yet');
 for(const r of progress.results||[]){const p=ch.pages[r.page];if(!p)continue;
  if(r.kind==='mistake')out.push(`Caught the mistake “${p.mistake?.claim}”${r.misses?` after ${r.misses} other tap${r.misses>1?'s':''}`:' first try'}${r.hints?' (with a hint)':''}`);
  else out.push(`${p.practises||r.kind}: ${r.misses?`${r.misses} miss${r.misses>1?'es':''}`:'first try'}`);}
 return out;
}
function chapterHTML(k){
 const ch=k.chapter;
 if(!ch)return `<article><div class="kicker">${esc(k.name)}</div><p class="empty">No chapter for this day.</p>${didHTML(k,[])}</article>`;
 const pages=ch.pages.map(p=>p.kind==='challenge'?`<aside class="ask"><b>Ask ${esc(ch.name)}</b><p>${esc(p.text)}</p><p class="q">${esc(itemLine(p.item))}</p></aside>`
  :p.kind==='mistake'?`<aside class="slip"><b>Catch the mistake</b><p>${esc(p.text)}</p><p class="q">Read it as if it’s true and let him catch it. The right answer: ${esc(p.mistake.right)}.</p></aside>`
  :`<p>${p.scene?`<span class="scene" aria-hidden="true">${esc(p.scene)}</span> `:''}${esc(p.text)}</p>`).join('');
 return `<article><div class="kicker">${esc(ch.name)}’s Book · Chapter ${esc(ch.number)}</div><h1>${esc(ch.title)}</h1>${pages}<p class="bedtime">Bedtime question: ${esc(ch.bedtimeQuestion)}</p>${didHTML(k,howItWent(ch,k.progress))}</article>`;
}
function didHTML(k,went){
 const rows=[...went,...(k.did||[]),...(k.notes||[]).map(n=>'You wrote: '+n)];
 return rows.length?`<div class="did"><b>${esc(k.name)} today</b><ul>${rows.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></div>`:'';
}
async function load(date){
 const r=await fetch('/api/book/bedtime'+(date?`?date=${date}`:''));const j=await r.json();
 $('#day').textContent=new Date(j.date+'T12:00:00Z').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
 $('#main').innerHTML=j.kids.map(chapterHTML).join('')||'<p class="empty">No children set up.</p>';
 $('#prev').onclick=()=>go(shift(j.date,-1));$('#next').onclick=()=>go(shift(j.date,1));
}
function go(date){const u=new URL(location.href);u.searchParams.set('date',date);history.replaceState(null,'',u);void load(date);}
if(typeof document!=='undefined'&&document.getElementById('main')){$('#print').onclick=()=>print();load(new URL(location.href).searchParams.get('date')).catch(e=>{$('#main').innerHTML=`<p class="empty">${esc(e.message)}</p>`;});}
