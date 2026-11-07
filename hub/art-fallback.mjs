// Resolve each room independently so a partial library keeps its other paintings.
export async function roomArtFallback(library,stock,exists){
 const backgrounds={...stock.backgrounds,...library.backgrounds};
 for(const [id,bg] of Object.entries(backgrounds)){
  if(!bg?.file||!await exists(bg.file))backgrounds[id]=stock.backgrounds[id]||stock.backgrounds.meadow;
 }
 return {...library,backgrounds};
}
