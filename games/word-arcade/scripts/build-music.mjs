// Original arithmetic compositions. No recordings, samples, or borrowed melodies.
import {writeFile,mkdir} from 'node:fs/promises';
const rate=22050,seconds=16,beats=32;
const themes={pixel:[60,64,67,72,67,64,62,67],bubbles:[65,69,72,76,72,69,67,72],epic:[48,55,60,63,58,55,51,58],stardrift:[57,64,69,71,76,71,69,64]};
await mkdir(new URL('../public/audio/',import.meta.url),{recursive:true});
for(const [name,notes]of Object.entries(themes)){
 const data=Buffer.alloc(rate*seconds*2),samples=data.length/2;
 for(let n=0;n<samples;n++){
  const t=n/rate,b=t*beats/seconds,k=Math.floor(b),phase=b-k;
  const f=440*2**((notes[k%notes.length]-69)/12),bass=440*2**((notes[Math.floor(k/4)%notes.length]-81)/12);
  const env=Math.min(1,phase*30)*Math.exp(-phase*3.5),fade=Math.min(1,t*10,(seconds-t)*10);
  const lead=Math.sin(2*Math.PI*f*t)+.2*Math.sin(4*Math.PI*f*t);
  const low=Math.sin(2*Math.PI*bass*t)*(.5+.5*Math.cos(2*Math.PI*phase));
  const kick=k%2===0?Math.sin(2*Math.PI*(60*t+8*(1-Math.exp(-phase*10))))*Math.exp(-phase*18):0;
  const sample=(.18*lead*env+.1*low+.06*kick)*fade;
  data.writeInt16LE(Math.round(Math.max(-.8,Math.min(.8,sample))*32767),n*2);
 }
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(data.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
 await writeFile(new URL('../public/audio/'+name+'.wav',import.meta.url),Buffer.concat([h,data]));
}
