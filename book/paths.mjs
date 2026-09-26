// Where the book reads and writes. Everything private lives outside the repository:
//   $FAMILY_DEPLOY_ROOT (default ~/.local/share/family-games)
//     deploy.json            game data directories (managed installs)
//     book/profiles.json     per-child profile: age, interests, companions, tricks, extra lint words
//     book/<player>/<date>.json|md|html   chapters     book/voice/   narration clips
//     learner/<player>.json  learner models
// Unmanaged installs fall back to FAMILY_CONFIG (hub config with gameData) and FAMILY_DATA.
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
const exp=p=>String(p).replace(/^~(?=\/|$)/,homedir());
export function bookPaths(env=process.env){
 const root=resolve(exp(env.FAMILY_DEPLOY_ROOT||join(homedir(),'.local/share/family-games')));
 let deploy=null;try{deploy=JSON.parse(readFileSync(join(root,'deploy.json'),'utf8'));}catch{}
 const data={};
 if(deploy?.games)for(const [id,g] of Object.entries(deploy.games))data[id]=exp(g.data);
 let config=null;
 const configFile=env.FAMILY_CONFIG||(data.hub&&join(data.hub,'config.json'));
 try{if(configFile)config=JSON.parse(readFileSync(configFile,'utf8'));}catch{}
 for(const [id,dir] of Object.entries(config?.gameData||{}))data[id]??=exp(dir);
 if(env.FAMILY_DATA)data.hub??=exp(env.FAMILY_DATA);
 const book=resolve(exp(env.FAMILY_BOOK||join(root,'book')));
 return {root,data,config,book,voice:join(book,'voice'),learner:resolve(exp(env.FAMILY_LEARNER||join(root,'learner'))),
  profiles:join(book,'profiles.json'),cast:join(book,'cast.json'),notes:data.hub?join(data.hub,'book-notes.json'):null,
  recap:resolve(exp(env.FAMILY_RECAP_DIR||join(homedir(),'.local/share/family-learning-games-recap'))),
  python:exp(env.FAMILY_BOOK_PYTHON||deploy?.python||'python3'),
  voiceModels:exp(env.FAMILY_VOICE_MODELS||(data['letter-quest']?join(data['letter-quest'],'voice-models'):'')),
  timeZone:env.FAMILY_TZ||Intl.DateTimeFormat().resolvedOptions().timeZone};
}
export function readProfiles(paths){try{return JSON.parse(readFileSync(paths.profiles,'utf8'));}catch{return {};}}
// The shared cast (a family's real toys), private: {cast:[{id,name,kind,emoji}], fixed:{player:[ids]}, perChapter:{early,reader}, allowNames:[]}
export function readCast(paths){try{const c=JSON.parse(readFileSync(paths.cast,'utf8'));return Array.isArray(c.cast)?c:null;}catch{return null;}}
export const localDate=(ms,timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
export function addDays(date,n){const [y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);}
export const exists=existsSync;
