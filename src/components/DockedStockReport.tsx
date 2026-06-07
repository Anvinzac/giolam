import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronUp, Maximize2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isDueToday } from '@/lib/reportFrequency';

interface DockedStockReportProps {
  /** Force-hide the collapsed bar (it also auto-hides while the user types). */
  hidden?: boolean;
}

interface AssignedIngredient {
  id: string;
  name: string;
  emoji: string;
  unit: string;
}

type QuickStatus = 'het' | 'ganHet' | 'nhieu';

interface RowState {
  status?: QuickStatus;
  qty?: string;
  reported?: boolean;
}

// Other surfaces (e.g. the published-salary header button) open the sheet
// by dispatching this window event, so we don't have to prop-drill an
// open handler through every page that mounts the dock.
export const OPEN_STOCK_REPORT_EVENT = 'giolam:open-stock-report';
export function openStockReport() {
  window.dispatchEvent(new CustomEvent(OPEN_STOCK_REPORT_EVENT));
}

/**
 * Docked inventory reporter. Collapsed it's a slim bar; tapping it (or
 * firing openStockReport()) slides up a sheet that previews every
 * ingredient the employee is responsible for. Each row can be reported
 * in one tap (Hết / Gần hết / Nhiều) or by typing a remaining quantity —
 * no page navigation needed. Tapping the backdrop dismisses the sheet
 * entirely. A "toàn màn hình" affordance still opens the full
 * StockAlertForm for the numpad-driven flow.
 */
