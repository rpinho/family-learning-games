// Scene palettes are geometry/material parameters, not replacement game state.
export const MAZE_THEMES=[
 {id:'forest',name:'Emerald Garden',wall:[.39,.53,.44],trim:[.25,.41,.28],floor:[.34,.43,.35],sky:[.5,.78,.86],fog:[.18,.36,.32],outside:[.45,.7,.34],stone:1},
 {id:'desert',name:'Sunstone Ruins',wall:[.84,.59,.32],trim:[.67,.36,.18],floor:[.69,.51,.3],sky:[.58,.8,.95],fog:[.62,.4,.24],outside:[.92,.75,.44],stone:1},
 {id:'ice',name:'Crystal Glacier',wall:[.49,.76,.86],trim:[.31,.57,.77],floor:[.63,.8,.88],sky:[.67,.85,.99],fog:[.31,.52,.69],outside:[.91,.96,.99],stone:0},
 {id:'castle',name:'Amethyst Castle',wall:[.58,.43,.73],trim:[.37,.23,.54],floor:[.46,.39,.58],sky:[.84,.67,.9],fog:[.31,.24,.43],outside:[.65,.54,.78],stone:1},
 {id:'reef',name:'Coral Courtyard',wall:[.83,.47,.43],trim:[.63,.3,.32],floor:[.3,.61,.61],sky:[.4,.84,.9],fog:[.24,.46,.49],outside:[.91,.83,.64],stone:0},
 {id:'space',name:'Starlight Station',wall:[.3,.37,.58],trim:[.27,.73,.81],floor:[.21,.27,.42],sky:[.07,.1,.23],fog:[.1,.15,.28],outside:[.52,.56,.7],stone:0},
 {id:'lava',name:'Ember Fortress',wall:[.52,.29,.22],trim:[.96,.5,.15],floor:[.31,.27,.3],sky:[.93,.53,.33],fog:[.35,.2,.25],outside:[.61,.4,.26],stone:1},
 {id:'ocean',name:'Sapphire Harbor',wall:[.22,.53,.75],trim:[.13,.32,.58],floor:[.48,.65,.73],sky:[.53,.84,.96],fog:[.15,.38,.59],outside:[.86,.8,.58],stone:0},
 {id:'rose',name:'Rose Quartz Palace',wall:[.81,.45,.65],trim:[.6,.25,.49],floor:[.66,.46,.6],sky:[.94,.77,.87],fog:[.47,.28,.42],outside:[.79,.65,.78],stone:0},
 {id:'copper',name:'Copper Clockworks',wall:[.68,.46,.28],trim:[.23,.66,.6],floor:[.34,.4,.41],sky:[.6,.8,.77],fog:[.28,.4,.36],outside:[.57,.68,.54],stone:1},
 {id:'jade',name:'Jade Temple',wall:[.25,.64,.54],trim:[.13,.4,.36],floor:[.4,.58,.46],sky:[.74,.91,.78],fog:[.18,.4,.31],outside:[.47,.71,.36],stone:1},
 {id:'cloud',name:'Cloud Citadel',wall:[.7,.74,.93],trim:[.51,.45,.8],floor:[.65,.69,.83],sky:[.76,.87,1],fog:[.42,.49,.7],outside:[.87,.9,.98],stone:0}
];
export function mazeTheme(level){
 const n=Math.max(1,Math.floor(level)||1)-1,base=MAZE_THEMES[n%MAZE_THEMES.length],voyage=Math.floor(n/MAZE_THEMES.length)+1,variant=(voyage-1)%4,cycle=Math.floor((voyage-1)/4);
 const accents=[[1,.78,.3],[.35,.94,.85],[.87,.52,1],[.5,.8,1]],lamp=accents[variant];
 const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
 // Each return changes architecture/materials, not just the map seed. Later
 // voyages add a deterministic color accent without a finite content ending.
 const accent=accents[(variant+cycle)%4],t=cycle?Math.min(.3,.1+(cycle%5)*.04):0;
 return {...base,wall:mix(base.wall,accent,t),trim:mix(base.trim,lamp,variant*.12),sky:mix(base.sky,[[.9,.91,1],[.28,.4,.54],[.34,.22,.52],[.18,.45,.51]][variant],variant? .38:0),lamp,variant,voyage,cycle,wallHeight:1.7+variant*.12,material:variant===0?base.stone:variant+1,edition:['Open sky','Lantern walk','Twilight halls','Aurora galleries'][variant],sceneKey:`${base.id}:${voyage}`};
}
