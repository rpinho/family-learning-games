// Assistance is recorded per question; old token balances no longer block help.
export const hintLabel=()=> 'Show me';
export const wasHinted=(p,key)=>!!p.hintBank?.grants?.includes(key);
export function useHint(p,key){
 if(wasHinted(p,key))return false;
 const grants=[...(p.hintBank?.grants||[]),key].slice(-128);
 p.hintBank={...p.hintBank,grants};
 return true;
}
