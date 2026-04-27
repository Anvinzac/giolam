import { useState, useEffect, useRef, useCallback, ReactNode, MouseEvent, TouchEvent } from 'react';
import { createPortal } from 'react-dom';

interface FormulaTooltipProps {
  formula: string | null;
  children: ReactNode;
  className?: string;
  autoHideMs?: number;
}

export default function FormulaTooltip({
  formula,
  children,
  className,
  autoHideMs = 2500,
}: FormulaTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ tipLeft: number; tipTop: number; arrowLeft: number } | null>(null);

  const reposition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    // Anchor to the right side of the element (where right-aligned text sits)
    const anchorX = rect.right - Math.min(rect.width * 0.35, 16);
    const anchorY = rect.top - 8;

    // Estimate tooltip width (will refine after mount)
    const estWidth = 120;
    let tipLeft = anchorX - estWidth / 2;
    let arrowLeft = estWidth / 2;

    // Clamp to viewport edges with 8px padding
    const vw = window.innerWidth;
    if (tipLeft + estWidth > vw - 8) {
      const overflow = tipLeft + estWidth - (vw - 8);
      tipLeft -= overflow;
      arrowLeft += overflow;
    }
    if (tipLeft < 8) {
      const shift = 8 - tipLeft;
      tipLeft = 8;
      arrowLeft -= shift;
    }

    setPos({ tipLeft, tipTop: anchorY, arrowLeft });
  }, []);

  // Refine position after tooltip renders (actual width known)
  useEffect(() => {
    if (!open || !pos || !tipRef.current || !ref.current) return;
    const tipEl = tipRef.current;
    const tipWidth = tipEl.offsetWidth;
    const rect = ref.current.getBoundingClientRect();
    const anchorX = rect.right - Math.min(rect.width * 0.35, 16);
    const vw = window.innerWidth;

    let tipLeft = anchorX - tipWidth / 2;
    let arrowLeft = tipWidth / 2;

    if (tipLeft + tipWidth > vw - 8) {
      const overflow = tipLeft + tipWidth - (vw - 8);
      tipLeft -= overflow;
      arrowLeft += overflow;
    }
    if (tipLeft < 8) {
      const shift = 8 - tipLeft;
      tipLeft = 8;
      arrowLeft -= shift;
    }
    // Clamp arrow within tooltip bounds
    arrowLeft = Math.max(10, Math.min(arrowLeft, tipWidth - 10));

    setPos(prev => {
      if (prev && prev.tipLeft === tipLeft && prev.arrowLeft === arrowLeft) return prev;
      return { tipLeft, tipTop: prev!.tipTop, arrowLeft };
    });
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const target = e.target as Node | null;
      if (!ref.current || !target) return;
      if (!ref.current.contains(target)) setOpen(false);
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
    reposition();
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
      {open && formula && pos && createPortal(
        <span
          ref={tipRef}
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: pos.tipLeft,
            top: pos.tipTop,
            zIndex: 99999,
            transform: 'translateY(-100%)',
          }}
          aria-hidden
        >
          <span
            className="block whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-bold tracking-wide shadow-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
              backdropFilter: 'blur(16px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.6)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'hsl(var(--foreground))',
              boxShadow: '0 4px 24px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(255,255,255,0.08) inset',
            }}
          >
            {formula}
          </span>
          <span
            className="block"
            style={{
              width: 0,
              height: 0,
              marginLeft: pos.arrowLeft - 5,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid rgba(255,255,255,0.15)',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
            }}
          />
        </span>,
        document.body
      )}
    </span>
  );
}
