// The Book: turn the story JSON + plan into the chapter the hub plays, and its read-aloud copies.
import {splitLines} from './lint.mjs';
export const CHAPTER_SCHEMA='family-book-chapter-1';
// Fixed lines the reader speaks. Content prompts always speak; HOW_TO is said once per session.
export const UI_LINES={mistakePrompt:'Uh oh. I think I made a mistake. Can you find it?',howTo:'Tap the part that is wrong.',notIt:'That part is right. Keep looking!',fixPrompt:'What should it be?',yes:'Yes!',tryAgain:'Try again.',greatReading:'Great reading!'};
export function assemble(story,plan,{number=1,source='template',lint=[],generatedAt=new Date().toISOString(),dadLines=[],portraits=new Set()}={}){
 const byId=Object.fromEntries(plan.challenges.map(c=>[c.id,c]));
 const cast=(plan.cast||[plan.companion]).map(c=>({id:c.id||c.name,name:c.name,emoji:c.emoji||'⭐',portrait:portraits.has(c.id)?`${c.id}.jpg`:null}));
 const who=text=>cast.filter(c=>new RegExp(`\\b${c.name.replace(/^the\s+/i,'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(text)).map(c=>c.id);
 const pages=story.pages.map((p,i)=>{
  const text=p.text.trim().replace(/\s*[—–]\s*/g,', ');
  const base={id:`p${i+1}`,text,lines:splitLines(text),cast:who(text)};
  if(p.challenge)return {...base,kind:'challenge',challenge:p.challenge,practises:byId[p.challenge].practises,item:byId[p.challenge].item};
  if(p.mistake){const m=plan.mistake;return {...base,kind:'mistake',mistake:{kind:m.kind,claim:m.claim,wrong:m.wrong,right:m.right,tokens:m.tokens||null,hint:m.hint,caught:m.caught,fix:m.fix}};}
  return {...base,kind:'story',scene:p.scene||'',...(p.teach&&plan.teach?{teach:plan.teach}:{})};
 });
 const cover=`${plan.name}'s Book. Chapter ${number}. ${story.title.replace(/[.!?]*$/,'.')}`;
 return {schema:CHAPTER_SCHEMA,player:plan.player,name:plan.name,date:plan.date,number,title:story.title,cover,
  companion:{name:plan.companion.name,emoji:plan.companion.emoji||'⭐'},cast,level:plan.level,pages,
  summary:story.summary,hook:story.hook,bedtimeQuestion:story.bedtimeQuestion,
  meta:{generatedAt,source,lint,practises:[...plan.challenges.map(c=>c.practises),`catch the mistake: ${plan.mistake.claim}`],dadLines,yesterday:plan.yesterday}};
}
export function speechLines(ch){
 const lines=new Set([ch.cover,...Object.values(UI_LINES)]);
 for(const p of ch.pages){for(const l of p.lines)lines.add(l);
  if(p.item)lines.add(p.item.spoken);
  if(p.mistake){lines.add(p.mistake.hint);lines.add(p.mistake.caught);lines.add(p.mistake.fix.spoken);}}
 return [...lines].filter(Boolean);
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function itemText(it){
 if(it.kind==='sentence')return `Build the sentence: "${it.sentence}" (tiles: ${it.tiles.join(' · ')})`;
 if(it.kind==='math')return `${it.display||it.spoken} (answer ${it.answer})`;
 if(it.kind==='count')return `${it.spoken} ${it.picture} (answer ${it.answer})`;
 if(it.kind==='first-letter')return `${it.spoken} ${it.picture||''} (answer ${it.answer})`;
 return `${it.spoken} (answer ${it.answer})`;
}
export function markdown(ch,{did=[]}={}){
 const out=[`# ${ch.title}`,'',`*${ch.name}'s Book, chapter ${ch.number} · ${ch.date}*`,''];
 for(const p of ch.pages){
  if(p.kind==='challenge')out.push(`> **Challenge:** ${p.text}  `,`> ${itemText(p.item)}`,'');
  else if(p.kind==='mistake')out.push(`> **Catch the mistake:** ${p.text}  `,`> The slip: "${p.mistake.claim}" (should be ${p.mistake.right})`,'');
  else out.push(p.text,'');
 }
 if(did.length){out.push('## What he did','');for(const d of did)out.push('- '+d);out.push('');}
 out.push(`**Bedtime question:** ${ch.bedtimeQuestion}`,'');
 return out.join('\n');
}
// Printable bedtime page: read it aloud together (Dad is the voice). Self-contained, light/dark aware.
export function bedtimeHTML(ch,{did=[],dadLines=[],portraitData={}}={}){
 const faces=(ids=[])=>ids.map(id=>ch.cast?.find(c=>c.id===id)).filter(c=>c&&portraitData[c.id]).map(c=>`<img class="face" src="${portraitData[c.id]}" alt="${esc(c.name)}">`).join('');
 const pages=ch.pages.map(p=>{
  if(p.kind==='challenge')return `<aside class="ask"><b>Ask ${esc(ch.name)}</b><p>${esc(p.text)}</p><p class="q">${esc(itemText(p.item))}</p></aside>`;
  if(p.kind==='mistake')return `<aside class="slip"><b>Catch the mistake</b><p>${esc(p.text)}</p><p class="q">Read it as if it's true and let him catch it. (Right answer: ${esc(p.mistake.right)})</p></aside>`;
  return `${p.cast?.length&&faces(p.cast)?`<div class="faces">${faces(p.cast)}</div>`:''}<p>${p.scene?`<span class="scene" aria-hidden="true">${esc(p.scene)}</span> `:''}${esc(p.text)}</p>`;
 }).join('\n');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ch.name)}'s Book: ${esc(ch.title)}</title>
<style>:root{--bg:#fffaf0;--ink:#1f2a36;--muted:#5d6b78;--card:#fff;--line:#e8dcc4;--ask:#eef6ff;--slip:#fff1e6;--accent:#b4531a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#171a1f;--ink:#ece6da;--muted:#a9b1ba;--card:#20242b;--line:#343a44;--ask:#1c2a3a;--slip:#3a2618;--accent:#f0a36a}}
:root[data-theme="dark"]{--bg:#171a1f;--ink:#ece6da;--muted:#a9b1ba;--card:#20242b;--line:#343a44;--ask:#1c2a3a;--slip:#3a2618;--accent:#f0a36a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:19px/1.6 Georgia,'Iowan Old Style',serif}
main{max-width:720px;margin:0 auto;padding:32px 16px 64px}h1{font-size:1.9rem;line-height:1.2;margin:.2em 0}.kicker{color:var(--accent);font:700 .8rem/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}
.scene{font-size:1.3em}.faces{display:flex;gap:8px;margin:18px 0 -6px}.face{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--line)}.cast{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 18px}.cast figure{margin:0;text-align:center;font:600 .78rem system-ui,sans-serif;color:var(--muted)}.cast img{width:84px;height:84px;border-radius:50%;object-fit:cover;display:block;margin-bottom:4px;border:2px solid var(--line)}aside{border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:14px 0;font-family:system-ui,sans-serif;font-size:.95rem}aside b{font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}aside p{margin:.3em 0}.ask{background:var(--ask)}.slip{background:var(--slip)}.q{color:var(--muted)}
section.did{margin-top:28px;border-top:1px solid var(--line);padding-top:12px;font-family:system-ui,sans-serif;font-size:.95rem}section.did li{margin:.2em 0}.bedtime{margin-top:18px;font-style:italic}
@media print{body{background:#fff;color:#000;font-size:14pt}aside{break-inside:avoid;background:none!important}main{padding:0}}</style></head>
<body><main><div class="kicker">${esc(ch.name)}'s Book · Chapter ${ch.number} · ${esc(ch.date)}</div><h1>${esc(ch.title)}</h1>
${(ch.cast||[]).some(c=>portraitData[c.id])?`<div class="cast">${ch.cast.map(c=>portraitData[c.id]?`<figure><img src="${portraitData[c.id]}" alt="">${esc(c.name)}</figure>`:`<figure><span style="font-size:60px;line-height:84px">${esc(c.emoji)}</span>${esc(c.name)}</figure>`).join('')}</div>`:''}
${pages}
<p class="bedtime">Bedtime question: ${esc(ch.bedtimeQuestion)}</p>
${did.length||dadLines.length?`<section class="did"><b>What ${esc(ch.name)} did</b><ul>${[...did,...dadLines.map(l=>'Dad: '+l)].map(d=>`<li>${esc(d)}</li>`).join('')}</ul></section>`:''}
</main></body></html>`;
}
