// The saved checkpoints still stop movement and open their spoken puzzle on arrival.
export function checkpointMarkers(player,active){return String(player).split('_')[0]==='explorer'?[]:active.checkpoints;}
