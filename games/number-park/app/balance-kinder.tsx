'use client';
import { ClassicBalanceScale } from './balance-scale';
import {useScaleMotion} from './use-scale-motion';
import {massAngle} from '@/lib/balance-physics.mjs';
import {kinderCountLine} from '@/lib/balance-kinder.mjs';
import { useRef } from 'react';
import type { CSSProperties } from 'react';
type KinderProps = Parameters<typeof KinderBlockBalance>[0] & Pick<Parameters<typeof ClassicBalanceScale>[0],'experiment'|'onExperiment'>;
export function KinderBalance(props: KinderProps) {
 if(props.q.mode==='animals')return <ClassicBalanceScale {...props} q={{...props.q,direction:'heavier'}}/>;
 return <KinderBlockBalance {...props}/>;
}
function KinderBlockBalance({
  q,
  result,
  count = 0,
  disabled,
  answer,
  place,
  speak,
}: {
  q: any;
  result: any;
  count?: number;
  disabled: boolean;
  answer: (n: number) => void;
  place: (count: number) => void;
  speak: (s: string) => void;
}) {
  const blocks = q.mode === 'blocks',
    target = q.target || 0,
    targetAngle = blocks
      ? massAngle(target,count,Math.max(3,target))
      : result
        ? q.left.kg > q.right.kg
          ? -12
          : 12
        : 0;
  const angle=useScaleMotion(targetAngle);
  const delta = Math.sin((angle * Math.PI) / 180) * 170,
    pan = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number } | null>(null),
    skip = useRef(false);
  const add = () => {
    if (!disabled && !result && count < 10) {
      speak(kinderCountLine(count + 1));
      place(count + 1);
    }
  };
  const remove = () => {
    if (!disabled && !result && count > 0) {
      speak(kinderCountLine(count - 1));
      place(count - 1);
    }
  };
  return (
    <section
      className="kinder-scale"
      aria-label="Animal and counting balance"
      data-mode={q.mode}
      data-angle={targetAngle}
      data-motion-angle={angle}
      data-count={count}
    >
      <div className="kinder-scale-stage">
        <svg viewBox="0 0 500 340" aria-hidden="true">
          <rect width="500" height="340" rx="28" fill="#ecf0dd" />
          <path d="M 0 270 Q 250 235 500 270 V340 H0Z" fill="#d3e1bc" />
          <path
            d="M 225 280 L 242 83 Q250 64 258 83 L275 280Z"
            fill="#b78c58"
          />
          <rect x="190" y="280" width="120" height="18" rx="9" fill="#997249" />
          <g
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: '250px 90px',

            }}
          >
            <path
              d="M80 90 H420"
              stroke="#987044"
              strokeWidth="12"
              strokeLinecap="round"
            />
          </g>
          <ellipse cx="80" cy="295" rx={70-delta*.4} ry="9" fill="#70552a" opacity={.16-delta*.002}/>
          <ellipse cx="420" cy="295" rx={70+delta*.4} ry="9" fill="#70552a" opacity={.16+delta*.002}/>
          <circle cx="250" cy="217" r="27" fill="#fff3da" stroke="#987044" strokeWidth="3"/>
          <path className="kinder-needle" d="M250 217L247 199L250 193L253 199Z" fill="#52795f" style={{transform:`rotate(${angle*4.5}deg)`,transformOrigin:'250px 217px'}}/>
          <circle
            cx="250"
            cy="90"
            r="13"
            fill="#fff1ca"
            stroke="#987044"
            strokeWidth="4"
          />
        </svg>
        {[0, 1].map((side) => (
          <div
            key={side}
            className={'kinder-pan side-' + side}
            ref={side === 1 ? pan : undefined}
            style={
              {
                '--pan-y': `${(side === 0 ? -delta : delta) / 5}cqw`,
                '--pan-x':`${(side===0?1:-1)*170*(1-Math.cos(angle*Math.PI/180))/5}cqw`,
              } as CSSProperties
            }
          >
            <svg
              className="kinder-pan-ropes"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M50 0L5 90M50 0L95 90"
                fill="none"
                stroke="#ab8b60"
                strokeWidth="2"
              />
            </svg>
            {blocks ? (
              <div
                className="kinder-blocks"
                aria-label={`${side === 0 ? target : count} blocks`}
              >
                {Array.from({ length: side === 0 ? target : count }, (_, i) => (
                  <button
                    key={i}
                    className={'kinder-block ' + (side === 0 ? 'is-fixed' : '')}
                    aria-label={
                      side === 0 ? 'Fixed counting block' : 'Put one block back'
                    }
                    disabled={side === 0 || disabled || !!result}
                    onClick={remove}
                  />
                ))}
              </div>
            ) : (
              <button
                className={
                  'kinder-animal ' + (result?.answer === side ? 'correct' : '')
                }
                disabled={disabled || !!result}
                aria-label={'Choose ' + q[side === 0 ? 'left' : 'right'].name}
                onClick={() => answer(side)}
              >
                {q[side === 0 ? 'left' : 'right'].emoji}
              </button>
            )}
            <div
              className="kinder-pan-bowl"
              onClick={blocks && side === 1 ? add : undefined}
              role={blocks && side === 1 ? 'button' : undefined}
              tabIndex={blocks && side === 1 ? 0 : undefined}
              aria-label={
                blocks && side === 1 ? 'Add one block to this pan' : undefined
              }
              onKeyDown={(e) => {
                if (
                  blocks &&
                  side === 1 &&
                  (e.key === 'Enter' || e.key === ' ')
                ) {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </div>
        ))}
        {blocks && (
          <button
            className="kinder-block-tray"
            disabled={disabled || !!result || count >= 10}
            aria-label="Add one counting block. Tap or drag to the right pan."
            onPointerDown={(e) => {
              skip.current = false;
              drag.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              const g = drag.current;
              drag.current = null;
              if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) {
                skip.current = true;
                const box = pan.current?.getBoundingClientRect();
                if (
                  box &&
                  e.clientX >= box.left - 24 &&
                  e.clientX <= box.right + 24 &&
                  e.clientY >= box.top - 24 &&
                  e.clientY <= box.bottom + 24
                )
                  add();
              }
            }}
            onPointerCancel={() => {
              drag.current = null;
              skip.current = true;
            }}
            onClick={() => {
              if (skip.current) {
                skip.current = false;
                return;
              }
              add();
            }}
          >
            <i className="kinder-block" />
            <span aria-hidden="true">➜</span>
          </button>
        )}
        {blocks && (
          <button
            className="kinder-block-undo"
            disabled={disabled || !!result || count === 0}
            aria-label="Put one block back"
            onClick={remove}
          >
            ↩
          </button>
        )}
      </div>
      {result && (
        <div className="kinder-scale-success" aria-hidden="true">
          {result.ok ? '⭐' : '👀'}{' '}
          {blocks ? '⚖️' : q[result.answer === 0 ? 'left' : 'right'].emoji}
        </div>
      )}
    </section>
  );
}
