// Authored geography, requests and rewards. The server owns every item and lock.
const ROOMS={
 'castle-gate':{name:'Castle gate',icon:'🏰',friend:'grown-up',exits:{left:'chess-courtyard',right:'castle-forest'}},
 'chess-courtyard':{name:'Chess courtyard',icon:'♞',friend:'bo',gate:'chess',exits:{left:'soccer-pitch',right:'castle-gate'}},
 'soccer-pitch':{name:'Soccer pitch',icon:'⚽',friend:'pip',gate:'score',exits:{left:'treehouse-town',right:'chess-courtyard'}},
 'treehouse-town':{name:'Treehouse town',icon:'🌳',friend:'bo',door:{to:'bakery',label:'Treehouse bakery',wide:[.485,.32,.06,.09],tall:[.45,.125,.08,.06]},exits:{right:'soccer-pitch'}},
 bakery:{name:'Treehouse bakery',icon:'🥖',friend:'grown-up',gate:'bakery',door:{to:'treehouse-town',label:'Outside',return:true},exits:{}},
 'castle-forest':{name:'Castle forest',icon:'🌲',friend:'pip',gate:'reading',door:{to:'workshop',label:'Castle workshop',wide:[.514,.328,.043,.106],tall:[.52,.151,.063,.049]},exits:{left:'castle-gate',right:'river-bridge'}},
 workshop:{name:'Castle workshop',icon:'⚙️',friend:'grown-up',gate:'workshop',door:{to:'castle-forest',label:'Outside',return:true},exits:{}},
 'river-bridge':{name:'River bridge',icon:'🌉',friend:'pip',gate:'bridge',exits:{left:'castle-forest',right:'pirate-ship'},exitLock:{right:'bridge'}},
 'pirate-ship':{name:'Pirate shore',icon:'🏴‍☠️',friend:'pip',gate:'pirate',exits:{left:'river-bridge',right:'castle-moon-hill'}},
 'castle-moon-hill':{name:'Moon hill',icon:'🌙',friend:'pip',gate:'moon',exits:{left:'pirate-ship',right:'castle-night'},exitLock:{right:'night'}},
 'castle-night':{name:'Secret night garden',icon:'✨',friend:'grown-up',gate:'night',exits:{left:'castle-moon-hill'}}
};
const ITEMS={
 'castle-key':{name:'Castle key',icon:'key'},spyglass:{name:'Spyglass',icon:'scope'},
 rope:{name:'Rope',icon:'rope'},lantern:{name:'Lantern',icon:'lantern'},net:{name:'Fishing net',icon:'net'},shovel:{name:'Shovel',icon:'shovel'},
 ball:{name:'the fox’s ball',icon:'ball'},acorn:{name:'Acorn',icon:'acorn'},'island-map':{name:'Island map',icon:'map'},'star-compass':{name:'Star compass',icon:'star'}
};
const LOCKS={
 bridge:{room:'river-bridge',item:'rope',label:'Bridge gap',icon:'bridge',hint:'Tie your rope across the bridge gap. the fox has a rope for three acorns.'},
 night:{room:'castle-moon-hill',item:'lantern',label:'Dark path',icon:'lantern',hint:'Light the dark path with a lantern from the castle workshop.'},
 runaway:{room:'castle-moon-hill',item:'net',label:'Fluttering map',icon:'map',requires:'moon',reward:'island-map',hint:'That map is caught in the wind. Bring the baker’s net and help the fox count the stars.'},
 dig:{room:'pirate-ship',item:'shovel',label:'Pirate X',icon:'x',requires:'island-map',hint:'The island map points to this X. Use the shovel from the fox.'}
};
const GATES={
 chess:{room:'chess-courtyard',title:'Bo’s capture trade',prompt:'You captured a rook, knight and pawn. Bo captured a bishop and pawn. Who is ahead, and by how many points?',captures:{you:[['rook',5],['knight',3],['pawn',1]],friend:[['bishop',3],['pawn',1]]},options:['You by 5','Bo by 5','You by 9'],answer:'You by 5',hint:'Your captures: 5 + 3 + 1 = 9. Bo’s: 3 + 1 = 4. Compare 9 and 4.',rewards:['map-chess']},
 reading:{room:'castle-forest',title:'the fox’s hidden sign',prompt:'Look under the red flag, then tap the shell.',instruction:true,options:['red-shell','blue-shell'],answer:'red-shell',hint:'Read it in two parts. Find the red flag. Tap the shell below it.',rewards:['map-reading']},
 score:{room:'soccer-pitch',title:'the fox’s missing score',prompt:'7 teams scored 8 goals each. Then 6 goals were taken off the board. How many goals remain?',equation:'7 × 8 − 6 = ?',options:['48','50','56'],answer:'50',hint:'Seven eights are 56. Now subtract 6.',rewards:['map-score']},
 workshop:{room:'workshop',title:'the guide’s lantern gears',prompt:'the guide needs 6 wheels with 9 teeth on each wheel. How many teeth altogether?',equation:'6 × 9 = ?',options:['45','54','63'],answer:'54',hint:'Three nines are 27. Double 27 to make six nines.',rewards:['lantern']},
 bakery:{room:'bakery',title:'The baker’s order',prompt:'The baker needs 7 trays with 8 rolls on each tray. How many rolls should she bake?',equation:'7 × 8 = ?',options:['54','56','63'],answer:'56',hint:'Five trays of 8 make 40. Two more trays make 16 more.',rewards:['net']},
 bridge:{room:'river-bridge',title:'the fox’s bridge bundles',prompt:'Share 29 planks into bundles of 6. How many full bundles, and how many planks left over?',equation:'29 ÷ 6 = ?',options:['4, left 5','5, left 1','4, left 6'],answer:'4, left 5',hint:'Four sixes make 24. There are 5 more planks. Five sixes would need 30.',requires:'bridge-tied',rewards:[]},
 moon:{room:'castle-moon-hill',title:'the fox’s star chart',prompt:'the fox has 8 rows of 9 stars. How many stars are on her chart?',equation:'8 × 9 = ?',options:['63','72','81'],answer:'72',hint:'Nine tens are 90. Take away two nines: 90 − 18 = 72.',rewards:[]},
 night:{room:'castle-night',title:'the guide’s secret instruction',prompt:'Tap the chest with the thin shell.',instruction:true,options:['shell-chest','star-chest'],answer:'shell-chest',requires:'night',hint:'Chest starts with ch. Thin starts with th. Shell starts with sh. Find the thin shell on the chest.',rewards:['star-compass']},
 pirate:{room:'pirate-ship',title:'Captain’s treasure code',prompt:'8 bags hold 7 coins each. Add 9 silver coins. How many coins are in the treasure?',equation:'8 × 7 + 9 = ?',options:['56','63','65'],answer:'65',hint:'Eight sevens are 56. Add 9: 56 + 9 = 65.',requires:'dig',rewards:[]}
};
const MAP_GATES=['chess','reading','score'];
const FRIENDS={
 'castle-gate':['The map is torn. Help Bo, the fox and the fox find the three pieces. There are more secrets beyond the bridge.', 'You restored the map! My castle treasure are behind this castle door. The pirate shore has another treasure.'],
 'chess-courtyard':['Compare both sets of captures for me. I will trade you my map piece.', 'Your nine points beat my four. That piece is yours.'],
 'castle-forest':['I need three acorns. Tap the three acorn bushes. I will trade you my rope. My sign hides a map piece.', 'Three acorns! Here is your rope. The castle opening leads into the guide’s workshop.'],
 'soccer-pitch':['the fox lost his ball in that branch. Bring it back and he will give you a shovel. His score chest holds a map piece.', 'the fox has his ball back! Your shovel can dig up the pirate X.'],
 'treehouse-town':['The treehouse baker needs help with her trays. Tap the lit opening in the big treehouse to go inside.', 'You helped the baker! Her net can catch something small that is blowing away.'],
 bakery:['I need seven trays of eight rolls. Work out my order and you can have my fishing net.', 'Fifty-six rolls are ready. Take the net to the moon hill.'],
 workshop:['My lantern needs six wheels of nine teeth. Work out the teeth and it is yours.', 'Your lantern is ready. It can light the dark path on moon hill.'],
 'river-bridge':['The stepping path has a gap. Tie a rope, then help me bundle the repair planks into sixes.', 'The rope is tied and the planks are bundled. You can cross to the pirate shore.'],
 'pirate-ship':['A map shows an X, but you will need a shovel and the guide’s star compass. Then work out my treasure code.', 'You found our treasure! Open the chest again to see the surprise.'],
 'castle-moon-hill':['Count my eight rows of nine stars. Then catch that fluttering map with a net. A lantern opens the night path.', 'My chart has seventy-two stars. The map and dark path are waiting for your tools.'],
 'castle-night':['Read my instruction and choose the right chest. Its star compass will help the captain find the treasure.', 'The star compass is yours. Bring it to the pirate shore and look for the X.']
};

export const CASTLE={id:"castle",ROOMS,ITEMS,LOCKS,GATES,MAP_GATES,FRIENDS,startRoom:"castle-gate"};
export const worldDefinition=()=>CASTLE;
