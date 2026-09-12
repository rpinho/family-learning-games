export function moveGroup(origin,board,dx,dy){
 const x=Math.max(board.left-origin.left,Math.min(board.right-origin.right,dx));
 const y=Math.max(board.top-origin.top,Math.min(board.bottom-origin.bottom,dy));
 return {x,y,rect:{left:origin.left+x,right:origin.right+x,top:origin.top+y,bottom:origin.bottom+y}};
}
// Generous magnetic drop zone, independent of the object's count or screen size.
export const groupsNear=(a,b,margin=24)=>a.left<=b.right+margin&&a.right>=b.left-margin&&a.top<=b.bottom+margin&&a.bottom>=b.top-margin;
