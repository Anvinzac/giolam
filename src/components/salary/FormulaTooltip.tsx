import { useState, useEffect, useRef, ReactNode, MouseEvent, TouchEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FormulaTooltipProps {
  /**
   * The formula string to display, e.g. "22 − 15", "7 × 25", "15% × 175",
   * "175 + 26". When `null`, tapping is a no-op (nothing to explain).
   */
  formula: string | null;
  /** The visible number/text. */
  children: ReactNode;
  /** Passes through to the wrapper <span>. */
  className?: string;
  /** How long the tooltip stays visible before auto-hiding, in ms. */
  autoHideMs?: number;
}

/**
 * Tap-to-reveal tooltip that explains how a calculated number was derived.
 * Renders the value inline; on tap a small dark chip appears above the value
 * showing the formula. Auto-hides on outside tap or after a timeout.
 *
 * Designed to be drop-in compatible with `<span>` usage so it can replace
 * existing number spans without layout shift.
 */
export default function FormulaTooltip({
  formula,
  children,
  className,
  autoHideMs = 2500,
}: FormulaTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Outside-tap + auto-hide lifecycle
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
    setOpen((v) => !v);
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
      <AnimatePresence>
        {open && formula && (
          <motion.span
            key="tip"
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.95 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-1 -translate-x-1/2"
            aria-hidden
          >
            <span className="block whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-mono font-semibold text-background shadow-lg">
              {formula}
            </span>
            <span className="absolute left-1/2 top-full block h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-foreground" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
