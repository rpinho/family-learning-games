export function shelfPage(items,page=0,size=4){
 const count=Math.max(1,Math.ceil(items.length/size));const index=Math.max(0,Math.min(count-1,Math.trunc(page)||0));
 return {items:items.slice(index*size,(index+1)*size),index,count};
}
