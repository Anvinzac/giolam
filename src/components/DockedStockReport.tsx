import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronUp } from 'lucide-react';

interface DockedStockReportProps {
  /**
   * Force-hide the bar (slide under the bottom edge). The component
   * additionally hides itself when an input is focused or the virtual
   * keyboard is shown — that's the "reporting working hour" state.
   */
  hidden?: boolean;
}

/**
 * Fixed-bottom dock that lets a logged-in employee jump straight into
 * the inventory report form (/stock-alert). The bar tucks itself away
 * whenever the user is actively typing — clock-in / clock-out inputs,
 * note inputs, the on-screen keyboard — so it never covers what they're
 * editing on a salary entry. Tap on the bar fills the screen with the
 * existing StockAlertForm page (fullscreen by virtue of its own layout).
 */
export default function DockedStockReport({ hidden = false }: DockedStockReportProps) {
  const navigate = useNavigate();
  const [autoHidden, setAutoHidden] = useState(false);

  // Two complementary signals for "user is reporting work hours":
  //   1. An input / textarea is focused (covers desktop and most mobile
  //      browsers).
  //   2. visualViewport.height shrank significantly (the on-screen
  //      keyboard pushed the viewport up; covers iOS where focus events
  //      can be unreliable when chip strips / picker modals are open).
  useEffect(() => {
    const isInputLike = (el: Element | null) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const sync = () => {
      const focused = isInputLike(document.activeElement);
      const initial = (window as Window & { __stockBarBaselineVH?: number }).__stockBarBaselineVH
        ?? window.visualViewport?.height
        ?? window.innerHeight;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const shrunk = vh < initial * 0.85;
      setAutoHidden(focused || shrunk);
    };

    // Capture baseline viewport once. Resize events later compare against this.
    (window as Window & { __stockBarBaselineVH?: number }).__stockBarBaselineVH =
      window.visualViewport?.height ?? window.innerHeight;

    sync();
    window.addEventListener('focusin', sync);
    window.addEventListener('focusout', sync);
    window.visualViewport?.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('focusin', sync);
      window.removeEventListener('focusout', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);

  const slideAway = hidden || autoHidden;

  return (
    <motion.button
      type="button"
      onClick={() => navigate('/stock-alert')}
      aria-label="Báo cáo kiểm kho"
      initial={false}
      animate={{ y: slideAway ? 120 : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      whileTap={!slideAway ? { scale: 0.98 } : undefined}
      className="fixed bottom-3 left-3 right-3 z-40 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl glass-card border border-border/60 backdrop-blur-md text-left"
    >
      <span className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Package size={18} />
        </span>
        <span className="flex flex-col">
          <span className="text-[13px] font-semibold text-foreground leading-tight">
            Báo cáo kiểm kho
          </span>
          <span className="text-[11px] text-muted-foreground leading-tight">
            Chạm để mở toàn màn hình
          </span>
        </span>
      </span>
      <ChevronUp size={16} className="text-muted-foreground" />
    </motion.button>
  );
}
