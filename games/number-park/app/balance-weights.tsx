'use client';
import {useScaleMotion} from './use-scale-motion';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import {
  emptyWeightDraft,
  weightTotals,
  weightAngle,
  WEIGHT_HELP,
} from '@/lib/balance-weights.mjs';

type WeightPuzzle = {
  mode: 'fixed' | 'free';
  target: number;
  fixed: number[];
  label: string;
  tray: number[];
};
export function NumberBalance({
  q,
  result,
  draft,
  disabled,
  place,
}: {
  q: { weights: WeightPuzzle };
  result: { draft?: number[] } | null;
  draft?: number[];
  disabled: boolean;
  place: (draft: number[]) => void;
}) {
  const w = q.weights;
  const [layout, setLayout] = useState<number[]>(
    draft || result?.draft || emptyWeightDraft(w),
  );
  useEffect(()=>{setLayout(draft || result?.draft || emptyWeightDraft(w));},[draft,result?.draft,w]);
  const [selected, setSelected] = useState<number | null>(null),
    [drag, setDrag] = useState<{ index: number; x: number; y: number } | null>(
      null,
    );
  const gesture = useRef<{
      index: number;
      x: number;
      y: number;
      moved: boolean;
    } | null>(null),
    skipClick = useRef(false);
  const pans = useRef<(HTMLFieldSetElement | null)[]>([]),
    tray = useRef<HTMLFieldSetElement>(null);
  const locked = disabled || !!result,
    totals = weightTotals(w, layout),
    targetAngle = weightAngle(totals[0],totals[1],Math.max(25,w.target));
  const angle=useScaleMotion(targetAngle);
  const shift=170*(1-Math.cos(angle*Math.PI/180));
  const moveWeight = (index: number, side: number) => {
    if (locked || (w.mode === 'fixed' && side === 0) || layout[index] === side)
      return;
    const next = layout.map((n, i) => (i === index ? side : n));
    setLayout(next);
    setSelected(null);
    place(next);
  };
  const down = (e: PointerEvent<HTMLButtonElement>, index: number) => {
    skipClick.current = false;
    if (locked) return;
    gesture.current = { index, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) g.moved = true;
    if (g.moved) setDrag({ index: g.index, x: e.clientX, y: e.clientY });
  };
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (!g || !g.moved) return;
    skipClick.current = true;
    const inside = (box: DOMRect | undefined) =>
      box &&
      e.clientX >= box.left &&
      e.clientX <= box.right &&
      e.clientY >= box.top &&
      e.clientY <= box.bottom;
    const side = pans.current.findIndex((p) =>
      inside(p?.getBoundingClientRect()),
    );
    if (side >= 0) moveWeight(g.index, side);
    else if (inside(tray.current?.getBoundingClientRect()))
      moveWeight(g.index, -1);
  };
  const weight = (value: number, index: number) => (
    <button
      key={index}
      type="button"
      className={
        'number-weight' +
        (selected === index ? ' selected' : '') +
        (drag?.index === index ? ' lifted' : '')
      }
      disabled={locked}
      data-weight={index}
      data-side={layout[index]}
      aria-label={`${value} weight${layout[index] === -1 ? ' in tray' : ` on ${layout[index] === 0 ? 'left' : 'right'} pan`}`}
      aria-pressed={selected === index}
      onPointerDown={(e) => down(e, index)}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        gesture.current = null;
        setDrag(null);
        skipClick.current = true;
      }}
      onKeyDown={() => {
        skipClick.current = false;
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (skipClick.current) {
          skipClick.current = false;
          return;
        }
        if (layout[index] !== -1) {
          if (selected !== null && selected !== index)
            moveWeight(selected, layout[index]);
          else moveWeight(index, -1);
        } else setSelected(selected === index ? null : index);
      }}
    >
      {value}
    </button>
  );
  const drop = Math.sin((angle * Math.PI) / 180) * 170;
  return (
    <section
      className="balance-game number-balance"
      aria-label="Number weight scale"
      data-answered={!!result}
      data-angle={targetAngle}
      data-motion-angle={angle}
      data-left={totals[0]}
      data-right={totals[1]}
      style={{ '--tip': `${angle}deg` } as CSSProperties}
    >
      <div className="number-task">
        {w.mode === 'fixed' ? (
          <>
            <span>Make it level</span>
            <strong>{w.label.includes(' × ')?w.label:w.fixed.join(' + ')}</strong>
          </>
        ) : (
          <>
            <span>Both sides free</span>
            <strong>Target: {w.target} on each pan</strong>
          </>
        )}
      </div>
      <div className="number-scale-stage">
        <svg
          className="number-scale-scene"
          viewBox="0 0 600 400"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="number-sky" x2="0" y2="1">
              <stop stopColor="#e0eff0" />
              <stop offset="1" stopColor="#f4f1dc" />
            </linearGradient>
            <linearGradient id="number-wood" x2="0" y2="1">
              <stop stopColor="#d0ad7d" />
              <stop offset="1" stopColor="#aa8152" />
            </linearGradient>
            <radialGradient id="number-pan-depth" cx="40%" cy="30%"><stop stopColor="#fff4d5"/><stop offset=".7" stopColor="#d2b079"/><stop offset="1" stopColor="#927043"/></radialGradient>
          </defs>
          <rect width="600" height="400" rx="28" fill="#f1e9d8" />
          <path
            d="M 24 292 V 86 Q 300 -40 576 86 V 292 Z"
            fill="url(#number-sky)"
            stroke="#dfd1b5"
            strokeWidth="9"
          />
          <path
            d="M 28 263 Q 170 210 309 263 Q 440 214 572 255 V 294 H 28 Z"
            fill="#bfd4ae"
          />
          <path d="M 0 303 Q 300 282 600 303 V 400 H 0 Z" fill="#e7d7bb" />
          <ellipse
            cx="300"
            cy="367"
            rx="264"
            ry="23"
            fill="#cfb38a"
            opacity=".4"
          />
          {[0,1].map(side=><ellipse key={side} cx={side===0?130+shift:470-shift} cy="364" rx={80+(side===0?-drop:drop)*.4} ry={10+(side===0?-drop:drop)*.04} fill="#70552a" opacity={.13+(side===0?-drop:drop)*.002}/>)}
          <path
            d="M 257 355 L 275 90 Q 300 65 325 90 L 343 355 Z"
            fill="url(#number-wood)"
            stroke="#957046"
            strokeWidth="3"
          />
          <rect x="239" y="347" width="122" height="19" rx="8" fill="#aa8152" />
          <g className="number-beam">
            <path
              d="M 130 100 H 470"
              stroke="#957046"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M 130 97 H 470"
              stroke="#d5b584"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>
          {[0, 1].map((side) => (
            <g
              key={side}
              className="number-pan-svg"
              style={{
                transform: `translate(${side===0?shift:-shift}px,${side === 0 ? -drop : drop}px)`,
              }}
            >
              <path
                d={`M ${side === 0 ? 130 : 470} 100 L ${side === 0 ? 28 : 368} 310 M ${side === 0 ? 130 : 470} 100 L ${side === 0 ? 232 : 572} 310`}
                fill="none"
                stroke="#b79769"
                strokeWidth="3"
              />
              <ellipse cx={side===0?130:470} cy="310" rx="102" ry="18" fill="url(#number-pan-depth)" stroke="#957046" strokeWidth="3"/>
              <path
                d={`M ${side === 0 ? 28 : 368} 310 Q ${side === 0 ? 130 : 470} 344 ${side === 0 ? 232 : 572} 310 V 321 Q ${side === 0 ? 130 : 470} 355 ${side === 0 ? 28 : 368} 321 Z`}
                fill="url(#number-wood)"
                stroke="#957046"
                strokeWidth="3"
              />
            </g>
          ))}
          <circle
            cx="300"
            cy="100"
            r="13"
            fill="#fff5da"
            stroke="#987044"
            strokeWidth="4"
          />
          <circle
            cx="300"
            cy="290"
            r="22"
            fill="#f4f1dc"
            stroke="#987044"
            strokeWidth="3"
          />
          <path d="M 282 290 A18 18 0 0 1 318 290" fill="none" stroke="#bdccb1" strokeWidth="2"/>
          <path className="number-needle" d="M300 290L297 275L300 269L303 275Z" fill="#52795f" style={{transform:`rotate(${angle*4.5}deg)`,transformOrigin:'300px 290px'}}/>
          <circle cx="300" cy="290" r="4" fill="#987044"/>
        </svg>
        {[0, 1].map((side) => (
          <div
            key={side}
            className={
              'number-pan ' +
              (side === 0 ? 'left' : 'right') +
              (selected !== null && !(w.mode === 'fixed' && side === 0)
                ? ' accepting'
                : '') +
              (result ? ' settled' : '')
            }
            style={
              {
                '--pan-drop': `${(side === 0 ? -drop : drop) / 4}%`,
                transform:`translateX(${(side===0?shift:-shift)/600/0.34*100}%)`,
              } as CSSProperties
            }
          >
            <fieldset
              ref={(el) => {
                pans.current[side] = el;
              }}
              className="number-pan-target"
              aria-label={`${side === 0 ? 'Left' : 'Right'} pan`}
            >
              <button
                type="button"
                className="number-pan-drop"
                aria-label={`Place selected weight on ${side === 0 ? 'left' : 'right'} pan`}
                disabled={
                  locked ||
                  selected === null ||
                  (w.mode === 'fixed' && side === 0)
                }
                onClick={() => {
                  if (selected !== null) moveWeight(selected, side);
                }}
              />
              <span className="number-pan-label">
                {side === 0 && w.mode === 'fixed'
                  ? 'Fixed weights'
                  : side === 0
                    ? 'Left pan'
                    : 'Right pan'}
              </span>
              <div
                className={
                  'number-pan-weights' +
                  (side === 0 && w.mode === 'fixed' ? ' fixed-weights' : '')
                }
              >
                {side === 0 && w.mode === 'fixed'
                  ? w.fixed.map((v: number, i: number) => (
                      <span key={i} className="fixed-weight">
                        {v}
                      </span>
                    ))
                  : w.tray.map((v: number, i: number) =>
                      layout[i] === side ? weight(v, i) : null,
                    )}
              </div>
              {!layout.includes(side) &&
                !(side === 0 && w.mode === 'fixed') && (
                  <span className="number-pan-empty">
                    {selected === null ? 'Place weights here' : 'Tap here'}
                  </span>
                )}
            </fieldset>
            <output
              className="number-pan-total"
              aria-label={`${side === 0 ? 'Left' : 'Right'} total`}
            >
              Sum <strong>{totals[side]}</strong>
            </output>
          </div>
        ))}
      </div>
      <fieldset
        className="number-tray"
        ref={tray}
        aria-label="Number weight tray"
      >
        <span className="number-tray-label">Number weights</span>
        <div>
          {w.tray.map((v: number, i: number) =>
            layout[i] === -1 ? weight(v, i) : null,
          )}
        </div>
      </fieldset>
      <output className="number-placement" aria-live="polite">
        {result
          ? 'Balanced. Both sides are equal.'
          : selected !== null
            ? `Place the ${w.tray[selected]} weight on a pan.`
            : WEIGHT_HELP}
      </output>
      {drag && (
        <div
          className="number-drag-ghost"
          aria-hidden="true"
          style={{ left: drag.x, top: drag.y }}
        >
          {w.tray[drag.index]}
        </div>
      )}
    </section>
  );
}
