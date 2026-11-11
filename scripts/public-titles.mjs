import {readFileSync} from 'node:fs';
import {CATALOG,FAMILIES} from '../hub/public/catalog.mjs';
import {SHORTCUTS} from '../hub/public/home-shortcuts.mjs';

// Game names belong to the catalog; product and section titles belong to the README.
// Match full titles only, never approve their individual words as people's names.
export const publicTitles=[...new Set([
 ...CATALOG.map(item=>item.name),...Object.values(FAMILIES).flat().map(item=>item.name),...SHORTCUTS.map(item=>item.name),
 ...[...readFileSync(new URL('../README.md',import.meta.url),'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(match=>match[1]),
])].sort((a,b)=>b.length-a.length);
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=new RegExp('(?<![\\p{L}\\p{M}0-9])(?:'+publicTitles.map(escape).join('|')+')(?![\\p{L}\\p{M}0-9])','giu');
export function titleSpans(text){return [...text.matchAll(pattern)].map(match=>[match.index,match.index+match[0].length]);}
