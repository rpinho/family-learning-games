export const DRAWING_IDEAS=['Draw a tree. Any kind you like.','Draw a sun. Make it your own.','Draw a funny face.','Draw a flower. Make it your own.','Draw your house.','Draw something you love.'];
export const drawingModes=player=>player==='beginner'?['trace','shapes','free']:['trace','shapes','free','missions'];
export const initialDrawingMode=player=>player==='beginner'?'free':'trace';
