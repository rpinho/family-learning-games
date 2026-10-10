// A daily clue must remain tappable when its cosmetic approach has no standing spot.
// Keep the already placed hero still; the challenge lays out its own clear standing row.
export function approachDestination(findSpot,{episode=false}={}){
 try{return findSpot();}catch(error){
  if(episode&&error.message.startsWith('No clear room spot for '))return null;
  throw error;
 }
}