export default function DockedStockReport({ hidden = false }: DockedStockReportProps) {
  const navigate = useNavigate();
  const [autoHidden, setAutoHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<AssignedIngredient[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loaded, setLoaded] = useState(false);

  // ── Auto-hide the collapsed bar while the user is typing salary data ──
  useEffect(() => {
    const isInputLike = (el: Element | null) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };
    const sync = () => {
      const focused = isInputLike(document.activeElement);
      const baseline = (window as Window & { __stockBarBaselineVH?: number }).__stockBarBaselineVH
        ?? window.visualViewport?.height ?? window.innerHeight;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const shrunk = vh < baseline * 0.85;
      // Don't auto-hide while our own sheet is open (its inputs focus too).
      setAutoHidden(!open && (focused || shrunk));
    };
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
  }, [open]);

  // ── Lazy-load assigned ingredients the first time the sheet opens ──
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: assigned } = await supabase
      .from('employee_ingredients')
      .select('ingredient_id, report_weekdays, ingredients(id, name, emoji, unit)')
      .eq('employee_id', user.id);
    // Only surface ingredients due today — weekly / specific-weekday
    // assignments stay hidden on the days they aren't scheduled.
    const ings: AssignedIngredient[] = (assigned || [])
      .filter((a: any) => isDueToday(a.report_weekdays))
      .map((a: any) => a.ingredients)
      .filter(Boolean);
    setIngredients(ings);

    // Pre-fill rows from today's existing reports so re-opening shows state.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: todays } = await supabase
      .from('stock_reports')
      .select('ingredient_id, remaining_quantity, warning_message, reported_at')
      .eq('reported_by', user.id)
      .gte('reported_at', startOfDay.toISOString())
      .order('reported_at', { ascending: false });
    const seeded: Record<string, RowState> = {};
    for (const r of (todays || []) as any[]) {
      if (seeded[r.ingredient_id]) continue; // keep most-recent only
      const w = r.warning_message;
      seeded[r.ingredient_id] = {
        reported: true,
        status: w === 'Hết' ? 'het' : w === 'Gần hết' ? 'ganHet' : w === 'Nhiều' ? 'nhieu' : undefined,
        qty: r.remaining_quantity != null ? String(r.remaining_quantity) : undefined,
      };
    }
    setRows(seeded);
    setLoaded(true);
  }, []);

  const doOpen = useCallback(() => {
    setOpen(true);
    if (!loaded) load();
  }, [loaded, load]);

  // External open trigger (salary-page header button etc.)
  useEffect(() => {
    const handler = () => doOpen();
    window.addEventListener(OPEN_STOCK_REPORT_EVENT, handler);
    return () => window.removeEventListener(OPEN_STOCK_REPORT_EVENT, handler);
  }, [doOpen]);

  // ── Per-row reporting ──────────────────────────────────────────────
  const persist = async (ing: AssignedIngredient, state: RowState) => {
    if (!userId) return;
    let remaining: number | null = null;
    let warning: string | null = null;
    let isLow = false;
    if (state.status === 'het') { remaining = 0; warning = 'Hết'; isLow = true; }
    else if (state.status === 'ganHet') { remaining = 0; warning = 'Gần hết'; isLow = true; }
    else if (state.status === 'nhieu') { warning = 'Nhiều'; }
    else if (state.qty != null && state.qty !== '') {
      remaining = parseFloat(state.qty);
      isLow = !Number.isNaN(remaining) && remaining <= 1;
    } else {
      return; // nothing to report
    }
    const { error } = await supabase.from('stock_reports').insert({
      ingredient_id: ing.id,
      reported_by: userId,
      remaining_quantity: remaining,
      warning_message: warning,
      is_low_stock: isLow,
    });
    if (error) { console.error(error); toast.error('Không lưu được'); return; }
    setRows(prev => ({ ...prev, [ing.id]: { ...prev[ing.id], reported: true } }));
  };

  const pickStatus = (ing: AssignedIngredient, status: QuickStatus) => {
    const next: RowState = { status, qty: undefined, reported: false };
    setRows(prev => ({ ...prev, [ing.id]: next }));
    persist(ing, next);
  };

  const setQty = (ing: AssignedIngredient, qty: string) => {
    setRows(prev => ({ ...prev, [ing.id]: { status: undefined, qty, reported: false } }));
  };

  const submitQty = (ing: AssignedIngredient) => {
    const st = rows[ing.id];
    if (st?.qty) persist(ing, st);
  };

  const reportedCount = ingredients.filter(i => rows[i.id]?.reported).length;
  const slideAway = hidden || autoHidden;

  return (
    <>
      {/* Collapsed bar */}
      <motion.button
        type="button"
        onClick={doOpen}
        aria-label="Báo cáo kiểm kho"
        initial={false}
        animate={{ y: slideAway || open ? 120 : 0, opacity: open ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        whileTap={!slideAway && !open ? { scale: 0.98 } : undefined}
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
              Chạm để báo nhanh nguyên liệu
            </span>
          </span>
        </span>
        <ChevronUp size={16} className="text-muted-foreground" />
      </motion.button>

      {/* Expanded sheet + backdrop */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[78vh] flex flex-col rounded-t-3xl glass-card border-t border-border/60 overflow-hidden"
            >
              {/* Grab handle */}
              <div className="flex justify-center pt-2.5 pb-1">
                <span className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="flex items-center gap-3 px-5 pt-1 pb-3">
                <span className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Package size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-bold text-foreground leading-tight">Báo cáo kiểm kho</h3>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {ingredients.length > 0
                      ? `${reportedCount}/${ingredients.length} đã báo`
                      : 'Nguyên liệu phụ trách'}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/stock-alert')}
                  aria-label="Toàn màn hình"
                  className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Maximize2 size={16} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Đóng"
                  className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Ingredient list */}
              <div className="flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
                {!loaded ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" />
                  </div>
                ) : ingredients.length === 0 ? (
                  <div className="glass-card p-6 text-center space-y-2 mt-2">
                    <p className="text-sm text-muted-foreground">Bạn chưa được phân công nguyên liệu nào.</p>
                    <button
                      onClick={() => navigate('/stock-alert')}
                      className="text-xs text-primary hover:underline"
                    >
                      Mở trang kiểm kho →
                    </button>
                  </div>
                ) : (
                  ingredients.map((ing, idx) => {
                    const st = rows[ing.id] || {};
                    const chip = (key: QuickStatus, label: string, tone: string) => (
                      <button
                        key={key}
                        onClick={() => pickStatus(ing, key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                          st.status === key ? tone : 'border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {label}
                      </button>
                    );
                    return (
                      <motion.div
                        key={ing.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                        className={`rounded-2xl border p-3 transition-colors ${
                          st.reported ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/40 bg-muted/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl leading-none shrink-0">{ing.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-semibold text-foreground leading-tight truncate">
                              {ing.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              Đơn vị: {ing.unit}
                            </p>
                          </div>
                          {st.reported && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 shrink-0">
                              <Check size={13} /> Đã báo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                          {chip('het', 'Hết', 'border-destructive bg-destructive/15 text-destructive')}
                          {chip('ganHet', 'Gần hết', 'border-amber-500 bg-amber-500/15 text-amber-500')}
                          {chip('nhieu', 'Nhiều', 'border-emerald-500 bg-emerald-500/15 text-emerald-500')}
                          <div className="flex items-center gap-1 ml-auto">
                            <input
                              inputMode="decimal"
                              value={st.qty ?? ''}
                              onChange={e => setQty(ing, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') submitQty(ing); }}
                              onBlur={() => submitQty(ing)}
                              placeholder="SL"
                              className="w-[58px] px-2 py-1 rounded-lg bg-background border border-border text-[13px] text-right focus:outline-none focus:border-primary/50"
                            />
                            <span className="text-[10px] text-muted-foreground w-8 truncate">{ing.unit}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
