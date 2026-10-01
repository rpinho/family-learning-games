export function heading(index,turn){return (index+(turn==='left'?6:2))%8;}
export function addTurn(plan,id){return ['left','right'].includes(id)&&plan.length<2?[...plan,id]:plan;}
export const safePlan=p=>p.length===2&&p[0]==='left'&&p[1]==='right';
export function frame(index){if(!Number.isInteger(index)||index<0||index>7)throw Error('Invalid facing');return -index*256;}
