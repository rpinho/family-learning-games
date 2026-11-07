// Original small line-and-colour drawings. No fonts, imported assets or emoji pictures.
const wrap=body=>`<svg viewBox="0 0 180 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="#3e5348" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const path=(d,fill='none')=>`<path d="${d}" fill="${fill}"/>`,ellipse=(cx,cy,rx,ry,fill)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`,rect=(x,y,w,h,fill,rx=5)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const star=(cx,cy,R,r,fill)=>path('M'+Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,q=i%2?r:R;return `${(cx+q*Math.cos(a)).toFixed(1)} ${(cy+q*Math.sin(a)).toFixed(1)}`;}).join(' L')+'Z',fill);
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
 // Chapter nouns share Word Search art without expanding Word Blocks' lessons.
 turkey:()=>turkey()+ellipse(117,64,2,2,'#304637'),
 lantern:()=>path('M69 35V27q0-23 21-23t21 23v8')+path('M59 44h62l9 76H50Z','#f1d992')+path('M65 44v76m50-76v76')+path('M57 44 68 30h44l11 14Z','#91b4ae')+rect(47,120,86,13,'#91b4ae',4)+path('M86 106q-15-11 4-34 20 25 4 34Z','#daaa77')+path('M90 107v9'),
 treasure:()=>path('M35 75h110v54H35Z','#b98d62')+path('M31 60q0-31 26-31h66q26 0 26 31v10H31Z','#c69c6e')+path('M54 32v37m72-37v37M52 77v50m76-50v50')+path('M31 68h118v12H31Z','#edcf7a')+[[56,76],[78,74],[101,76],[125,74]].map(([x,y])=>ellipse(x,y,10,6,'#edcf7a')).join('')+rect(81,80,18,23,'#edcf7a',3)+ellipse(90,89,2,3,'#3e5348')+path('M90 92v4')+star(21,43,8,3,'#edcf7a')+star(157,28,9,4,'#edcf7a'),
 forest:()=>ellipse(90,132,76,9,'#d5e7db')+rect(25,78,11,50,'#b98d62')+path('M9 94 31 24l24 70Z','#a8bc95')+rect(139,77,11,51,'#b98d62')+path('M119 94 144 19l26 75Z','#9cba88')+rect(84,77,13,60,'#b98d62')+path('M54 102 90 7l37 95Z','#92ae87')+path('M69 70h43M19 72h23m91-2h23'),
 parade:()=>path('M12 131h156')+path('M45 72V20m0 0 29 8-29 15Z','#d58c85')+ellipse(42,57,12,14,'#d0a181')+path('M31 77q11-10 23 0l4 31H29Z','#91b4ae')+path('M33 108 24 129m25-21 12 18M32 81l-12 17m32-16 12 10')+ellipse(92,52,12,14,'#d0a181')+path('M80 73q12-10 24 0v32H80Z','#d8b982')+path('M84 105 75 128m24-23 13 22M82 78l-15 11m35-11 11 13')+rect(73,89,39,18,'#d58c85',3)+ellipse(92,89,19,5,'#f2eee0')+path('M79 82 89 90m18-8-10 8')+ellipse(142,56,12,14,'#d0a181')+path('M130 76q12-10 24 0v31h-24Z','#b5a5be')+path('M134 107 123 128m25-21 13 21m-29-46-13 13m33-13 10-20M160 61V18m0 0-25 9 25 15Z','#edcf7a'),
 phone:()=>rect(51,12,78,128,'#687e7d',12)+rect(59,25,62,94,'#d2e4df',4)+path('M79 19h22')+ellipse(90,130,4,4,'#f2eee0')+path('M76 45q-8 2-3 15 9 22 26 27 12 4 14-4l-12-10-6 6q-10-4-15-15l5-6Z','#91b4ae'),
 trail:()=>path('M17 140q-5-39 54-62 45-18 25-66h20q37 49-4 78-44 30-5 50Z','#e7dac0')+[[59,124,-25],[56,104,15],[87,90,45],[104,66,-10],[110,43,10]].map(([x,y,a])=>`<g transform="translate(${x} ${y}) rotate(${a})">${ellipse(0,0,4,8,'#a08059')+ellipse(0,-11,4,3,'#a08059')}</g>`).join('')+path('M17 96V83m-5 10 5 4 6-7M139 116v-14m-6 11 6 5 7-8','#9cba88'),
 golf:()=>ellipse(90,128,74,10,'#a8bc95')+ellipse(63,127,13,4,'#3e5348')+path('M63 126V18m0 0 34 11-34 14Z','#d58c85')+path('M146 21 114 106l-22 5v11h30l8-12-6-4 31-82Z','#97a8a7')+ellipse(89,118,10,10,'#f2eee0')+ellipse(86,115,1,1,'#9aafa5')+ellipse(93,119,1,1,'#9aafa5'),
 cart:()=>path('M24 39h19l14 63h76l18-49H47Z','#91b4ae')+path('M52 70h92m-86 16h80M70 54l5 47m17-47v47m23-47-5 47m-52 1-5 13h85')+ellipse(67,128,10,10,'#687e7d')+ellipse(127,128,10,10,'#687e7d')+ellipse(67,128,3,3,'#d5e7db')+ellipse(127,128,3,3,'#d5e7db'),
 star:()=>star(90,76,61,27,'#edcf7a'),
 sign:()=>rect(83,23,14,115,'#b98d62')+path('M33 28h98l23 21-23 21H33Z','#d8b982')+path('M147 81H49l-23 20 23 20h98Z','#a8bc95')+path('M59 49h66m-12-10 12 10-12 10M121 101H56m12-10-12 10 12 10'),
 lock:()=>path('M58 65V44q0-34 32-34t32 34v21h-14V44q0-19-18-19T72 44v21Z','#97a8a7')+rect(44,62,92,72,'#d8b982',10)+ellipse(90,90,9,10,'#3e5348')+path('M86 98 83 115h14l-3-17Z','#3e5348'),
 pack:()=>path('M47 61q-27 9-20 63l17 1m89-64q27 9 20 63l-17 1')+path('M75 33V22q15-19 30 0v11')+rect(43,31,94,105,'#91b4ae',22)+path('M52 71V57q0-17 18-17h40q18 0 18 17v14')+rect(56,81,68,42,'#d8b982',10)+path('M65 91h50m-5 0v10M90 43v29')+rect(83,63,14,12,'#e7dac0',2),
 clue:()=>path('M29 16h80l22 22v93H29Z','#f2eee0')+path('M109 16v22h22M42 51h39M42 64h31M42 113h42')+ellipse(104,76,29,29,'#d2e4df')+ellipse(104,76,22,22,'#f2eee0')+path('m122 98 30 29-9 9-29-30Z','#b98d62')+path('M94 69q10-14 19 0 3 7-8 12v7')+ellipse(105,98,1,1,'#3e5348'),
 // Long-word garden pictures, using the same small line-and-colour vocabulary.
 elephant:()=>rect(122,98,17,36,'#97a8a7',7)+rect(146,94,17,40,'#97a8a7',7)+ellipse(112,82,48,34,'#a7b6b5')+rect(74,100,18,34,'#a7b6b5',7)+rect(98,104,17,30,'#a7b6b5',7)+path('M158 74q12 4 9 20')+ellipse(58,66,27,26,'#a7b6b5')+path('M66 42q34 0 32 30-2 24-30 20q8-24-2-50Z','#bcc9c3')+path('M38 74q-12 26-2 50 5 7 11 2-8-20 4-44','#a7b6b5')+path('M44 86q6 10 16 8','#f4e4c4')+ellipse(50,60,2.6,2.6,'#304637'),
 mountain:()=>path('M15 130 70 24l34 61 24-37 40 82Z','#9aafa5')+path('m49 64 21-40 22 39-16-6-8 13-9-12Z','#f2eee0')+path('m116 68 12-20 14 29-14-7-9 6Z','#f2eee0')+path('M22 130h144'),
 starlight:()=>`<circle cx="90" cy="60" r="50" fill="#f7eecb" stroke="none"/>`+path('M90 6v10M90 104v10M36 60H26M154 60h-10M52 22l7 7M128 22l-7 7M52 98l7-7M128 98l-7-7','#edcf7a')+star(90,60,36,15,'#edcf7a')+ellipse(82,56,2.5,2.5,'#304637')+ellipse(98,56,2.5,2.5,'#304637')+path('M83 67q7 6 14 0')+star(30,26,9,4,'#edcf7a')+star(152,102,8,3.5,'#edcf7a')+star(26,108,6,2.5,'#edcf7a')+path('M8 146q82-44 164 0Z','#9cba88'),
 snowflake:()=>Array.from({length:6},(_,i)=>`<g transform="rotate(${i*60} 90 75)">${path('M90 75V19m0 20-14-13m14 13 14-13m-14 33-20-18m20 18 20-18','#b6d3d4')}</g>`).join('')+ellipse(90,75,6,6,'#d5e7db'),
 blueberry:()=>[[65,88],[115,91],[91,56]].map(([x,y])=>ellipse(x,y,27,27,'#8395b0')+path(`m${x-11} ${y-9} 8 2 4-8 4 8 8-2-5 8 4 5-10-1-8 3 2-8Z`,'#5f768f')).join('')+path('M86 29q-25-17-34-1 19 12 34 1Z','#9cba88'),
 playground:()=>path('M21 127 38 24h50l13 103M38 24l28 103M30 72h27m-30 18h34m-36 18h40')+path('M42 46h40q5 45 54 69v12h-22Q75 108 70 62H42Z','#d6b968')+path('M106 126 119 26h28l19 100M119 26l22 100M126 27v57m17-57v57')+rect(121,84,28,8,'#91b4ae',2),
 dragonfly:()=>ellipse(59,54,36,13,'#d2e4df')+ellipse(121,54,36,13,'#d2e4df')+ellipse(59,81,35,12,'#d2e4df')+ellipse(121,81,35,12,'#d2e4df')+path('M84 55h12l-2 77h-8Z','#92b0a1')+path('M85 77h10m-10 13h10m-10 13h10m-10 13h10')+ellipse(81,40,11,12,'#a8bc95')+ellipse(99,40,11,12,'#a8bc95')+ellipse(82,38,3,3,'#304637')+ellipse(98,38,3,3,'#304637'),
 dandelion:()=>path('M86 134 91 61m-5 60-34-20 7 16-17-3 12 17h31m3-17 27-25-3 16 17-5-9 19-33 10','#9cba88')+Array.from({length:16},(_,i)=>`<g transform="rotate(${i*22.5} 91 50)">${path('M91 50V20m0 0-6-5m6 5 6-5m-6 5v-8')}</g>`).join('')+ellipse(91,50,8,8,'#e7dec7'),
 sunflower:()=>path('M91 87v50m0-13q-36-2-37-26 30-1 37 26m0-12q32-2 35-26-30 1-35 26','#9cba88')+Array.from({length:12},(_,i)=>`<g transform="rotate(${i*30} 90 57)">${ellipse(90,29,10,20,'#edc763')}</g>`).join('')+ellipse(90,57,23,23,'#a08059')+[[80,49],[95,46],[101,59],[85,64]].map(([x,y])=>ellipse(x,y,2,2,'#e7c991')).join(''),
 caterpillar:()=>[40,62,84,106,128].map((x,i)=>path(`M${x} ${104-i*6}v19`)+ellipse(x,89-i*6,18,20,'#a8bc95')).join('')+ellipse(141,51,23,23,'#b9cb9d')+path('M132 29 127 16m21 14 8-14')+ellipse(135,47,2,3,'#304637')+ellipse(151,47,2,3,'#304637')+path('M136 58q8 9 15-1'),
 strawberry:()=>path('M46 59Q88 35 134 59q17 33-43 76Q32 98 46 59Z','#d58c85')+path('m55 55 15-15 13 7 9-18 9 18 17-8 9 19-25-1-10 14-11-15Z','#9cba88')+[[64,72],[86,82],[114,73],[71,98],[100,107],[91,121]].map(([x,y])=>path(`M${x} ${y}l-2 5`,'#edcf7a')).join(''),
 watermelon:()=>path('M24 47h132q-7 87-66 87T24 47Z','#9cba88')+path('M34 48h112q-8 72-56 73T34 48Z','#f2e6ca')+path('M43 48h94q-7 60-47 60T43 48Z','#d58c85')+[[59,65],[88,63],[119,65],[73,88],[105,88]].map(([x,y])=>ellipse(x,y,2,4,'#3e5348')).join(''),
 rainbow:()=>['#cf7964','#daaa77','#edc763','#9cba88','#85b5c1','#9d7999'].map((fill,i)=>path(`M${21+i*9} 113a${69-i*9} ${76-i*9} 0 0 1 ${138-i*18} 0`,'none').replace('/>',` stroke="${fill}" stroke-width="9"/>`)).join('')+path('M17 123q-12-14 3-19-4-20 16-13 18-8 21 12 20 3 8 20Z','#f2eee0')+path('M116 123q-12-14 3-19-4-20 16-13 18-8 21 12 20 3 8 20Z','#f2eee0'),
 penguin:()=>path('M59 76 36 106l24-5m61-25 23 30-24-5','#687e7d')+path('m72 123-19 12h31v-12m19 0v12h28l-16-12','#d8af76')+ellipse(90,78,35,51,'#687e7d')+ellipse(90,90,25,35,'#f2eee0')+ellipse(77,52,11,14,'#f2eee0')+ellipse(103,52,11,14,'#f2eee0')+ellipse(79,51,2,3,'#304637')+ellipse(101,51,2,3,'#304637')+path('m82 66 8 11 9-11Z','#d8af76'),
 dolphin:()=>path('M31 78Q58 26 109 53q25 9 38 27l19 8-24 8q-20 0-34-9-27 20-59 10l-11 19-21-1 8-15-16-11 17-5Z','#9dbfc1')+path('M75 53q5-26 23-26l-1 25M85 87l-8 25 27-19','#9dbfc1')+ellipse(136,78,3,3,'#304637')+path('M139 90q8 3 15 0M23 132q16-9 32 0t32 0t32 0t32 0','#85b5c1'),
 unicorn:()=>path('M56 146 62 100q2-46 44-54l44 26q10 12-2 22l-26-4-14 8 4 48Z','#f2eee0')+path('M100 46 110 6 116 48Z','#edcf7a')+path('M104 32l9-3M102 40l11-3')+path('M96 50l2-18 12 14Z','#f2eee0')+path('M62 100q-18-30 4-50 12-12 32-6-18 6-20 26-2 18-16 30Z','#b5a5be')+path('M60 120q-14-8-10-26 10 8 12 4','#b5a5be')+ellipse(118,68,3,3.5,'#304637')+ellipse(142,86,2,2,'#304637')+path('M128 96q6 4 12 0'),
 octopus:()=>Array.from({length:8},(_,i)=>{const x=38+i*15;return path(`M${71+i*5} 83Q${x} 106 ${x} 121q0 17 ${i<4?-13:13} 7`,'none').replace('/>',' stroke="#b59db8" stroke-width="12"/>');}).join('')+path('M57 85V59q0-35 33-35t33 35v26q-33 25-66 0Z','#b59db8')+ellipse(78,61,3,4,'#304637')+ellipse(102,61,3,4,'#304637')+path('M82 77q8 10 16 0'),
 squirrel:()=>path('M100 116q66 13 55-55-9-40-37-25-26 17 0 40 28 17 5 28Z','#c19a75')+ellipse(83,101,26,30,'#c19a75')+path('M66 61 62 29l18 17m13 1 17-17-2 34','#c19a75')+ellipse(86,65,24,24,'#c19a75')+ellipse(73,64,3,3,'#304637')+ellipse(61,74,3,3,'#304637')+path('M63 128h44M69 93l-17 13 20 9')+ellipse(57,103,10,13,'#d8af76')+path('M46 100h22m-11-8 3-5'),
 seahorse:()=>path('M112 33q-30-22-41 2L47 51l3 12 26-5q-12 22 3 45 16 26 32 13 15-16 0-22-13-5-10 9-13-1-12-12 30-29 11-49Z','#d8b982')+path('m101 44 19 14-14 9 16 9-18 10m-19-29 10 8-10 7 11 8-5 9')+ellipse(83,38,3,3,'#304637')+path('M63 44 48 51'),
 pineapple:()=>path('M67 48 45 22l31 12 3-22 14 23 21-23-3 25 30-13-28 28Z','#9cba88')+ellipse(90,91,38,46,'#d8b982')+path('M61 62 115 118M54 82l48 49M78 48l49 51M119 61 65 119m62-38-48 49m24-82-49 52'),
 honeybee:()=>ellipse(74,45,17,27,'#d2e4df')+ellipse(104,45,17,27,'#d2e4df')+ellipse(91,87,43,30,'#edc763')+path('M70 62q-12 25 0 50m21-55q-12 30 0 59m23-54q-10 25 0 48M48 85 33 93l16 4','#687e7d')+ellipse(131,74,19,20,'#d8b982')+path('M129 54 122 41m17 15 9-12M75 113l-7 14m36-15 5 15')+ellipse(138,72,3,3,'#304637'),
 firefly:()=>ellipse(92,108,21,23,'#f1d992')+Array.from({length:7},(_,i)=>{const t=(i+1)*Math.PI/4;return path(`M${92+30*Math.cos(t)} ${108+29*Math.sin(t)}l${9*Math.cos(t)} ${9*Math.sin(t)}`);}).join('')+path('M83 51Q39 21 44 72l39 27m18-48q44-30 39 21l-39 27','#d2e4df')+ellipse(92,72,13,27,'#839881')+ellipse(92,39,14,13,'#a8bc95')+path('M86 28 77 16m21 12 9-12M79 67 61 62m44 5 18-5M79 82 62 90m43-8 17 8')+ellipse(87,38,2,2,'#304637')+ellipse(97,38,2,2,'#304637'),
 chameleon:()=>path('M64 93q-54-16-42 23 10 28 30 11 16-17-4-22-14-1-10 10')+ellipse(90,77,41,24,'#a8bc95')+path('m63 59 9-13 9 8 10-14 10 13 11-11 5 16M115 65l17-24 24 28-6 22-31-1Z','#a8bc95')+path('M69 95v24l-11 5m43-29v24l12 5M36 136h122')+ellipse(138,66,10,10,'#d6d6a5')+ellipse(140,66,3,3,'#304637')+path('M138 82h15'),
 tangerine:()=>ellipse(79,78,43,37,'#daaa77')+path('M79 41v-9m0 4q24-24 40-5-18 13-40 5Z','#9cba88')+path('M57 53q-16 20-11 33M73 53q-13 27-2 50')+path('M111 97q27-2 40 22-24 24-48-1Z','#edc763')+path('m111 97 10 22 30 0m-30 0-18-1'),
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

function turkey(){return path('M55 95Q7 45 37 29q24-13 38 13 1-42 26-35 28 7 13 40 28-24 43-3 22 29-34 54Z','#b99676')+path('M69 82 40 39m48 40 5-59m9 60 40-34')+ellipse(93,98,32,28,'#8d7963')+ellipse(113,67,14,19,'#b4c2b6')+path('m126 68 15 7-15 3Z','#dbb960')+path('M119 80q15 23 0 20Z','#c87565')+path('M85 126v12m21-12v12');}
