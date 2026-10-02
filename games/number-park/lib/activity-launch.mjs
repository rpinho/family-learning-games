// A shortcut uses the selected profile's existing permissions and save client.
// Any game listed for that profile can be opened directly (home shortcuts:
// Cookie Monster, Pattern Parade, Take Away); another profile's game cannot.
import {gamesFor} from './math.mjs';
export function launchActivity(search, profile) {
 const q=new URLSearchParams(search);
 if(q.get('studio')==='1'||q.get('tab')&&q.get('tab')!=='play')return null;
 const game=q.get('play');
 return game&&profile&&gamesFor(profile).some(g=>g.id===game)?game:null;
}
export async function openActivity(game,profile,start) {
 if(!game)return false;
 // Reopen an unfinished round of that game instead of replacing it on every home visit.
 if(profile.session?.game===game&&!profile.session.finished)return true;
 return !!await start(game);
}
