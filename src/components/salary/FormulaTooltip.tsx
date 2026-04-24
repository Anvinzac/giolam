import { useState, useEffect, useRef, ReactNode, MouseEvent, TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
    window.addEventListener('mousedown', onDown);
    window.addEventListener('touchstart', onDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('touchstart', onDown);
    };
  }, [open, autoHideMs]);

  const handleTap = (e: MouseEvent<HTMLSpanElement> | TouchEvent<HTMLSpanElement>) => {
    if (!formula) return;
    e.stopPropagation();
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setTipPos({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    }
    setOpen(v => !v);
  };

  const interactive = !!formula;

  const tooltip = open && formula
    ? createPortal(
        <AnimatePresence>
          <motion.span
            key="tip"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="pointer-events-none fixed z-[9999]"
            style={{
              left: tipPos.x,
              top: tipPos.y - 4,
              transform: 'translate(-50%, -100%)',
            }}
            aria-hidden
          >
            <span className="block whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-mono font-semibold text-background shadow-lg">
              {formula}
            </span>
            {/* Arrow pointing down at the number */}
            <span
              className="absolute left-1/2 top-full block h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid hsl(var(--foreground))',
              }}
            />
          </motion.span>
        </AnimatePresence>,
        document.body
      )
    : null;

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
      {tooltip}
    </span>
  );
}
