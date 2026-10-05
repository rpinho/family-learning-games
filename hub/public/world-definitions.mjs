// Fictional demo worlds. Original public cast and placeholder scenery only.
import {isFamilyWord,canSoundOut} from './word-families.mjs';
// Authored geography, requests and rewards. The server owns every item and lock.
const ROOMS={
 'castle-gate':{name:'Castle gate',icon:'🏰',friend:'dad',exits:{left:'chess-courtyard',right:'castle-forest',bottom:'castle-moon-hill'},exitRequires:{bottom:'bridge'}},
 'chess-courtyard':{name:'Chess courtyard',icon:'♞',friend:'bo',gate:'chess',door:{to:'library-tower',label:'Library tower',wide:[.22,.28,.08,.12],tall:[.2,.25,.10,.09]},exits:{left:'soccer-pitch',right:'castle-gate'}},
 'soccer-pitch':{name:'Soccer pitch',icon:'⚽',friend:'pip',gate:'score',gates:['score','kick'],exits:{left:'treehouse-town',right:'chess-courtyard',bottom:'castle-forest'},exitRequires:{bottom:'score'}},
 'treehouse-town':{name:'Treehouse town',icon:'🌳',friend:'stretch-monkey',door:{to:'bakery',label:'Treehouse bakery',wide:[.485,.32,.06,.09],tall:[.45,.125,.08,.06]},exits:{left:'castle-night',right:'soccer-pitch',top:'waterfall',bottom:'garden-court'},exitRequires:{top:'treasure',bottom:'treasure'}},
 bakery:{name:'Treehouse bakery',icon:'🥖',friend:'mom',gate:'bakery',door:{to:'treehouse-town',label:'Outside',return:true},exits:{}},
 'castle-forest':{name:'Castle forest',icon:'🌲',friend:'rainbow-hedgehog',gate:'reading',door:{to:'workshop',label:'Castle workshop',wide:[.514,.328,.043,.106],tall:[.52,.151,.063,.049]},exits:{left:'castle-gate',right:'river-bridge',top:'soccer-pitch'},exitRequires:{top:'score'}},
 workshop:{name:'Castle workshop',icon:'⚙️',friend:'robo',gate:'workshop',door:{to:'castle-forest',label:'Outside',return:true},exits:{}},
 'river-bridge':{name:'River bridge',icon:'🌉',friend:'sparkle-snake',gate:'bridge',exits:{left:'castle-forest',right:'pirate-ship'},exitLock:{right:'bridge'}},
 'pirate-ship':{name:'Pirate shore',icon:'🏴‍☠️',friend:'captain-parrot',gate:'pirate',door:{to:'captain-cabin',label:'Captain’s cabin',wide:[.50,.28,.08,.12],tall:[.50,.25,.10,.09]},exits:{left:'river-bridge',right:'castle-moon-hill'}},
 'castle-moon-hill':{name:'Moon hill',icon:'🌙',friend:'loona',gate:'moon',exits:{left:'pirate-ship',right:'castle-night',top:'castle-gate'},exitRequires:{top:'bridge'},exitLock:{right:'night'}},
 'castle-night':{name:'Secret night garden',icon:'✨',friend:'dad',gate:'night',door:{to:'lighthouse',label:'Lighthouse',wide:[.16,.28,.08,.12],tall:[.18,.25,.10,.09]},exits:{left:'castle-moon-hill',right:'treehouse-town'}},
 'library-tower':{name:'Library tower',icon:'📚',friend:'bo',gate:'library',door:{to:'chess-courtyard',label:'Outside',return:true},exits:{}},
 'captain-cabin':{name:'Captain’s cabin',icon:'🛖',friend:'captain-parrot',gate:'cabin',door:{to:'pirate-ship',label:'Outside',return:true},exits:{}},
 lighthouse:{name:'Lighthouse',icon:'💡',friend:'robo',gate:'beacon',door:{to:'castle-night',label:'Outside',return:true},exits:{left:'lookout-ridge'},exitRequires:{left:'treasure'}},
 waterfall:{name:'Waterfall hideaway',bg:'forest-meadow',icon:'💧',friend:'stretch-monkey',gate:'balance',gates:['balance','lost-rock'],exits:{bottom:'treehouse-town',right:'garden-court'}},
 'garden-court':{name:'Explorer garden',bg:'treehouse-town',icon:'🌼',friend:'rainbow-hedgehog',gate:'word-trail',door:{to:'reading-nook',label:'Family reading room',wide:[.485,.32,.06,.09],tall:[.45,.125,.08,.06]},exits:{top:'treehouse-town',left:'waterfall',bottom:'lookout-ridge'}},
 'reading-nook':{name:'Family reading room',bg:'library-tower',icon:'📖',friend:'mom',interior:true,gate:'name-ada',gates:['name-ada','name-alex'],door:{to:'garden-court',label:'Explorer garden',return:true},exits:{}},
 'lookout-ridge':{name:'Explorer lookout',bg:'forest-meadow',icon:'🔭',friend:'loona',gate:'supply-code',gates:['supply-code','nine-stars'],exits:{top:'garden-court',right:'lighthouse'}}
};
const ITEMS={
 'castle-key':{name:'Castle key',icon:'key'},spyglass:{name:'Spyglass',icon:'scope'},
 rope:{name:'Rope',icon:'rope'},lantern:{name:'Lantern',icon:'lantern'},net:{name:'Fishing net',icon:'net'},shovel:{name:'Shovel',icon:'shovel'},
 ball:{name:'Pip’s ball',icon:'ball'},acorn:{name:'Acorn',icon:'acorn'},'island-map':{name:'Island map',icon:'map'},'star-compass':{name:'Star compass',icon:'star'},
 'book-medal':{name:'Word keeper medal',icon:'book',collection:true},'ship-badge':{name:'Captain’s badge',icon:'badge',collection:true},'beacon-gem':{name:'Beacon gem',icon:'gem',collection:true},'balance-stone':{name:'Balance stone',icon:'balance',collection:true},'rock-token':{name:'Friendship rock',icon:'rock',collection:true},
 'trail-medal':{name:'Trail reader medal',icon:'book',collection:true},'family-flower':{name:'Family flower',icon:'star',collection:true},'family-star':{name:'Family star',icon:'star',collection:true},'explorer-badge':{name:'Explorer’s method badge',icon:'badge',collection:true},'star-stone':{name:'Nine-star stone',icon:'gem',collection:true}
};
const LOCKS={
 bridge:{room:'river-bridge',item:'rope',label:'Bridge gap',icon:'bridge',hint:'Tie your rope across the bridge gap. Picos has a rope for three acorns.'},
 night:{room:'castle-moon-hill',item:'lantern',label:'Dark path',icon:'lantern',hint:'Light the dark path with a lantern from the castle workshop.'},
 runaway:{room:'castle-moon-hill',item:'net',label:'Fluttering map',icon:'map',requires:'moon',reward:'island-map',hint:'That map is caught in the wind. Bring the baker’s net and help Loona count the stars.'},
 dig:{room:'pirate-ship',item:'shovel',label:'Pirate X',icon:'x',requires:'island-map',needs:['star-compass'],steps:['bridge'],hint:'The island map points to this X. Use the shovel from Pip.'}
};
const GATES={
 chess:{room:'chess-courtyard',title:'Bo’s capture trade',prompt:'You captured a rook, knight and pawn. Bo captured a bishop and pawn. Who is ahead, and by how many points?',captures:{you:[['rook',5],['knight',3],['pawn',1]],friend:[['bishop',3],['pawn',1]]},options:['You by 5','Bo by 5','You by 9'],answer:'You by 5',hint:'Your captures: 5 + 3 + 1 = 9. Bo’s: 3 + 1 = 4. Compare 9 and 4.',rewards:['map-chess']},
 reading:{room:'castle-forest',title:'Picos’s hidden sign',prompt:'Look under the red flag, then tap the shell.',instruction:true,options:['red-shell','blue-shell'],answer:'red-shell',hint:'Read it in two parts. Find the red flag. Tap the shell below it.',rewards:['map-reading']},
 score:{room:'soccer-pitch',title:'Pip’s missing score',prompt:'7 teams scored 8 goals each. Then 6 goals were taken off the board. How many goals remain?',equation:'7 × 8 − 6 = ?',options:['48','50','56'],answer:'50',hint:'Seven eights are 56. Now subtract 6.',rewards:['map-score']},
 workshop:{room:'workshop',title:'Robo’s lantern gears',prompt:'Robo needs 6 wheels with 9 teeth on each wheel. How many teeth altogether?',equation:'6 × 9 = ?',options:['45','54','63'],answer:'54',hint:'Three nines are 27. Double 27 to make six nines.',rewards:['lantern']},
 bakery:{room:'bakery',title:'The baker’s order',prompt:'The baker needs 7 trays with 8 rolls on each tray. How many rolls should she bake?',equation:'7 × 8 = ?',options:['54','56','63'],answer:'56',hint:'Five trays of 8 make 40. Two more trays make 16 more.',rewards:['net']},
 bridge:{room:'river-bridge',title:'Snake’s bridge bundles',prompt:'Snake has 42 planks. Each bundle needs 6 planks. How many bundles can Snake make?',equation:'42 ÷ 6 = ?',options:['6','7','8'],answer:'7',hint:'Six bundles of 6 make 36. One more bundle makes 42.',requires:'bridge-tied',rewards:[]},
 moon:{room:'castle-moon-hill',title:'Loona’s star chart',prompt:'Loona has 8 rows of 9 stars. How many stars are on her chart?',equation:'8 × 9 = ?',options:['63','72','81'],answer:'72',hint:'Nine tens are 90. Take away two nines: 90 − 18 = 72.',rewards:[]},
 night:{room:'castle-night',title:'Dad’s secret instruction',prompt:'Tap the chest with the thin shell.',instruction:true,options:['shell-chest','star-chest'],answer:'shell-chest',requires:'night',hint:'Chest starts with ch. Thin starts with th. Shell starts with sh. Find the thin shell on the chest.',rewards:['star-compass']},
 pirate:{room:'pirate-ship',title:'Captain’s treasure code',prompt:'8 bags hold 7 coins each. Add 9 silver coins. How many coins are in the treasure?',equation:'8 × 7 + 9 = ?',options:['56','63','65'],answer:'65',hint:'Eight sevens are 56. Add 9: 56 + 9 = 65.',requires:'dig',rewards:[]},
 kick:{room:'soccer-pitch',title:'Pip’s goal trade',kind:'kick',visual:'ball',prompt:'Aim at the middle of the goal. Choose your power, then kick! Score to earn Pip’s shovel.',options:['goal','retry'],answer:'goal',requires:'ball',hint:'Aim near the middle. A medium kick reaches the goal. You can try again.',rewards:['shovel']},
 library:{room:'library-tower',title:'The word keeper’s door',kind:'tiles',visual:'book',words:['duck','sand'],picture:'🦆',prompt:'Read each word card. Build it with letter tiles to open the word keeper’s door.',options:['duck sand'],answer:'duck sand',hint:'Duck ends with ck. Sand ends with nd. Tap each letter in order.',optional:true,requires:'treasure',rewards:['book-medal']},
 cabin:{room:'captain-cabin',title:'The captain’s mixed letters',kind:'tiles',words:['truck','jump'],clues:['🚚 A big ___ carries boxes.','We ___ over the log.'],picture:'🚚',prompt:'The captain mixed up these letters. Read the cards and put each word back together.',options:['truck jump'],answer:'truck jump',hint:'Truck ends with ck. Jump ends with mp. Start with the first letter on the card.',optional:true,requires:'treasure',rewards:['ship-badge']},
 beacon:{room:'lighthouse',title:'Robo’s beacon number',kind:'place',number:7045,digitIndex:2,prompt:'The beacon shows 7,045. What is the highlighted 4 worth?',options:['4','40','400','4000'],answer:'40',hint:'The 4 is in the tens column: four tens are 40.',optional:true,requires:'treasure',rewards:['beacon-gem']},
 balance:{room:'waterfall',title:'The riddle stone’s balance',kind:'balance',visual:'balance',equation:'7 × 8 − 50 = ?',prompt:'Make both sides equal: 7 × 8 = 50 + ?',options:['6','8','56'],answer:'6',hint:'Seven eights are 56. Fifty plus six makes the same amount.',optional:true,requires:'treasure',rewards:['balance-stone']},
 'lost-rock':{room:'waterfall',title:'Monkey’s lost word',kind:'picture-word',visual:'rock',picture:'🪨',prompt:'Read the words. Tap the word that matches the picture to find Monkey’s lost item.',options:['rock','sock','duck','rest'],answer:'rock',hint:'Look at the picture. The word starts with r and ends with ck.',optional:true,requires:'treasure',rewards:['rock-token']}
};
// Every multiplication step stays supported until per-fact first-answer evidence proves otherwise.
// The Help button speaks these methods; an array or skip-count renderer can also use math.support.
for(const [id,g] of Object.entries(GATES)){
 const m=g.equation?.match(/(\d+)\s*×\s*(\d+)/);if(!m)continue;
 const [a,b]=m.slice(1).map(Number),counts=Array.from({length:a},(_,i)=>(i+1)*b);
 g.math={type:'multiply',facts:[{a,b}],mode:'supported',support:{kind:'skip-count',groups:a,each:b,counts}};
 g.hint=`Count ${a} groups of ${b}: ${counts.join(', ')}. ${g.hint}`;
}
GATES.bridge.math={type:'divide',facts:[{a:7,b:6}],mode:'supported',support:{kind:'skip-count',groups:7,each:6,counts:[6,12,18,24,30,36,42]}};
GATES.bridge.hint='Count bundles of six: 6, 12, 18, 24, 30, 36, 42. Seven bundles use all 42 planks.';
// Keep the original quest/reward IDs: old completed saves gain these discoveries without replaying the ending.
Object.assign(GATES,{
 'word-trail':{room:'garden-court',title:'Picos’s word trail',kind:'tiles',words:['top','pin'],displayWords:['TOP','PIN'],soundSupport:true,hearAndBuild:true,prompt:'Read the short word cards. Tap Hear it when you need help, then build each word with the sound tiles.',options:['top pin'],answer:'top pin',hint:'Hear the whole word, then tap each sound in order. Top: t, o, p. Pin: p, i, n.',optional:true,requires:'treasure',rewards:['trail-medal']},
 'name-ada':{room:'reading-nook',title:'A flower for Ada',kind:'tiles',words:['ada'],displayWords:['ADA'],soundSupport:true,hearAndBuild:true,uppercase:true,prompt:'Make the name on the flower card: ADA. Tap Hear it for the whole name. Each letter tile speaks its sound.',options:['ada'],answer:'ada',hint:'A, D, A. Use the name card; it has two A tiles. Hear each sound as you build.',optional:true,requires:'treasure',rewards:['family-flower']},
 'name-alex':{room:'reading-nook',title:'A star for Alex',kind:'tiles',words:['alex'],displayWords:['ALEX'],soundSupport:true,hearAndBuild:true,uppercase:true,prompt:'Make the name on the star card: ALEX. Tap Hear it for the whole name. Each letter tile speaks its sound.',options:['alex'],answer:'alex',hint:'A, L, E, X. Use each letter once. Hear each sound as you build the name.',optional:true,requires:'treasure',rewards:['family-star']},
 'supply-code':{room:'lookout-ridge',title:'The explorer’s supply code',equation:'99 × 99 + 40 = ?',prompt:'There are 99 crates with 99 supplies in each crate. Add 40 more supplies. How many altogether? Use a method; Help shows one.',options:['9841','9941','9801'],answer:'9841',hint:'Use 100 minus 1: 99 × 100 = 9900. Take away one group of 99: 9900 − 99 = 9801. Then add 40: 9841.',math:{type:'multiply',mode:'supported',facts:[],support:{kind:'decompose',steps:['99 × 100 = 9900','9900 − 99 = 9801','9801 + 40 = 9841']}},optional:true,requires:'treasure',rewards:['explorer-badge']},
 'nine-stars':{room:'lookout-ridge',title:'Loona’s three star rows',equation:'3 × 9 = ?',prompt:'Loona has 3 rows of 9 stars. How many stars altogether? You can count the rows with Help.',options:['21','27','36'],answer:'27',hint:'Make three rows of nine. Count one row at a time: 9, 18, 27. Three nines make 27.',math:{type:'multiply',facts:[{a:3,b:9}],mode:'supported',support:{kind:'skip-count',groups:3,each:9,counts:[9,18,27]}},optional:true,requires:'treasure',rewards:['star-stone']}
});
for(const id of ['library','cabin'])Object.assign(GATES[id],{soundSupport:true,hearAndBuild:true});
const MAP_GATES=['chess','reading','score'];
const FRIENDS={
 'castle-gate':['The map is torn. Help Bo, Picos and Pip find the three pieces. There are more secrets beyond the bridge.', 'You restored the map! My festival gifts are behind this castle door. The pirate shore has another treasure.'],
 'chess-courtyard':['Compare both sets of captures for me. I will trade you my map piece.', 'Your nine points beat my four. That piece is yours.'],
 'castle-forest':['Find three acorns and read my hidden sign. Then you will earn my rope and a map piece.', 'You read the sign and brought three acorns! The rope is yours. The castle opening leads into Robo’s workshop.'],
 'soccer-pitch':['Pip lost his ball in that branch. Fetch it, then score a goal to earn his shovel. His score chest holds a map piece.', 'Goal! The shovel is yours. Finish the three map pieces to discover where to dig.'],
 'treehouse-town':['The treehouse baker needs help with her trays. Tap the lit opening in the big treehouse to go inside.', 'You helped the baker! Her net can catch something small that is blowing away.'],
 bakery:['I need seven trays of eight rolls. Work out my order and you can have my fishing net.', 'Fifty-six rolls are ready. Take the net to the moon hill.'],
 workshop:['My lantern needs six wheels of nine teeth. Work out the teeth and it is yours.', 'Your lantern is ready. It can light the dark path on moon hill.'],
 'river-bridge':['The stepping path has a gap. Tie a rope, then help me bundle the repair planks into sixes.', 'The rope is tied and the planks are bundled. You can cross to the pirate shore.'],
 'pirate-ship':['Finish the three map pieces to reveal the dig site. Your shovel and Dad’s compass will open the treasure.', 'You found our treasure! Choose a side quest at the library, cabin, lighthouse, waterfall or explorer garden. Open the treasure chest again whenever you want.'],
 'castle-moon-hill':['Count my eight rows of nine stars. Then catch that fluttering map with a net. A lantern opens the night path.', 'My chart has seventy-two stars. The map and dark path are waiting for your tools.'],
 'castle-night':['Read my instruction and choose the right chest. Its star compass will help the captain find the treasure.', 'The star compass is yours. Bring it to the pirate shore and look for the X.'],
 'library-tower':['My word keeper’s door hides a medal. Come back after finding the treasure and build the words.', 'Your word keeper medal is on the collection shelf.'],
 'captain-cabin':['My letters got mixed up! Come back after the treasure and restore my words.', 'You earned the captain’s badge.'],
 lighthouse:['The beacon needs the value of a digit. Find the treasure, then help me light it.', 'Your beacon gem shines on the collection shelf.'],
 waterfall:['A riddle stone and a lost item hide here. Make the balance equal and read the picture’s word. The garden path is another way back.', 'Your discoveries are on the collection shelf. The explorer garden has more word cards.'],
 'garden-court':['The treasure was just the beginning. Choose a word trail, visit the family reading room, or take the lookout path. You choose the order.', 'Your word medal is ready. There are two name cards in the reading room and two puzzles at the lookout.'],
 'reading-nook':['Two gifts need name cards. Build ADA for the flower or ALEX for the star. Tap Hear it and the sound tiles whenever you want.', 'Keep exploring! You can build the other name card, try the lookout puzzles, or go play outside.'],
 'lookout-ridge':['Choose a challenge: work out the big supply code with a method, or practise three rows of nine with my counting hint. The lighthouse path makes a loop.', 'Your new discoveries stay on the shelf. Take the lighthouse path home or return through the garden.']
};
const castleMapSpots={'castle-gate':[290,145],'chess-courtyard':[160,145],'soccer-pitch':[55,145],'treehouse-town':[55,235],bakery:[55,320],'castle-forest':[410,145],workshop:[410,55],'river-bridge':[520,145],'pirate-ship':[520,235],'castle-moon-hill':[390,235],'castle-night':[280,235],'library-tower':[160,55],'captain-cabin':[520,320],lighthouse:[280,320],waterfall:[160,320],'garden-court':[55,415],'reading-nook':[160,505],'lookout-ridge':[280,415]};
export const CASTLE={id:"castle",contentVersion:4,ROOMS,ITEMS,LOCKS,GATES,MAP_GATES,FRIENDS,startRoom:"castle-gate",mapSpots:castleMapSpots,toys:[{id:'castle-tetherball',kind:'tetherball',room:'garden-court',x:.25,y:.79},{id:'castle-soccer',kind:'soccer',room:'soccer-pitch',x:.23,y:.78}]};
// A pre-reader world: every answer has a picture and every instruction has a recording.
// Household names, progression evidence, paintings and voices are supplied privately.
const matTargets={wide:Array.from({length:4},(_,i)=>({id:String(i+1),label:`Demo token ${i+1}`,r:[.18+(i%4)*.16,.22+Math.floor(i/4)*.14,.085,.07]})),tall:Array.from({length:4},(_,i)=>({id:String(i+1),label:`Demo token ${i+1}`,r:[.18+(i%4)*.16,.22+Math.floor(i/4)*.14,.085,.07]}))};
const gymTargets={wide:Array.from({length:4},(_,i)=>({id:String(i+1),label:`Demo token ${i+1}`,r:[.18+(i%4)*.16,.22+Math.floor(i/4)*.14,.085,.07]})),tall:Array.from({length:4},(_,i)=>({id:String(i+1),label:`Demo token ${i+1}`,r:[.18+(i%4)*.16,.22+Math.floor(i/4)*.14,.085,.07]}))};
const plateTargets={wide:Array.from({length:5},(_,i)=>({id:String(i+1),label:`Demo token ${i+1}`,r:[.18+(i%4)*.16,.22+Math.floor(i/4)*.14,.085,.07]})),tall:Array.from({length:5},(_,i)=>({id:String(i+1),label:`Demo token ${i+1}`,r:[.18+(i%4)*.16,.22+Math.floor(i/4)*.14,.085,.07]}))};
const smallRooms={
 volcano:{name:'Volcano island',icon:'🌋',bg:'volcano',friend:'dad',gate:'stones',gates:['stones','stone-subtract','count-twenty'],exits:{right:'flower-meadow',bottom:'lava-playroom'}},
 'flower-meadow':{name:'Flower meadow',icon:'🌼',bg:'flower-meadow',friend:'dad',gate:'flowers',gates:['flowers','flower-subtract','flower-fewer'],exits:{left:'volcano',right:'brain-world',bottom:'tetherball-yard'}},
 'brain-world':{name:'Brain room',icon:'🧠',bg:'brain-world',friend:'dad',gate:'sound',door:{to:'forest-school',label:'Pattern studio',wide:[.25,.27,.08,.10],tall:[.25,.13,.10,.06]},exits:{left:'flower-meadow',bottom:'pizza-party'}},
 'pizza-party':{name:'Pizza kitchen',icon:'🍕',bg:'pizza-party',friend:'mom',gate:'pizzas',door:{to:'home-room',label:'Grown-up’s room',wide:[.84,.30,.08,.10],tall:[.83,.15,.10,.06]},exits:{left:'tetherball-yard',top:'brain-world'}},
 'lava-playroom':{name:'Lava playroom',icon:'🔵',bg:'lava-playroom',friend:'dad',gate:'mats',door:{to:'gym-bars-home',label:'Gym room',wide:[.82,.24,.08,.10],tall:[.82,.12,.10,.06]},exits:{top:'volcano',right:'tetherball-yard'}},
 'tetherball-yard':{name:'Surprise garden',icon:'🎁',bg:'flower-meadow',friend:'dad',gate:'gift',exits:{left:'lava-playroom',right:'pizza-party',top:'flower-meadow'}},
 'forest-school':{name:'Pattern studio',icon:'🎨',bg:'forest-school',friend:'dad',gate:'pattern-studio',door:{to:'brain-world',label:'Outside',return:true},exits:{}},
 'home-room':{name:'Grown-up’s room',icon:'🏡',bg:'home-room',friend:'mom',door:{to:'pizza-party',label:'Outside',return:true},exits:{}},
 'gym-bars-home':{name:'Garden gym',icon:'💪',bg:'flower-meadow',friend:'dad',gate:'mat-compare',door:{to:'lava-playroom',label:'Outside',return:true},exits:{}}
};
const numbers=values=>Object.fromEntries(values.map(v=>[String(v),String(v)]));
const smallGates={
 stones:{room:'volcano',title:'The Floor Is Lava',kind:'arithmetic',count:12,icon:'🪨',goal:'Find the safe stones after five sink',prompt:'Five stepping stones sink into the lava. Tap five real stones to cross them out. How many safe stones are left?',options:['6','7','8'],pictures:numbers([6,7,8]),answer:'7',hint:'Cross out five stones, then tap only the safe stones that remain.',scenePuzzle:{mode:'subtract',painted:'stones',takeAway:5},rewards:['stone']},
 flowers:{room:'flower-meadow',title:'Flowers for Grown-up',kind:'arithmetic',count:10,icon:'🌼',goal:'Split a bunch of ten flowers',prompt:'The bunch has ten flowers. Give Grown-up six by crossing them out. How many flowers complete the bunch of ten?',options:['3','4','5'],pictures:numbers([3,4,5]),answer:'4',hint:'Six for Grown-up and the flowers that remain make ten together.',scenePuzzle:{mode:'subtract',painted:'yellow-flowers',takeAway:6,bond:10},rewards:['flower']},
 sound:{room:'brain-world',title:'The sound door',kind:'sound',letters:['O'],letter:'O',icon:'🔊',goal:'Find the letter by its sound',prompt:'Listen: [[ɑ]]. Tap the letter for this sound. You can hear it again.',options:['O','A','T'],pictures:{O:'O',A:'A',T:'T'},answer:'O',hint:'Listen to the sound again. Look carefully at the letter shapes.',scenePuzzle:{mode:'sound'},rewards:['thought']},
 pizzas:{room:'pizza-party',title:'Set Grown-up’s table',kind:'arithmetic',count:5,icon:'🍽️',goal:'Four plus how many makes nine? Find the missing plates.',prompt:'Four guests already have plates. Nine guests are coming. Tap the real plates on this table. How many more plates finish the table: four plus what makes nine?',options:['4','5','6'],pictures:numbers([4,5,6]),answer:'5',hint:'Start with four places already ready. Each painted plate adds another place until nine are ready.',scenePuzzle:{mode:'missing',targets:plateTargets,source:'pizza-party',startAt:4,total:9},rewards:['pizza']},
 mats:{room:'lava-playroom',title:'The Soft Mat Course',kind:'arithmetic',count:4,icon:'🔵',goal:'Add this course to nine mats',prompt:'Nine mats are ready in the next room. Cross the real mats here in order: front left, back left, flat right, sloping right. How many mats are ready altogether?',options:['12','13','14'],pictures:numbers([12,13,14]),answer:'13',hint:'Start at nine, then add each real mat on this course. Follow the glowing ring.',scenePuzzle:{mode:'add',ordered:true,startAt:9,targets:matTargets,source:'lava-playroom'},rewards:['ribbon']},
 gift:{room:'tetherball-yard',title:'Choose Grown-up’s flowers',kind:'more',counts:[4,6],icon:'🎁',goal:'Find the larger painted flower group',prompt:'Look at the real yellow flowers. Which ringed group has more: the group on the left, or the group on the right? Tap and count them, then choose Grown-up’s bunch.',options:['left','right'],pictures:{left:'⬅️ 🌼',right:'🌼 ➡️'},answer:'right',hint:'Count the flowers inside each ringed group. Choose the group with more flowers.',scenePuzzle:{mode:'compare',painted:'yellow-flowers',groups:[['1','2','6','7'],['3','4','5','8','9','10']]},requires:'gift-door',rewards:['gift']},
 'stone-subtract':{room:'volcano',title:'How many safe stones are left?',kind:'count',count:12,icon:'🪨',goal:'Take away four lava stones',prompt:'Four stones are too hot. Tap four painted stones to cross them out. Now count the safe stones that are left.',options:['7','8','9'],pictures:numbers([7,8,9]),answer:'8',hint:'Leave the crossed-out stones alone. Tap and count each safe stone that remains.',scenePuzzle:{mode:'subtract',painted:'stones',takeAway:4},optional:true,rewards:['safe-stone-medal']},
 'count-twenty':{room:'volcano',title:'The next island',kind:'count',count:20,icon:'🔢',goal:'Add two island paths',prompt:'Eight stones are ready on the other island. Add the real stones on this island. How many stones are ready altogether?',options:['18','20','19'],pictures:numbers([18,20,19]),answer:'20',hint:'Start after eight: nine, ten. Keep going as you tap each real stone once.',scenePuzzle:{mode:'add',painted:'stones',startAt:8},optional:true,rewards:['twenty-medal']},
 'pattern-studio':{room:'forest-school',title:'Repair the long pattern',kind:'pattern',icon:'🎨',goal:'Repair a missing picture in the pattern',prompt:'Look at the repeating pictures. There is a gap in the middle. Which picture belongs there?',options:['leaf','flower','stone'],pictures:{leaf:'🍃',flower:'🌼',stone:'🪨'},answer:'leaf',hint:'Find a whole group that repeats. Compare the pictures before and after the gap.',scenePuzzle:{mode:'pattern',level:2,unit:['leaf','flower','stone'],sequence:['leaf','flower','stone',null,'flower','stone','leaf','flower','stone'],blank:3},optional:true,rewards:['pattern-medal']},
 'flower-subtract':{room:'flower-meadow',title:'Grown-up’s flower delivery',kind:'count',count:10,icon:'🌼',goal:'Give Grown-up three flowers; count what is left',prompt:'Give Grown-up three yellow flowers. Tap three painted flowers to cross them out. How many flowers are left?',options:['6','7','8'],pictures:numbers([6,7,8]),answer:'7',hint:'Count only the flowers that are not crossed out.',scenePuzzle:{mode:'subtract',painted:'yellow-flowers'},optional:true,rewards:['flower-medal']},
 'mat-compare':{room:'gym-bars-home',title:'How many more flowers?',kind:'arithmetic',counts:[4,6],icon:'🌼',goal:'Find how many more flowers one group has',prompt:'Tap the real flowers in each group. Match a flower on the left with a flower on the right. How many extra flowers does the larger group have?',options:['1','2','3'],pictures:numbers([1,2,3]),answer:'2',hint:'Match the two groups flower for flower. Count only the flowers without a partner.',scenePuzzle:{mode:'difference',painted:'yellow-flowers',groups:[['1','2','6','7'],['3','4','5','8','9','10']]},optional:true,rewards:['balance-medal']}
};
smallGates['flower-fewer']={...structuredClone(smallGates.gift),room:'flower-meadow',title:'The smaller bunch',kind:'comparison',goal:'Find the group with fewer flowers',prompt:'Tap the flowers in both groups. Which group has fewer flowers?',answer:'left',hint:'Match flowers from the two groups. The group that runs out first has fewer.',requires:undefined,optional:true,rewards:['fewer-medal']};
smallGates['flower-fewer'].scenePuzzle.compare='fewer';
smallGates['flower-subtract'].scenePuzzle.takeAway=3;
export const SMALL={id:'small',early:true,contentVersion:4,startRoom:'volcano',finishRoom:'tetherball-yard',finishGate:'gift',ROOMS:smallRooms,GATES:smallGates,
 ITEMS:{stone:{name:'Safe path stone',icon:'star'},flower:{name:'Flower',icon:'star'},thought:{name:'Sound thought',icon:'star'},pizza:{name:'Pizza',icon:'star'},ribbon:{name:'Strong ribbon',icon:'rope'},gift:{name:'Gift for Grown-up',icon:'chest'},...Object.fromEntries(['safe-stone','twenty','pattern','flower','balance','fewer'].map(id=>[id+'-medal',{name:id.replaceAll('-',' ')+' discovery',icon:'star',collection:true}]))},
 LOCKS:{'gift-door':{room:'tetherball-yard',item:'ribbon',requires:'pizzas',needs:['stone','flower','thought','pizza','ribbon'],label:'Open Grown-up’s gift door',icon:'chest',goal:'Open Grown-up’s gift door with your collected things',hint:'Bring your stone, flower, sound thought, pizza and strong ribbon. Then tap the gift door.'}},
 MAP_GATES:['stones','flowers','sound','pizzas','mats'],
 toys:[{id:'round-the-pole',kind:'tetherball',room:'tetherball-yard',x:.78,y:.68},{id:'forever-bubbles',kind:'bubbles',room:'flower-meadow',x:.22,y:.70}],
 FRIENDS:Object.fromEntries(Object.entries(smallRooms).map(([id,r])=>[id,[smallGates[r.gate]?.prompt||'Grown-up is here. Stay and play, or take any open path to another place.','You helped this place. You can explore another path, find a discovery, or play as long as you like.']]))};

