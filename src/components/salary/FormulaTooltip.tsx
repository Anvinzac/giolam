import { useState, useEffect, useRef, ReactNode, MouseEvent, TouchEvent } from 'react';
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
  const [tipPos, setTipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setTipPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 6,
      });
    }
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
      {open && formula && createPortal(
        <span
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: tipPos.x,
            top: tipPos.y,
            zIndex: 99999,
            transform: 'translate(-50%, -100%)',
          }}
          aria-hidden
        >
          <span className="block whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-mono font-semibold text-background shadow-lg">
            {formula}
          </span>
          <span
            className="block mx-auto"
            style={{
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid hsl(var(--foreground))',
            }}
          />
        </span>,
        document.body
      )}
    </span>
  );
}
