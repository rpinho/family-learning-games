// Grown-up supplied starting points are kept apart from observed gameplay evidence.
import {readFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {safePrivatePath,writePrivateFile} from '../book/private-files.mjs';
import {randomUUID} from 'node:crypto';
import {buildLearner} from '../book/learner.mjs';
const bad=message=>Object.assign(Error(message),{status:400});
const ID=/^(?:beginner|explorer)(?:_[1-9]\d{0,3})?$/;
const text=(v,max=120)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x1f]/.test(v))throw bad('Use short plain text.');return v.trim();};
const list=v=>{if(!Array.isArray(v)||v.length>20)throw bad('Use up to 20 favourite things.');return [...new Set(v.map(x=>text(x,80)).filter(Boolean))];};
const json=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
export function onboardingStore({paths,onSave=async()=>{}}){
 const root=resolve(paths.root);let queue=Promise.resolve();
 const safe=file=>safePrivatePath(root,file);
 const write=(file,value)=>writePrivateFile(root,file,value);
 async function read(){await safe(paths.profiles);const profiles=await json(paths.profiles,{});return {children:Object.entries(profiles).filter(([id,p])=>ID.test(id)&&p?.name).map(([id,p])=>({id,name:p.name,age:p.age,grade:p.grade||'',skills:p.startingSkills||{letters:'starting',counting:p.countsTo||5,reading:p.track==='words'?'words':'starting',maths:p.mathTrack==='facts'?'tables':'starting'},interests:p.interests||[],favourites:p.favourites||[],placement:p.placement||null,photoCount:p.artReferences?.photos?.length||0,privateArt:p.artReferences?.enabled===true})),required:!Object.entries(profiles).some(([k,v])=>!k.startsWith('_')&&v?.name)};}
 async function saveChild(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw bad('Add a child first.');
  const name=text(input.name,60),grade=text(input.grade||'',40),age=input.age==null?null:Number(input.age);
  if(!name||age===null&&!grade||age!==null&&(!Number.isInteger(age)||age<2||age>18))throw bad('Enter a name and an age (2–18) or grade.');
  const s=input.skills;if(!s||!['starting','some','all','sounds'].includes(s.letters)||!['starting','words','sentences','books'].includes(s.reading)||!['starting','addition','subtraction','tables','division'].includes(s.maths)||!Number.isInteger(s.counting)||s.counting<0||s.counting>1000)throw bad('Choose the child’s starting skills.');
  const skills={letters:s.letters,counting:s.counting,reading:s.reading,maths:s.maths},interests=list(input.interests||[]),favourites=list(input.favourites||[]);
  let placement=null;if(input.placement!=null){const p=input.placement;if(!Array.isArray(p)||p.length!==4||p.some(x=>!['independent','help','later','skip'].includes(x)))throw bad('Complete or skip the four placement prompts.');placement={source:'grown-up-observation',answers:p,at:new Date().toISOString()};}
  if(input.privateArt!=null&&typeof input.privateArt!=='boolean'||input.removePhotos!=null&&typeof input.removePhotos!=='boolean')throw bad('Choose a photo preference.');
  const photos=input.photos||[];if(!Array.isArray(photos)||photos.length>3)throw bad('Choose up to three photos.');
  const decoded=photos.map(p=>{if(typeof p!=='string'||p.length>3e6)throw bad('Photo too large.');const m=p.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);if(!m)throw bad('Use PNG or JPEG photos.');const bytes=Buffer.from(m[2],'base64');if(bytes.length>2e6||bytes.toString('base64')!==m[2]||!(m[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw bad('Invalid photo.');return {bytes,ext:m[1]==='jpeg'?'jpg':'png'};});
  await safe(paths.profiles);await safe(paths.cast);await safe(join(paths.learner,'check.json'));await safe(join(paths.book,'photos','check.png'));
  const profiles=await json(paths.profiles,{}),cast=await json(paths.cast,{cast:[],children:{},allowNames:[]});
  let id=input.id;if(id!=null&&(!ID.test(id)||!Object.hasOwn(profiles,id)))throw bad('Choose an existing child.');
  if(!id){const preset=skills.reading==='starting'?'beginner':'explorer';let n=1;while(Object.hasOwn(profiles,preset+'_'+n))n++;if(n>9999)throw bad('Too many children.');id=preset+'_'+n;}
  const old=profiles[id]||{},refs=input.removePhotos?[]:[...(old.artReferences?.photos||[])];
  if(refs.length+decoded.length>3)throw bad('Remove existing photos before adding more (maximum three).');
  for(const p of decoded){const file='photos/'+id+'/'+randomUUID()+'.'+p.ext;await write(join(paths.book,file),p.bytes);refs.push(file);}
  const profile={...old,name,age,grade,world:skills.reading==='starting'?'small':'castle',track:skills.reading==='starting'?'letters':'words',level:skills.reading==='starting'?'early':'reader',reading:skills.reading==='books'?'open':'decodable',mathTrack:['tables','division'].includes(skills.maths)?'facts':'early',countsTo:Math.max(1,Math.min(20,skills.counting||3)),interests,favourites,
   startingSkills:{...skills,source:'grown-up-report'},placement,companions:old.companions||[{id:'bo',name:'Bo',kind:'a friend'}],onboarding:{version:1,updatedAt:new Date().toISOString()},artReferences:{enabled:input.privateArt===true,localOnly:true,photos:refs}};
  if(!cast.cast.length)cast.cast.push({id:'bo',name:'Bo',kind:'a friend',emoji:'🦊'});
  profiles[id]=profile;cast.children??={};cast.children[id]={...(cast.children[id]||{}),name,fixed:cast.children[id]?.fixed||[cast.cast[0].id],rotate:cast.children[id]?.rotate||[],interests,favourites,artReferences:profile.artReferences};
  const learnerFile=join(paths.learner,id+'.json');const existing=await json(await safe(learnerFile),null);
  const model=existing||buildLearner({player:id,name,profile,saves:{}});model.name=name;model.age=age;model.interests=[...new Set([...interests,...favourites])];model.onboarding={startingSkills:profile.startingSkills,placement};
  await write(paths.cast,JSON.stringify(cast,null,2)+'\n');await write(learnerFile,JSON.stringify(model,null,2)+'\n');await write(paths.profiles,JSON.stringify(profiles,null,2)+'\n');
  if(input.removePhotos)for(const file of old.artReferences?.photos||[])if(new RegExp('^photos/'+id+'/[a-f0-9-]+\\.(png|jpg)$').test(file))await unlink(await safe(join(paths.book,file))).catch(e=>{if(e.code!=='ENOENT')throw e;});
  await onSave(profiles);return {id,...await read()};
 }
 return {read,save(input){const task=queue.then(()=>saveChild(input));queue=task.catch(()=>{});return task;}};
}
