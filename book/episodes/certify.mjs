import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {clipName} from '../../hub/book-service.mjs';
import {checkEpisode} from './format.mjs';
import {auditEpisode} from './audit.mjs';
import {speechLines,attachClips} from '../assemble.mjs';
export function episodeDigest(ep){const {checks,...data}=ep;return createHash('sha256').update(JSON.stringify(data)).digest('hex');}
export async function certifyEpisode(ch,{paths,library,narrate,audit=auditEpisode,noVoice=false}={}){
 const ep=ch.episode,proof=checkEpisode(ep,{library,...ep.learning,lines:ep.lines});if(proof.issues.length)return proof;
 if(noVoice){ep.checks={...proof,certified:false};return ep.checks;}
 try{try{const rendered=await narrate(speechLines(ch),{paths});attachClips(ch,rendered.clips);}catch{attachClips(ch,Object.fromEntries(speechLines(ch).map(l=>[`${l.voice}|${l.speed}|${l.text}`,clipName(l)])));}const voices=await verifyEpisodeVoices(ch,{paths});if(voices.length)return {...proof,issues:voices};const browser=await audit(ch,{paths,library});if(browser.issues.length)return {...proof,issues:browser.issues};
  const checks={...proof,certified:true,voices:Object.keys(ep.lines).length,browser:{viewports:browser.viewports,frames:browser.frames,playable:browser.playable},digest:episodeDigest(ep)};ep.checks=checks;return checks;
 }catch(e){return {...proof,issues:['Quest certification: '+e.message]};}
}
export async function verifyEpisodeVoices(ch,{paths}){const issues=[];for(const [key,l]of Object.entries(ch.episode.lines||{})){if(!/^[a-f0-9]{16}\.wav$/.test(l.clip||'')){issues.push('Missing recorded sentence '+key);continue;}try{const bytes=await readFile(join(paths.voice||join(paths.book,'voice'),l.clip));if(bytes.length<=44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')issues.push('Invalid recorded sentence '+key);}catch{issues.push('Missing recorded bytes '+key);}}return issues;}
export async function verifyQuestPublication(ch,{paths}){if(!ch.episode)return;const ep=ch.episode,c=ep.checks;if(!c?.certified||c.digest!==episodeDigest(ep)||c.issues?.length||!c.browser?.playable||c.browser.viewports?.length<2)throw Error('Quest needs a current state proof, recorded voices and both viewport audits before publishing.');const proof=checkEpisode(ep,{...ep.learning,lines:ep.lines});if(proof.issues.length)throw Error(proof.issues.join(' | '));const voices=await verifyEpisodeVoices(ch,{paths});if(voices.length)throw Error(voices.join(' | '));}
