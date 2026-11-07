// Only published, original fantasy paintings and independently invented characters.
// This adapter never opens a household library or uses likeness references.
export function showcaseArt(library) {
 const demo=structuredClone(library);
 const guide={file:'actors/guide-map.webp',ar:2/3,size:[1024,1536]};
 demo.actors['grown-up']={name:'the mapmaker',h:.64,poses:{idle:guide,point:guide,cheer:guide}};
 // The explorer is the original painted fox, never a substitute child.
 for(const id of ['hero','bo'])demo.actors[id]={...structuredClone(demo.actors.pip),name:'the fox explorer'};
 return demo;
}
