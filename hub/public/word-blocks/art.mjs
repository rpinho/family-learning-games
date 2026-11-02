// Original small line-and-colour drawings. No fonts, imported assets or emoji pictures.
const wrap=body=>`<svg viewBox="0 0 180 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="#3e5348" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const path=(d,fill='none')=>`<path d="${d}" fill="${fill}"/>`,ellipse=(cx,cy,rx,ry,fill)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`,rect=(x,y,w,h,fill,rx=5)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
export function animal(subject,{action='sat',red=false}={}){
 const fill=red?'#d74748':({fox:'#d88c4d',dog:'#d0a879',cat:'#b9bec3',pig:'#eebbb2',hen:'#f4e4b6',rat:'#acaaa5',cub:'#ad805a',ram:'#e7dec7',pup:'#d0a879'}[subject]||'#e7dec7');
 const running=action==='ran',legs=running?path('M65 109 48 130M81 109 95 126M108 107 128 121'):path('M66 106V130H79M101 106V130H114');
 if(subject==='hen')return ellipse(91,96,33,28,fill)+path('M62 92 43 68 42 107Z',fill)+ellipse(110,64,20,22,fill)+path('m129 63 15 9-17 4Z','#e4b657')+path('M102 43q-3-18 6-10 8-12 12 2l-4 10','#c96656')+ellipse(116,59,2,2,'#304637')+(running?path('m84 124-14 10m29-10 13 8'):path('M85 123v13m16-13v13'));
 return legs+ellipse(88,94,34,27,fill)+path(subject==='fox'?'M57 99Q13 89 30 55Q37 87 64 82':'M57 97Q28 100 33 78',subject==='fox'?fill:'none')+
  (subject==='pig'?path('M70 61 64 39 84 52M104 51 119 39 117 67',fill):subject==='dog'||subject==='pup'?path('M71 53Q44 43 57 88L77 70M106 52q29-10 17 35l-17-16',fill):path('M68 62 65 32 86 50M100 50 117 32 119 67',fill))+
 ellipse(93,69,29,26,fill)+ellipse(82,65,2,3,'#304637')+ellipse(104,65,2,3,'#304637')+
 (subject==='pig'?ellipse(95,81,14,9,'#db9f94')+ellipse(90,81,1,2,'#304637')+ellipse(100,81,1,2,'#304637'):path('m89 78 6 4 5-4Z','#3e5348')+path('M95 82v6m-8-1q8 8 16 0'))+
 (subject==='cat'?path('M73 79 48 74m24 12-25 3m65-10 24-5m-24 12 25 3'):'');
}
const drawings={
 fish:()=>ellipse(91,78,44,28,'#9dbfc1')+path('M48 78 22 48v60Z','#d4ba75')+path('m78 52 16-18 14 20m-29 48 18 15 10-18','#d4ba75')+ellipse(116,70,3,3,'#304637')+path('M123 83q-6 6-12 0M92 58q-13 20 0 39'),
 sun:()=>ellipse(90,75,30,30,'#edc763')+Array.from({length:12},(_,i)=>{const t=i*Math.PI/6;return path(`M${90+42*Math.cos(t)} ${75+42*Math.sin(t)}l${12*Math.cos(t)} ${12*Math.sin(t)}`);}).join(''),
 top:()=>path('M88 25h10v28H88Z','#d8af76')+path('M49 77Q92 28 135 77L92 126Z','#6f9f98')+path('M49 77h86m-71 18h54m-42 16h30'),
 cup:()=>ellipse(86,125,56,8,'#a4bdb0')+path('M42 55h83l-13 44q-25 27-50 0Z','#e8ddd0')+path('M125 61h12q24 20-17 28')+ellipse(84,55,41,8,'#f6eee1'),
 mug:()=>path('M51 39h63v66q0 22-32 22t-31-22Z','#7799a8')+path('M114 52h17q27 26-14 38')+ellipse(82,39,31,7,'#e7e9dc'),
 mat:()=>path('M27 111 53 54h97l-23 57Z','#daaa77')+path('M43 102h89M49 88h89M55 74h89M54 54l-27 57m44-57-25 57m44-57-25 57m44-57-25 57'),
 rug:()=>path('M25 118 49 32h108l-24 86Z','#9dada3')+path('M44 102 59 47h77l-15 55Z','#d3a28d')+path('m91 59 15 16-24 17-15-16Z','#e7c991')+Array.from({length:8},(_,i)=>path(`M${25+i*13} 118l-3 10M${49+i*13} 32l3-10`)).join(''),
 pan:()=>ellipse(73,85,43,26,'#687e7d')+path('M113 75 157 54l8 13-50 25Z','#b58a58')+ellipse(73,80,34,18,'#b7c4be'),
 man:()=>ellipse(90,36,15,17,'#d0a181')+path('M67 66q23-17 46 0v37H67Z','#7d9fa4')+path('M70 68 51 95m58-27 20 27M78 104l-8 31m33-31 10 31'),
 map:()=>path('m31 40 39 9 38-12 41 10v78l-41-10-38 12-39-9Z','#eee0b1')+path('M70 49v78m38-90v78')+path('m43 98 20-28 31 25 35-28')+ellipse(129,67,6,6,'#cf7964'),
 pin:()=>ellipse(92,43,15,15,'#cb7760')+path('M92 59v68m-6-8 6 8 5-8'),
 tin:()=>rect(36,60,87,65,'#aeb9af')+ellipse(80,60,44,13,'#62796d')+path('M37 92h84')+ellipse(139,57,16,38,'#dce0cb')+ellipse(140,57,10,30,'#bbc5b6'),
 pot:()=>path('M53 61h74v41q0 30-37 30t-37-30Z','#ba8d64')+path('M53 72H36v24h17m74-24h17v24h-17M48 61h83')+ellipse(90,57,38,8,'#d5ab7b')+rect(81,39,18,14,'#92704d'),
 mop:()=>path('M103 17 77 96')+path('M61 92h33v13H58Z','#98afa0')+path('M59 103q-16 15-18 31h64q-2-18-14-31Z','#e7dac0')+path('M61 107q-9 13-9 27m17-26-5 26m15-26 1 26m7-27 6 27'),
 bud:()=>path('M88 133V81m0 24q-39-30-32-40 25 2 32 25m2 26q30-31 36-21-12 24-36 28','#9cba88')+path('M89 83Q52 57 71 27q11 20 17 15 14-28 25-12 12 28-24 53Z','#d38d89'),
 bun:()=>path('M40 97Q41 42 90 42t50 55Z','#d8a367')+path('M40 97v12h100V97M68 57l-7 20m29-24-6 23m28-17-7 19'),
 net:()=>path('M35 50Q30 108 79 116q22-21 16-66Z','#dce6c9')+path('M43 60 83 106M59 61 91 96M37 78h58m-49 18h42M50 60l-3 30m20-30v49m16-49-1 45')+ellipse(65,50,34,13,'#e6e3ca')+path('M96 54 148 127m-2-4-9 7'),
 pen:()=>path('m53 125 9-33 65-68 17 17-65 68Z','#739b9c')+path('m62 92 17 17m-26 16 13-4M124 28l-9-9-32 34'),
 hat:()=>ellipse(90,112,65,15,'#b99d67')+path('M50 107 59 43q33-14 62 0l9 64Z','#d7b77b')+path('M55 83h70v17H53Z','#7e9b8e'),
 bat:()=>path('M78 72Q40 30 18 70l18 7 1 19 23-2 24 22h16l25-22 22 2 2-19 15-7q-20-40-62 2l-1-24-11 11-13-12Z','#8c94ab')+ellipse(86,78,2,2,'#f4edd8')+ellipse(97,78,2,2,'#f4edd8'),
 cap:()=>path('M38 91Q36 35 88 35t49 56Z','#8da9a5')+path('M87 86q32-7 68 8l-4 14H82Z','#6f8c88')+path('M89 39v45'),
 can:()=>rect(53,34,74,91,'#c5c8b8')+ellipse(90,34,37,9,'#e8ead7')+path('M54 60h72m-72 43h72M55 48h70m-70 64h70'),
 fan:()=>ellipse(90,66,47,47,'#d4e0d2')+path('M90 66q-48-47-9-43 25 1 9 43m0 0q65-16 42 16-15 22-42-16m0 0q-5 62-27 30-18-23 27-30','#8ca8a0')+ellipse(90,66,7,7,'#d8b982')+path('M90 113v17m-26 3h52'),
 van:()=>rect(28,49,123,66,'#9daf8e',10)+rect(103,58,35,28,'#d8e9de')+rect(41,61,45,25,'#d8e9de')+ellipse(56,116,14,14,'#61776f')+ellipse(128,116,14,14,'#61776f'),
 bag:()=>path('M49 57h82l9 73H40Z','#d3ad7c')+path('M68 58V39q22-29 43 0v19'),
 tag:()=>path('M38 69 76 34h63v74H76Z','#e7c384')+ellipse(59,69,5,5,'#f9f1dd')+path('M56 67q-50-22-35-39 15-18 38 2'),
 jam:()=>rect(53,45,75,83,'#b97786')+rect(49,31,83,18,'#b0bba1')+rect(65,67,51,37,'#f2e4c9')+ellipse(91,86,10,9,'#bc6b71')+path('m90 77 5-8'),
 wig:()=>path('M42 123Q25 41 71 29q53-32 75 31l-6 61-31-9V65q-25 13-37 0v52Z','#aa7e65')+path('M49 116q-9-51 16-66m70 66q10-55-20-69'),
 fig:()=>path('M89 26q-6 24-27 42-33 51 27 60 62-8 28-60-22-17-20-42Z','#9d7999')+path('M96 31v-9'),
 lip:()=>path('M33 77q27-36 57-13 29-23 58 13-56 52-115 0Z','#d58c85')+path('M33 77q57 20 115 0'),
 box:()=>path('M42 58 90 35l51 23v66l-51 14-48-14Z','#c69c6e')+path('M42 58 90 80l51-22M90 80v58m-24-94 51 22v20'),
 log:()=>path('M37 54 131 78v44l-95-22Z','#b98d62')+ellipse(132,100,20,24,'#dec199')+ellipse(132,100,10,14,'#cfa878')+path('M45 69 107 87m-57-1 55 14'),
 nut:()=>path('M53 64q-1 61 39 65 44-8 37-65Z','#bc9566')+path('M47 66q43-66 86 0Z','#9ca383')+path('M92 33v-13m-18 62 5 29m29-30-5 31'),
 hut:()=>rect(46,68,90,63,'#d8c393')+path('M26 69 90 18l65 51Z','#b89a6d')+rect(77,91,26,40,'#8d9c7a'),
 tub:()=>path('M30 73h122l-16 56H47Z','#a0bfbb')+path('M28 73h127M51 130v8m80-8v8M56 70V41q0-20 19-20 17 0 17 15'),
 bus:()=>rect(20,39,140,78,'#e0bd68',12)+[33,62,91,120].map(x=>rect(x,50,22,30,'#d5e7db',2)).join('')+ellipse(51,119,14,14,'#65766c')+ellipse(131,119,14,14,'#65766c'),
 bed:()=>path('M30 66v68m123-68v68')+rect(30,66,123,51,'#baa481')+rect(36,61,40,19,'#f2e6ca')+path('M76 69h76v43H76Z','#95b1a5'),
 leg:()=>path('M73 22h37l-4 68 27 27q12 15-5 17H67q-9-7 0-17l10-26Z','#d4aa8b')+path('M75 81h31'),
 peg:()=>path('M63 20h39l14 111H77Z','#c1aa7d')+path('M76 45h27l6 77H83Z','#e8d5ad')+ellipse(91,77,8,8,'#6f877c'),
 jet:()=>path('M85 18h10l8 49 58 26v12l-60-10-2 28 19 14H63l19-14-2-28-60 10V93l58-26Z','#a0b5b7'),
};
drawings.rat=()=>path('M58 110Q7 111 20 83')+ellipse(91,99,34,25,'#b1aaa3')+path('M85 88q-4-36 19-34l37 28-28 21Z','#b1aaa3')+ellipse(97,59,13,15,'#d3b8af')+ellipse(121,76,2,3,'#344e43')+ellipse(140,84,3,3,'#344e43')+path('M74 120v12m31-12v12m21-44 25 9m-25-7 26-4');
for(const subject of ['cat','fox','dog','pig','hen','ram','cub'])drawings[subject]=()=>subject==='cub'?animal('cub')+ellipse(68,45,11,12,'#ad805a')+ellipse(117,45,11,12,'#ad805a'):subject==='ram'?animal('ram')+path('M65 61q-25-31-23 1 8 19 21 0M118 61q26-31 24 1-8 19-22 0'):animal(subject);
export const picture=word=>{if(!drawings[word])throw Error('No reviewed picture: '+word);return wrap(drawings[word]());};
export const hasPicture=word=>Object.hasOwn(drawings,word);
export function scenePicture(scene){
 if(scene.word)return picture(scene.word);
 if(!['cat','fox','dog','pig','hen'].includes(scene.subject)||!['sat','ran','wet','red'].includes(scene.action))throw Error('Unknown picture');
 let body=rect(5,5,170,140,'#edf0df',14)+path('M13 133h154')+animal(scene.subject,{action:scene.action,red:scene.action==='red'});
 if(scene.action==='sat')body+=path('M57 131h64v8H57Z','#c7ad88');
 if(scene.action==='ran')body+=path('M29 115h20m-27-12h20m-9 25h15');
 if(scene.action==='wet')body+=path('M20 25 16 38m28-13-4 13m28-13-4 13m28-13-4 13m28-13-4 13m28-13-4 13m28-13-4 13','#85b5c1')+ellipse(90,137,56,6,'#b7d6d2');
 return wrap(body);
}
export const coin=()=>wrap(ellipse(90,75,55,55,'#d6b968')+ellipse(90,75,45,45,'#edd99a')+path('M65 94V59l25-15 25 15v35l-25 15Z','#9cae89')+path('m70 76 13 14 25-29'));
export const shelfPicture=activity=>activity==='coins'?coin():activity==='sentences'?scenePicture({subject:'fox',action:'ran'}):picture('cup');