// Evidence enters from private runtime files; no household results enter the release.
export function smallWorldForLearner(profile={}){
 const learner=profile.learner||{},model=profile.learnerModel||profile,focus=learner.bookPlan?.letterFocus?.letter;
 if(!focus&&!model.math&&!model.literacy&&!profile.patternLevel)return SMALL;
 const d=structuredClone(SMALL),g=d.GATES.sound,known=model.literacy?.letters||[];
 const letter=String(focus||known.at(-1)||'O').toUpperCase();
 const sounds={A:'æ',B:'b',C:'k',D:'d',E:'ɛ',F:'f',G:'ɡ',H:'h',I:'ɪ',M:'m',N:'n',O:'ɑ',P:'p',R:'ɹ',S:'s',T:'t',U:'ʌ'};
 if(sounds[letter]){g.letters=[letter];g.letter=letter;g.options=[letter,...[...new Set([...known,'O','A','T'].map(v=>v.toUpperCase()))].filter(v=>v!==letter).slice(0,2)];g.pictures=Object.fromEntries(g.options.map(v=>[v,v]));g.answer=letter;g.prompt=`Listen: [[${sounds[letter]}]]. Tap the letter for this sound. You can hear it again.`;d.FRIENDS['brain-world'][0]=g.prompt;}
 const level=Math.max(1,Math.min(3,Number(profile.patternLevel||model.math?.patternLevel||2))),p=d.GATES['pattern-studio'];
 p.scenePuzzle.level=level;
 if(level===3){p.scenePuzzle.unit=['leaf','flower','stone','flower'];p.scenePuzzle.sequence=['leaf','flower','stone','flower','leaf',null,'stone','flower','leaf','flower','stone','flower'];p.scenePuzzle.blank=5;p.answer='flower';}
 d.learning={taughtLetters:[...new Set([...known,g.letter])],patternLevel:level,countTo:20,subtract:true};
 return d;
}
// A table number, factors >=6, assisted answers and fast multiple-choice taps are not fact mastery.
// Keep the last three first-answer observations per exact fact; any miss or help makes it supported again.
export function castleFactKnown({a,b},evidence=[]){
 const fact=`${a}x${b}`,rows=evidence.filter(e=>e&&((e.a===a&&e.b===b)||e.fact===fact||e.item===`fact:${fact}`)).sort((x,y)=>(x.at??0)-(y.at??0)).slice(-3);
 return rows.length===3&&new Set(rows.map(e=>e.at)).size===3&&rows.every(e=>Number.isFinite(e.at)&&e.firstTry===true&&e.ok===true&&e.help===false&&!e.hint&&Number.isFinite(e.ms)&&e.ms>=2000);
}
export function castleMathIssues(g,{factEvidence=[]}={}){
 const issues=[],mul=g.equation?.match(/(\d+)\s*×\s*(\d+)/),div=g.equation?.match(/(\d+)\s*÷\s*(\d+)/);
 if(!mul&&!div)return issues;
 const [a,b]=mul?mul.slice(1).map(Number):[Number(div[1])/Number(div[2]),Number(div[2])];
 const math=g.math,method=math?.support;
 if(math?.mode==='quick'){
  if(a>9||b>9||!castleFactKnown({a,b},factEvidence))issues.push(`${a} × ${b}: quick fact has no independent first-try evidence (fast taps and helped answers do not count)`);
 }else if(math?.mode!=='supported')issues.push(`${a} × ${b}: unknown fact needs a supported practice method`);
 else if(a>9||b>9){if(!mul||a>99||b>99||method?.kind!=='decompose'||!method.steps?.length)issues.push(`${a} × ${b}: larger multiplication needs a decomposition method`);}
 else if(method?.kind!=='skip-count'||method.groups!==a||method.each!==b||JSON.stringify(method.counts)!==JSON.stringify(Array.from({length:a},(_,i)=>(i+1)*b)))issues.push(`${a} × ${b}: supported fact needs a correct array or skip-counting hint`);
 if(method?.kind==='decompose'){
  for(const step of method.steps||[]){const parts=step.match(/^(\d+)\s*([×+−-])\s*(\d+)\s*=\s*(\d+)$/);if(!parts){issues.push('decomposition step cannot be checked');continue;}const [,x,op,y,n]=parts,value=op==='×'?+x*+y:op==='+'?+x+(+y):+x-(+y);if(value!==+n)issues.push(`decomposition step ${step} is incorrect`);}
  if(method.steps?.at(-1)?.split('=').at(-1).trim()!==g.answer)issues.push('decomposition method does not end at the puzzle answer');
 }
 if(math?.mode==='supported'&&!g.hint)issues.push('supported fact needs an on-request hint');
 return issues;
}
// Pure adaptation: the service supplies private learner fields; saves retain their stable gate/reward IDs.
export function castleDefinition(profile={},learner=profile.learner||{}){
 const d=structuredClone(CASTLE),lit=learner.literacy||{},plan=learner.bookPlan||{};
 const candidates=[...(plan.wordPatterns||[]).map(p=>p.words?.[0]),...(plan.confidenceWords||[]),...(lit.wordsStuck||[]),...(lit.wordsAlmost||[])];
 const words=[...new Set(candidates.filter(w=>typeof w==='string'&&isFamilyWord(w)&&canSoundOut(w)).map(w=>w.toLowerCase()))].slice(0,2);
 const usesLearnerWords=words.length>0;
 for(const w of ['top','pin'])if(words.length<2&&!words.includes(w))words.push(w);
 const g=d.GATES['word-trail'];g.words=words;g.displayWords=words.map(w=>w.toUpperCase());g.answer=words.join(' ');g.options=[g.answer];g.hint='Hear the whole word, then tap each sound in order. '+words.map(w=>`${w}: ${[...w].join(', ')}.`).join(' ');
 const factEvidence=(learner.math?.factEvidence||[]).filter(e=>e&&typeof e==='object');
 for(const gate of Object.values(d.GATES))if(gate.math?.facts?.length&&gate.math.facts.every(f=>castleFactKnown(f,factEvidence)))gate.math.mode='quick';
 d.learning={reading:{wordLevel:lit.wordLevel??2,sentenceLevel:lit.sentenceLevel??1,focus:lit.readingFocus||plan.readingFocus||[],soundSupport:true,hearAndBuildWords:['truck','jump'],source:usesLearnerWords?'learner':'supported fallback'},factEvidence};
 return d;
}
export const worldDefinition=(profile={},learner=profile.learner)=>profile.world==='small'||profile.age<=5?smallWorldForLearner(profile):learner?castleDefinition(profile,learner):CASTLE;

// Demo tokens are drawn and measured from scratch, independent of household paintings.
const demoTargets=n=>Array.from({length:n},(_,i)=>({id:String(i+1),label:`Demo token ${i+1}`,r:[.18+(i%4)*.16,.22+Math.floor(i/4)*.14,.085,.07]}));
for(const [id,n]of [["pizzas",5],["mats",4]])smallGates[id].scenePuzzle.targets={wide:demoTargets(n),tall:demoTargets(n)};
for(const r of [...Object.values(ROOMS),...Object.values(smallRooms)])if(r.door&&!r.door.return){r.door.wide=[.82,.55,.1,.12];r.door.tall=[.82,.55,.1,.12];}

// Separate demo-scene keys preserve the current public Book paintings.
for(const room of [...Object.values(ROOMS),...Object.values(smallRooms)])room.bg="demo-"+(room.bg||Object.entries(ROOMS).find(([,v])=>v===room)?.[0]);
for(const gate of Object.values(smallGates))if(gate.scenePuzzle?.source)gate.scenePuzzle.source='demo-'+gate.scenePuzzle.source;
