const IDEAS=[
 ['people','Draw your family.'],['people','Draw two people together.'],['people','Draw a family portrait.'],['people','Draw you and someone you love.'],['people','Draw a funny face.'],['people','Draw someone dancing.'],
 ['nature','Draw a tree. Any kind you like.'],['nature','Draw a garden.'],['nature','Draw a sun. Make it your own.'],['nature','Draw a flower. Make it your own.'],['nature','Draw an animal outside.'],
 ['places','Draw your house.'],['places','Draw a playground.'],['places','Draw a room you like.'],['places','Draw a place you want to visit.'],
 ['things','Draw your favorite food.'],['things','Draw a vehicle.'],['things','Draw a toy.'],['things','Draw something you love.'],
 ['imagination','Draw a friendly monster.'],['imagination','Draw a tiny world.'],['imagination','Draw something that can fly.'],['imagination','Draw a surprise.'],['imagination','Draw a dream.'],
];
export const DRAWING_IDEAS=IDEAS.map(x=>x[1]);
const GROUPS={person:'people',face:'people','family picture':'people','two people':'people','family portrait':'people',tree:'nature',flower:'nature',sun:'nature',house:'places'};
export function drawingIdeasFor(art){
 const recent=[art?.lastGuess?.childLabel,art?.lastGuess?.label,...(art?.history||[]).toReversed().filter(x=>x.kind==='child_label').map(x=>x.label)].find(x=>GROUPS[x]);
 if(!recent)return DRAWING_IDEAS;
 const group=GROUPS[recent];
 return [...IDEAS.filter(x=>x[0]===group),...IDEAS.filter(x=>x[0]!==group)].map(x=>x[1]);
}
export const drawingModes=player=>player==='beginner'?['trace','shapes']:['trace','shapes','missions'];
export const initialDrawingMode=()=> 'trace';
