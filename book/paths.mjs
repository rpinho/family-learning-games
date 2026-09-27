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
  timeZone:env.FAMILY_TZ||Intl.DateTimeFormat().resolvedOptions().timeZone,
  // Letter sounds: the family's shared recordings, processed and checked by word-arcade's scripts (soundout.py and
  // letter_sound_check.py) from the same channel's installed word-arcade (live unless FAMILY_CHANNEL says staging).
  letterSounds:resolve(exp(env.FAMILY_LETTER_SOUNDS||join(root,'letter-sounds'))),
  soundout:[env.FAMILY_SOUNDOUT&&exp(env.FAMILY_SOUNDOUT),join(root,env.FAMILY_CHANNEL==='staging'?'staging':'live','word-arcade','scripts'),join(homedir(),'dev','word-arcade','scripts')].find(d=>d&&existsSync(join(d,'soundout.py')))||null};
}
export function readProfiles(paths){try{return JSON.parse(readFileSync(paths.profiles,'utf8'));}catch{return {};}}
// The shared cast (a family's real toys), private: {cast:[{id,name,kind,emoji}], children:{player:{fixed,rotate,perChapter,weights?}}, allowNames:[]}
export function readCast(paths){try{const c=JSON.parse(readFileSync(paths.cast,'utf8'));return Array.isArray(c.cast)?c:null;}catch{return null;}}
export const localDate=(ms,timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
export function addDays(date,n){const [y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);}
export const exists=existsSync;
// Named voices (the household's cast.json "voices": {"rook": "am_michael"}): a role whose voice is "@rook" uses that
// one value everywhere (the book's Dad, the living book's grown-up, the chess coach), so a voice swap is one line
// plus a re-render of the missing clips.
export const NAMED_VOICES={rook:'am_michael'};
export const resolveVoice=(v,named={})=>v&&typeof v.voice==='string'&&v.voice.startsWith('@')?{...v,voice:named?.[v.voice.slice(1)]||NAMED_VOICES[v.voice.slice(1)]||'am_michael'}:v;
export const resolveVoices=(voices,named={})=>Object.fromEntries(Object.entries(voices||{}).map(([k,v])=>[k,resolveVoice(v,named)]));
// What narrate.py needs to voice letter sounds (added to every narration request).
export const soundSource=paths=>({letter_sounds:paths.letterSounds,soundout:paths.soundout});
