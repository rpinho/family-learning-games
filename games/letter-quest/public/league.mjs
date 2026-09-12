import {KINGDOMS,leagueRows} from './engine.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function claimedLeague(p,index=p.league){return (p.leagueHistory||[]).find(h=>h.league===index);}
export function claimLeague(p){
 if(claimedLeague(p)||!leagueRows(p)[0].you)return false;
 p.leagueHistory??=[];p.leagueHistory.push({league:p.league,rows:leagueRows(p),wonAt:new Date().toISOString()});p.crowns++;p.gems+=40;p.revision++;
 return {gems:40,crown:1,league:p.league};
}
export function advanceLeague(p){
 const win=claimedLeague(p);if(!win)return false;
 win.rows=leagueRows(p);win.advancedAt=new Date().toISOString();p.league++;p.leagueBase=p.xp;p.revision++;
 return {league:p.league};
}
export function leagueScreen(p,selection=p.league){
 const index=Number.isInteger(selection)&&selection>=0&&selection<=p.league?selection:p.league,k=KINGDOMS[index%7],past=index<p.league,win=claimedLeague(p,index),legacy=past&&!win;
 const rows=past?win?.rows||[{name:p.name,xp:null,you:true,icon:'♟'}]:leagueRows(p),first=rows[0].you;
 const nav=Array.from({length:p.league+1},(_,i)=>{const gem=KINGDOMS[i%7];return `<button data-action="league-select:${i}" class="gem-stop ${i===index?'selected':''}" aria-label="${gem.gem} gem ${i+1}${i===p.league?' current':''}" aria-pressed="${i===index}" style="--gem:${gem.color}"><span>◆</span><strong>${gem.gem}</strong><small>${i<p.league||claimedLeague(p,i)?'♛ Won':i===p.league?'Current':'Locked'}</small></button>`;}).join('');
 return `<section class="league-room"><div class="page-heading"><div><div class="eyebrow">YOUR GEM COLLECTION</div><h1>${k.gem} leaderboard <span style="color:${k.color}">◆</span></h1><p>${past?'Your winning leaderboard, kept for you.':'Enjoy your place. You decide when to move to the next gem.'}</p></div></div><nav class="gem-history" aria-label="Browse current and previous gems">${nav}</nav><div class="gem-page-controls"><button class="text-button" data-action="league-select:${index-1}" ${index===0?'disabled':''}>← Previous gem</button><span>Gem ${index+1} / ${p.league+1}</span><button class="text-button" data-action="league-select:${index+1}" ${!past?'disabled':''}>Next gem →</button></div>
 ${first?`<div class="league-victory"><span>🏆</span><div><strong>${esc(p.name)}, you’re number one!</strong><p>${past?'This win stays in your collection.':'Stay and enjoy it. There is no automatic promotion or countdown.'}</p></div></div>`:''}
 <section class="panel"><div class="league-title"><span>${past?'WINNING STANDINGS':'CURRENT STANDINGS'}</span><span>XP</span></div>${rows.map((r,i)=>`<div class="league-row ${r.you?'you':''}"><span class="rank">${i===0?'♛':i+1}</span><span class="rival-icon">${esc(r.icon)}</span><div><strong>${esc(r.name)}</strong><small>${r.you?past?'Your preserved first-place finish':'That’s you!':'Story character'}</small></div><b>${r.xp===null?'—':r.xp}</b></div>`).join('')}
 ${legacy?'<p class="quiet">You won this gem before the history feature existed. Your first-place achievement is known, but the final XP and complete standings were not saved.</p>':'<p class="quiet">Friendly make-believe opponents with fixed goals. Past scores stay exactly as they were when you advanced.</p>'}
 ${!past&&first?!win?'<button class="button primary wide" data-action="promote">Claim my crown · stay at #1 ♛</button>':`<div class="league-stay"><strong>♛ Crown collected · you’re still #1</strong><p>Keep playing here for as long as you like. Your 40 gems are already yours.</p><button class="button secondary" data-action="league-advance-request">When I’m ready: next gem →</button></div>`:past?'<button class="button secondary wide" data-action="league-current">Back to my current gem →</button>':'<button class="button primary wide" data-action="tab:maze">Earn XP in the labyrinth →</button>'}</section></section>`;
}
