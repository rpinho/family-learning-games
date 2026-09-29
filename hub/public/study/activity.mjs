import {shell,rafLoop} from './shared.mjs';import {lightAt} from './model.mjs';
export const TITLE='Under the quiet canopy';export const PROMPT='Rest here a moment. The path will wait.';export const LINES=[PROMPT];
export function mountStudy(root,options){
 const ui=shell(root,{...options,title:TITLE,prompt:PROMPT}),host=ui.$('.objects');
 host.innerHTML='<div class="canopy-light" aria-hidden="true"></div><div class="canopy-shade" aria-hidden="true"></div><button class="light-toggle" aria-pressed="true">Light on</button>';
 const light=host.querySelector('.canopy-light'),shade=host.querySelector('.canopy-shade');let enabled=true;
 const stop=rafLoop(t=>{if(!enabled)return;const p=lightAt(t);light.style.transform=`translate(${p.x-49}%,${p.y-32}%)`;light.style.opacity=p.opacity;shade.style.transform=`translate(${-1*(p.x-49)}%,0)`;});
 ui.on(host.querySelector('button'),'click',e=>{enabled=!enabled;light.hidden=shade.hidden=!enabled;e.target.textContent=enabled?'Light on':'Light off';e.target.setAttribute('aria-pressed',String(enabled));});
 return {destroy(){stop();ui.destroy();}};
}
