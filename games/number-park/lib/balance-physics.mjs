// Positive rotation lowers the right pan. The equilibrium is monotone in mass difference.
export const massAngle = (left, right, reference = 50) =>
  12 * Math.tanh((right - left) / Math.max(reference, 0.001));
export const animalAngle = (left, right) => massAngle(left, right, Math.max(left, right));

// Exact underdamped spring solution: stable even after a long or dropped frame.
// Retaining velocity when the target changes lets a newly added weight interrupt a swing naturally.
export function springStep({angle, velocity}, target, seconds) {
  const decay = 4.2, frequency = Math.sqrt(100 - decay * decay);
  const displacement = angle - target, b = (velocity + decay * displacement) / frequency;
  const t = Math.max(0, seconds), e = Math.exp(-decay * t);
  const c = Math.cos(frequency * t), s = Math.sin(frequency * t);
  return {
    angle: target + e * (displacement * c + b * s),
    velocity: e * ((b * frequency - decay * displacement) * c - (displacement * frequency + decay * b) * s),
  };
}
export const springSettled = (state, target) =>
  Math.abs(state.angle - target) < 0.015 && Math.abs(state.velocity) < 0.03;
