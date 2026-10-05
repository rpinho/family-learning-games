// Every narration clip is played at one loudness, whoever speaks: the voices come from different engines and ran
// 15 LU apart (a friend's lines at -34 LUFS next to the narrator's -22 were hard to hear). The served copy of a clip
// (.webm, .m4a and the .wav fallback) is measured (EBU R128 integrated loudness) and gained to TARGET, with a
// lookahead limiter (delay compensated, so timing is unchanged) keeping peaks under CEILING. The source .wav in the
// voice store is never changed. REV names this levelling: it is part of the cached copy's name and of every clip
// URL (?r=), so a device that cached an unlevelled clip (immutable) fetches the levelled one.
// hub/scripts/check-loudness.mjs checks the served clips against TARGET within TOLERANCE.
import {execFile} from 'node:child_process';
export const LOUDNESS={target:-20,ceiling:-1.5,tolerance:1.5,rev:'L1'};
const run=args=>new Promise((ok,no)=>execFile('ffmpeg',args,{timeout:20000,maxBuffer:1<<22},(e,so,se)=>e?no(e):ok(String(se))));
// Integrated loudness (LUFS) and true peak (dBTP) of an audio file; null for silence or a clip too short to gate.
export async function loudness(file){
 const log=await run(['-hide_banner','-nostats','-i',file,'-af','ebur128=peak=true','-f','null','-']);
 const s=log.slice(log.lastIndexOf('Summary:')),I=Number(s.match(/I:\s+(-?[\d.]+)\s+LUFS/)?.[1]),P=Number(s.match(/Peak:\s+(-?[\d.]+)\s+dBFS/)?.[1]);
 return Number.isFinite(I)&&I>-70?{lufs:I,peak:Number.isFinite(P)?P:null}:null;}
// The gain that brings a clip to TARGET (bounded: a near-silent clip is not blown up into noise).
export const gainFor=lufs=>lufs==null?0:Math.max(-20,Math.min(24,LOUDNESS.target-lufs));
export const levelFilter=gain=>`volume=${gain.toFixed(2)}dB,alimiter=limit=${(10**(LOUDNESS.ceiling/20)).toFixed(4)}:level=false:latency=true`;
const ENC={m4a:['-c:a','aac','-b:a','64k','-movflags','+faststart'],webm:['-c:a','libopus','-b:a','64k','-application','audio'],wav:['-c:a','pcm_s16le','-ar','24000','-ac','1']};
// Writes the levelled copy of wav to out (format from ext); returns the gain applied.
export async function level(wav,out,ext){
 const m=await loudness(wav),gain=gainFor(m?.lufs);
 await run(['-loglevel','error','-y','-i',wav,'-af',levelFilter(gain),...ENC[ext],'-f',{m4a:'mp4',webm:'webm',wav:'wav'}[ext],out]);
 return gain;}
