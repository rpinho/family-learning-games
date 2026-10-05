// Story seeds rotate; standing cast and parent preferences are independent of these optional touches.
const STOP=new Set('a an the and or with for from his her he she they you your their this that one once small quick little loves likes stop treat theme seed story chapter can may about into through'.split(' '));
// The Book's own mechanics are on every page (magic words, number locks, counting, letters): a seed made of them
const MECHANICS='magic word words number numbers count counting counts letter letters spell spells read reads sound sounds'.split(' ');
const words=t=>String(t||'').toLowerCase().replace(/['’]/g,'').match(/[a-z]{3,}/g)?.filter(w=>!STOP.has(w))||[];
const text=l=>Array.isArray(l)?l[1]:l?.shown||l?.text||'';
export function seedMention(line,seed,ignore=[]){
 const t=words(text(line)),keys=[...new Set(words(seed))].filter(w=>!ignore.includes(w));
 return keys.some(k=>k.length>=7&&t.includes(k))||keys.filter(k=>t.includes(k)).length>=Math.min(keys.length>=6?3:2,keys.length)&&keys.length>0;
}
export function recentSeeds(previous=[]){const recent=previous.slice(-3);return {details:new Set(recent.flatMap(c=>c.meta?.details||[])),themes:new Set(recent.flatMap(c=>c.meta?.themes||[]))};}
export function detailIssues(story,plan){
 // (an adventure's own world words, its places and travel phrases, are on every route: "down the zigzag path" is
 // travel, not the new-trail theme again; 2026-10-02 the drafts failed every repair on those words)
 const ignore=words([plan.name,plan.sibling,...(plan.cast||[]).map(c=>c.name),'Dad Mom',...(plan.kitWords||[])].join(' ')).concat(MECHANICS),lines=(story.pages||[]).flatMap(p=>[...(p.say||[]),...(p.after||[]),...(p.magic?.after||[])]),out=[];
 for(const [kind,seeds] of [['detail',plan.details||[]],['theme',plan.themes||[]]])for(const s of seeds)if(lines.filter(l=>seedMention(l,s.seed,ignore)).length>1)out.push(`${kind} ${s.id||s.seed} occurs twice in a chapter: use its story touch only once`);
 for(const s of plan.blockedSeeds||[])if(lines.some(l=>seedMention(l,s.seed,ignore)))out.push(`recent ${s.id||s.seed} was used in the last three chapters: leave it out today`);
 return out;
}
