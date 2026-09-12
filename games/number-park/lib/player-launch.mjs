export const PLAYER_KEY='number-park-player';
export const PARENT_PLAYER_KEY='number-park-parent-player';
const players=['beginner','explorer','admin'];
// Device-local launch preference, not authentication or saved learning progress.
// Explicit parent links configure a device; installed start_url '/' reuses it.
// An explicit parent-menu choice also overrides a stale installed shortcut's query.
export function launchPlayer(search,stored,parentChoice){if(players.includes(parentChoice))return parentChoice;const requested=new URLSearchParams(search).get('player');return players.includes(requested)?requested:players.includes(stored)?stored:'beginner';}
export function chooseDevicePlayer({id,current,saving,draft,confirm,storage,apply,report=(_detail)=>{}}){
 if(saving||!players.includes(id)||id===current)return false;
 if(draft&&!confirm('Switch players? Saved progress stays safe, but unfinished work on this screen will close. Cancel to save your drawing or finish first.'))return false;
 // If browser storage is blocked, do not claim this device has been configured.
 storage.setItem(PARENT_PLAYER_KEY,id);
 report({from:current,to:id});apply(id);return true;
}
