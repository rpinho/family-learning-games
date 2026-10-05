'use client';
import {useEffect, useRef, useState} from 'react';
import {springStep, springSettled} from '@/lib/balance-physics.mjs';

export function useScaleMotion(target: number) {
  const state = useRef({angle: 0, velocity: 0});
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, last = performance.now();
    const snap = () => {state.current = {angle: target, velocity: 0}; setAngle(target);};
    const tick = (now: number) => {
      if (reduced.matches || document.hidden) {snap(); return;}
      state.current = springStep(state.current, target, (now - last) / 1000);
      last = now;
      if (springSettled(state.current, target)) {snap(); return;}
      setAngle(state.current.angle);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return angle;
}
