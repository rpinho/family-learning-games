import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {clipName} from '../../hub/book-service.mjs';
import {certifyEpisode} from '../episodes/certify.mjs';
import {readLibrary} from '../generate.mjs';
// Synthetic WAVs and a controlled browser result keep unit tests deterministic;
// the real pointer/media audits run separately against the committed samples.
export async function certifyTestChapter(ch,{paths}){
 const result=await certifyEpisode(ch,{paths,library:readLibrary(paths),narrate:async lines=>{const clips={};await mkdir(paths.voice,{recursive:true});for(const l of lines){const f=clipName(l),wav=Buffer.alloc(1644);wav.write('RIFF',0);wav.writeUInt32LE(1636,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(1600,40);await writeFile(join(paths.voice,f),wav);clips[`${l.voice}|${l.speed}|${l.text}`]=f;}return {clips};},audit:async()=>({issues:[],playable:true,frames:12,viewports:[[1366,768],[390,844]]})});if(result.issues.length)throw Error(result.issues.join(' | '));return ch;
}
