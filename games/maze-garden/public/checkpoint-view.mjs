// Advanced players find the route without checkpoint markers revealing it.
// The saved checkpoints still stop movement and open their spoken puzzle on arrival.
export function checkpointMarkers(player,active){return player==='explorer'?[]:active.checkpoints;}
