import {existsSync} from 'node:fs';
import {join} from 'node:path';

// A shortcut can arrive before its backend release. Check the immutable channel,
// never saves or network requests, so Home always returns immediately.
export function releasedShortcuts(selections, catalog, channelDir, exists=existsSync){
 if(!Array.isArray(selections))return [];
 return selections.filter(id=>{
  const card=catalog.find(c=>c.id===id);
  if(!card?.requiresFile)return true;
  if(!channelDir||!/^[-a-z0-9]+$/.test(card.game)||!/^[-a-z0-9./]+$/.test(card.requiresFile)||card.requiresFile.includes('..')||card.requiresFile.startsWith('/'))return false;
  return exists(join(channelDir,card.game,card.requiresFile));
 });
}
