// One pronunciation map for every spoken line (the book, its chapter generator, the living book, any game that
// voices a friend's name): names the voice must never guess from their spelling go to it as explicit Kokoro
// phonemes ([[...]]). The household can add or override names in its private cast.json ("pronounce").
//  - Pip: PEE-ka. Pip-pi: PEE-ka-PEE (spelled, the "pi" came out as "pie").
//  - Picos: European Portuguese, stress on the i, /ˈpi.kuʃ/ (PEE-koosh).
export const PRONOUNCE={Bo:'bˈoʊ',Pip:'pˈɪp'};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function table(extra){const m={...PRONOUNCE,...(extra||{})};const names=Object.keys(m).sort((a,b)=>b.length-a.length);
 return {m,re:names.length?new RegExp(`(\\[\\[[^\\]]*\\]\\])|\\b(${names.map(esc).join('|')})\\b`,'gi'):null,lower:Object.fromEntries(names.map(n=>[n.toLowerCase(),m[n]]))};}
// The text as the voice must say it: every mapped name becomes its phonemes (text already in [[...]] is kept).
export function phonemize(text,extra){const {re,lower}=table(extra);if(!re)return String(text);
 return String(text).replace(re,(all,ph,name)=>ph?ph:`[[${lower[name.toLowerCase()]}]]`);}
// Names that would reach the voice as raw spelling (for the lint and the narration gate).
export function rawNames(text,extra){const {re}=table(extra);if(!re)return [];const out=[];
 for(const m of String(text).matchAll(re))if(!m[1])out.push(m[2]);return out;}
// Words for display (captions, the words shown when a line cannot be heard): phonemes back to spelling.
export function unphonemize(text,extra){const {m}=table(extra);const back=Object.fromEntries(Object.entries(m).map(([n,p])=>[p,n]));
 return String(text).replace(/\[\[([^\]]*)\]\]/g,(all,p)=>back[p]||'').replace(/\s+([,.!?])/g,'$1').replace(/\s{2,}/g,' ').trim();}
