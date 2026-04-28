import { useState, useEffect, useRef, ReactNode, MouseEvent, TouchEvent } from 'react';
import { createPortal } from 'react-dom';

interface FormulaTooltipProps {
  formula: string | null;
  children: ReactNode;
  className?: string;
  autoHideMs?: number;
}

const ARROW_H = 5;
const ARROW_W = 5;
const R = 7;
const PAD_X = 12;
const PAD_Y = 6;
const FONT_SIZE = 11;
const LINE_H = 16;

export default function FormulaTooltip({
  formula,
  children,
  className,
  autoHideMs = 2500,
}: FormulaTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<{ left: number; top: number; arrowX: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (!open || !ref.current || !formula) return;

    // Measure text width using canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = `bold ${FONT_SIZE}px ui-monospace, monospace`;
    const textW = Math.ceil(ctx.measureText(formula).width);
    const w = textW + PAD_X * 2;
    const bodyH = LINE_H + PAD_Y * 2;
    const totalH = bodyH + ARROW_H;

    const rect = ref.current.getBoundingClientRect();
    const anchorX = rect.right - Math.min(rect.width * 0.35, 16);
    const anchorY = rect.top - 3;

    const vw = window.innerWidth;
    let left = anchorX - w / 2;
    let arrowX = w / 2;

    if (left + w > vw - 8) {
      const ov = left + w - (vw - 8);
      left -= ov;
      arrowX += ov;
    }
    if (left < 8) {
      const sh = 8 - left;
      left = 8;
      arrowX -= sh;
    }
    arrowX = Math.max(R + ARROW_W + 2, Math.min(arrowX, w - R - ARROW_W - 2));

    setStyle({ left, top: anchorY - totalH, arrowX, w, h: bodyH });
  }, [open, formula]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (!ref.current || !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const timer = window.setTimeout(() => setOpen(false), autoHideMs);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('touchstart', onDown, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('touchstart', onDown, true);
    };
  }, [open, autoHideMs]);

  const handleTap = (e: MouseEvent<HTMLSpanElement> | TouchEvent<HTMLSpanElement>) => {
    if (!formula) return;
    e.stopPropagation();
    setOpen(v => !v);
  };

  const interactive = !!formula;

  return (
    <span
      ref={ref}
      className={`relative inline-block ${interactive ? 'cursor-pointer select-none' : ''} ${className ?? ''}`}
      onClick={interactive ? handleTap : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive && formula ? `Công thức: ${formula}` : undefined}
    >
      {children}
      {open && formula && style && createPortal(
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: style.left,
            top: style.top,
            zIndex: 99999,
          }}
          aria-hidden
        >
          <svg
            width={style.w}
            height={style.h + ARROW_H}
            style={{ display: 'block', filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.4))' }}
          >
            <defs>
              <linearGradient id="tt-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(255,200,100,0.55)" />
                <stop offset="50%" stopColor="rgba(180,140,255,0.45)" />
                <stop offset="100%" stopColor="rgba(100,200,255,0.35)" />
              </linearGradient>
            </defs>
            <path
              d={bubblePath(style.w, style.h, ARROW_H, R, style.arrowX, ARROW_W)}
              fill="rgba(22,22,30,0.92)"
              stroke="url(#tt-grad)"
              strokeWidth="1.2"
            />
            <text
              x={PAD_X}
              y={PAD_Y + FONT_SIZE - 1}
              fill="rgba(255,255,255,0.92)"
              fontFamily="ui-monospace, monospace"
              fontSize={FONT_SIZE}
              fontWeight="bold"
              letterSpacing="0.02em"
            >
              {formula}
            </text>
          </svg>
        </div>,
        document.body
      )}
    </span>
  );
}

function bubblePath(w: number, bh: number, ah: number, r: number, ax: number, aw: number): string {
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `Q ${w} 0 ${w} ${r}`,
    `L ${w} ${bh - r}`,
    `Q ${w} ${bh} ${w - r} ${bh}`,
    `L ${ax + aw} ${bh}`,
    `L ${ax} ${bh + ah}`,
    `L ${ax - aw} ${bh}`,
    `L ${r} ${bh}`,
    `Q 0 ${bh} 0 ${bh - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');
}
