// Optional household choices arrive in /api/config; no household identity lives in the public tree.
// `activity` names the play history that counts for the card when the home order is computed (menu-order.mjs).
export const SHORTCUTS = [
 {id:'balance-scale-k',activity:'np:balance-k',name:'Animal balance',description:'Who weighs more? Make the blocks balance.',color:'#b9eaf8',icon:'/balance-scale-k.svg',game:'number-park',query:'play=balance-k',requiresFile:'lib/balance-kinder.mjs'},
 {id:'balance-scale',activity:'np:balance',name:'Balance scale',description:'Compare weights and make the numbers balance.',color:'#b9eaf8',icon:'/balance-scale.svg',game:'number-park',query:'play=balance'},
 {id:'snack-friend',activity:'np:cookies',name:'Snack Friend',description:'Share the cookies fairly.',color:'#dfcba3',icon:'/snack-friend.svg',game:'number-park',query:'play=cookies'},
 {id:'cookie-share',activity:'np:cookies',name:'Snack Friend',description:'Share the cookies. One for you, one for me!',color:'#dfcba3',icon:'/snack-friend.svg',game:'number-park',query:'play=cookies'},
 {id:'pattern-parade',activity:'np:pattern',name:'Pattern Parade',description:'What comes next in the parade?',color:'#b9eaf8',icon:'/pattern-parade.svg',game:'number-park',query:'play=pattern'},
 {id:'trace-numbers',activity:'np:trace',name:'Trace Numbers',description:'Follow the gold guide.',color:'#b9eaf8',icon:'/trace-numbers.svg',game:'number-park',query:'tab=draw'},
 {id:'take-away',activity:'np:subtract',name:'Take Away',description:'Move objects. Count what is left.',color:'#b9eaf8',icon:'/take-away.svg',game:'number-park',query:'play=subtract'},
 {id:'maze-maker',activity:'maze:maker',name:'Make a Maze',description:'Draw a path and explore it.',color:'#d5dfbc',icon:'/maze-maker.svg',href:'#maze-garden/maker'},
 {id:'maze-trace',activity:'maze:trace',name:'Tracing Mazes',description:'Follow the winding path.',color:'#d5dfbc',icon:'/maze-trace.svg',href:'#maze-garden/trace'},
 {id:'letter-labyrinth',activity:'lq:maze',name:'Letter Labyrinth',description:'Letters open the garden doors.',color:'#d5dfbc',icon:'/letter-labyrinth.svg',href:'#maze-garden/letters'},
];
// At most six reviewed shortcuts per player, included in the ordered home list.
export const MAX_SHORTCUTS=6;
export function homeGames(games, selections = []) {
 const chosen = Array.isArray(selections) ? [...new Set(selections)].slice(0,MAX_SHORTCUTS).map(id=>SHORTCUTS.find(s=>s.id===id)).filter(Boolean) : [];
 return [...chosen,...games];
}
// The smart home list (computed in the background on the hub) as cards: each known card once, any card
// it does not name kept at the end in the usual order, so a stale or partial list never hides a game.
// Without a list the page shows the reviewed shortcuts first, as before.
export function smartHomeGames(games, selections = [], list = null) {
 const cards = homeGames(games, selections);
 if (!Array.isArray(list) || !list.length) return cards;
 const byId = new Map(cards.map(card => [card.id, card])), seen = new Set(), out = [];
 for (const id of list) if (byId.has(id) && !seen.has(id)) { seen.add(id); out.push(byId.get(id)); }
 if (!out.length) return cards;
 for (const card of cards) if (!seen.has(card.id)) out.push(card);
 return out;
}
