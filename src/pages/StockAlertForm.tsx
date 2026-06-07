import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, AlertTriangle, ChevronRight, Megaphone, Send, Check } from 'lucide-react';
import { toast } from 'sonner';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';
import { buildEmployeeTitle } from '@/lib/employeeGreeting';
import { isDueToday } from '@/lib/reportFrequency';

interface AssignedIngredient {
  id: string;
  name: string;
  emoji: string;
  unit: string;
  category: string;
}

interface StockReport {
  id: string;
  ingredient_id: string;
  remaining_quantity: number | null;
  warning_message: string | null;
  is_low_stock: boolean;
  reported_at: string;
  resolved_at: string | null;
}

export default function StockAlertForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [ingredients, setIngredients] = useState<AssignedIngredient[]>([]);
  const [reports, setReports] = useState<StockReport[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Reporting state
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  type StockStatus = 'quantity' | 'het' | 'ganHet' | 'nhieu';
  const [statusMap, setStatusMap] = useState<Record<string, StockStatus>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());

  // Custom-named depletion notice (posts to the common board /notice-board).
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('');
  const [customNeedsPurchase, setCustomNeedsPurchase] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [postingCustom, setPostingCustom] = useState(false);
  const [openCountFromBoard, setOpenCountFromBoard] = useState<number | null>(null);

  const postCustomNotice = async () => {
    const name = customName.trim();
    if (!name || !userId || postingCustom) return;
    setPostingCustom(true);
    const { error } = await supabase.from('custom_depletion_notices').insert({
      reported_by: userId,
      ingredient_name: name,
      note: customNote.trim() || null,
      quantity: customQty.trim() || null,
      needs_purchase: customNeedsPurchase,
    } as any);
    setPostingCustom(false);
    if (error) {
      console.error(error);
      toast.error('Không gửi được, thử lại sau');
      return;
    }
    setCustomName('');
    setCustomQty('');
    setCustomNeedsPurchase(false);
    setCustomNote('');
    toast.success(customNeedsPurchase ? 'Đã thêm vào danh sách cần mua' : 'Đã đăng lên bảng tin');
    setOpenCountFromBoard(c => (c ?? 0) + 1);
  };

  const listRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setBootError(null);
      const { data: { user } } = await withTimeout(
        supabase.auth.getUser(),
        10000,
        'Session check timed out.',
      );
      if (!user) {
        navigate('/login');
        return;
      }
      setUserId(user.id);

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      if (prof) setFullName((prof as any).full_name || '');

      const { data: assigned } = await supabase
        .from('employee_ingredients')
        .select('ingredient_id, report_weekdays, ingredients(id, name, emoji, unit, category)')
        .eq('employee_id', user.id);
      if (assigned?.length) {
        // Only today's due ingredients — weekly / specific-weekday items
        // don't clutter the daily checklist on off days.
        const ings = assigned
          .filter((a: any) => isDueToday(a.report_weekdays))
          .map((a: any) => a.ingredients)
          .filter(Boolean);
        setIngredients(ings);
      }

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const { data: existingReports } = await supabase
        .from('stock_reports')
        .select('id, ingredient_id, remaining_quantity, warning_message, is_low_stock, reported_at, resolved_at')
        .eq('reported_by', user.id)
        .gte('reported_at', startOfMonth)
        .order('reported_at', { ascending: false });
      if (existingReports?.length) setReports(existingReports as StockReport[]);

      // Cheap "open notice count" badge for the shortcut button.
      const { count: openCount } = await supabase
        .from('custom_depletion_notices')
        .select('id', { count: 'exact', head: true })
        .is('resolved_at', null);
      setOpenCountFromBoard(openCount ?? 0);

      setLoading(false);
    } catch (error) {
      console.error('Failed to load stock alert data:', error);
      setBootError(error instanceof Error ? error.message : 'Unknown error.');
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData, retryKey]);

  // Scroll active row into view — keep it above the numpad
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const timer = setTimeout(() => {
      const row = container.querySelector(`[data-row-index="${activeIndex}"]`);
      if (!row) return;

      const rowEl = row as HTMLElement;
      const rowBottom = rowEl.offsetTop + rowEl.offsetHeight;

      // Account for numpad height
      const numpadH = 300;
      const visibleH = container.clientHeight - numpadH;
      const targetScroll = rowBottom - visibleH + 8;

      if (targetScroll > container.scrollTop) {
        container.scrollTop = Math.max(container.scrollTop, targetScroll);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeIndex]);

  const activeIngredient = ingredients[activeIndex];
  const activeQty = quantities[activeIngredient?.id] || '';
  const activeStatus = statusMap[activeIngredient?.id] || 'quantity';

  const setQty = (val: string) => {
    if (!activeIngredient) return;
    setQuantities(prev => ({ ...prev, [activeIngredient.id]: val }));
    setStatusMap(prev => ({ ...prev, [activeIngredient.id]: 'quantity' }));
  };

  const setStatus = (status: StockStatus) => {
    if (!activeIngredient) return;
    setSubmitted(prev => new Set(prev).add(activeIngredient.id));
    setStatusMap(prev => ({ ...prev, [activeIngredient.id]: status }));
    if (status === 'het') {
      setQuantities(prev => ({ ...prev, [activeIngredient.id]: '0' }));
    }
    advanceToNext();
  };

  const advanceToNext = () => {
    if (activeIndex < ingredients.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handleNumpadPress = (key: string) => {
    if (!activeIngredient) return;
    if (key === '.') {
      if (activeQty.includes('.')) return;
      setQty(activeQty === '' ? '0.' : activeQty + '.');
    } else if (key === 'DEL') {
      setQty(activeQty.slice(0, -1));
    } else {
      setQty(activeQty + key);
    }
  };

  const handleNext = () => {
    if (activeIngredient) {
      setSubmitted(prev => new Set(prev).add(activeIngredient.id));
    }
    advanceToNext();
  };

  const handleEditSubmitted = (ingId: string) => {
    const idx = ingredients.findIndex(i => i.id === ingId);
    if (idx >= 0) {
      setSubmitted(prev => {
        const next = new Set(prev);
        next.delete(ingId);
        return next;
      });
      setActiveIndex(idx);
    }
  };

  const handleSubmitAll = async () => {
    if (!userId || ingredients.length === 0) return;
    setSubmitting(true);

    const reportsToInsert = ingredients
      .filter(ing => submitted.has(ing.id) || quantities[ing.id] !== undefined || statusMap[ing.id])
      .map(ing => {
        const st = statusMap[ing.id] || 'quantity';
        let remaining: number | null = null;
        let warning = '';
        let isLow = false;

        if (st === 'het') {
          remaining = 0;
          warning = 'Hết';
          isLow = true;
        } else if (st === 'ganHet') {
          remaining = 0;
          warning = 'Gần hết';
          isLow = true;
        } else if (st === 'nhieu') {
          remaining = null;
          warning = 'Nhiều';
          isLow = false;
        } else {
          remaining = quantities[ing.id] ? parseFloat(quantities[ing.id]) : null;
          isLow = remaining !== null && remaining <= 1;
        }

        return {
          ingredient_id: ing.id,
          reported_by: userId,
          remaining_quantity: remaining,
          warning_message: warning || null,
          is_low_stock: isLow,
        };
      });

    if (reportsToInsert.length > 0) {
      await supabase.from('stock_reports').insert(reportsToInsert);
    }

    setSubmitting(false);
    navigate('/dashboard');
  };

  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'];

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 pt-12 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl bg-muted text-muted-foreground"
          >
            <ArrowLeft size={18} />
          </motion.button>
          <h1 className="font-display text-xl font-bold text-gradient-gold flex-1 truncate">
            {fullName ? buildEmployeeTitle(fullName, 'Kiểm kho') : 'Kiểm kho'}
          </h1>
          {/* Shortcut to the common notice board. Badge shows open count. */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate('/notice-board')}
            aria-label="Bảng tin kiểm kho"
            className="relative p-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            <Megaphone size={18} />
            {openCountFromBoard !== null && openCountFromBoard > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {openCountFromBoard > 99 ? '99+' : openCountFromBoard}
              </span>
            )}
          </motion.button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {submitted.size}/{ingredients.length}
          </span>
        </div>
      </header>

       {/* Ingredient list - scrollable */}
       <div
         ref={listRef}
         className="flex-1 h-0 overflow-y-auto px-4 pb-4 space-y-2"
       >
        {ingredients.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">Bạn chưa được phân công nguyên liệu nào.</p>
          </div>
        ) : (
          ingredients.map((ing, idx) => {
            const isActive = idx === activeIndex;
            const isSubmitted = submitted.has(ing.id);
            const report = reports.find(r => r.ingredient_id === ing.id);

            return (
              <motion.div
                key={ing.id}
                ref={isActive ? activeRowRef : null}
                data-row-index={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => !isSubmitted && setActiveIndex(idx)}
                className={`glass-card p-4 flex items-center gap-3 transition-all cursor-pointer ${
                  isActive ? 'ring-2 ring-primary/50 bg-muted/30' : ''
                }`}
              >
                <span className="text-2xl w-8 text-center">{ing.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{ing.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {ing.unit}
                    {report && !isSubmitted && (
                      <span className="ml-2 text-amber-500">
                        (lần trước: {report.remaining_quantity ?? '—'})
                      </span>
                    )}
                  </p>
                </div>

                {isSubmitted ? (() => {
                  const st = statusMap[ing.id];
                  const isNumeric = st === 'quantity' || (!st && quantities[ing.id]);
                  if (isNumeric) {
                    return (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditSubmitted(ing.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20"
                      >
                        <span className="text-primary text-xs font-medium">✓</span>
                        <span className="font-mono text-xs text-primary font-semibold">
                          {quantities[ing.id] || '0'}
                        </span>
                        <span className="text-xs text-primary/70">{ing.unit}</span>
                      </button>
                    );
                  }
                  const chipStyle = st === 'het'
                    ? 'bg-destructive text-destructive-foreground'
                    : st === 'ganHet'
                    ? 'bg-orange-500 text-white'
                    : 'bg-green-600 text-white';
                  const chipLabel = st === 'het' ? 'Hết' : st === 'ganHet' ? 'Gần hết' : 'Nhiều';
                  return (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditSubmitted(ing.id); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${chipStyle}`}
                    >
                      {chipLabel}
                    </button>
                  );
                })() : isActive ? (
                <div className="flex items-center gap-2 ml-3">
                    <div className="px-3 py-1.5 rounded-lg bg-background border border-border text-right min-w-[70px] font-mono text-lg">
                      {activeQty || '—'}
                    </div>
                    <ChevronRight size={16} className="text-primary" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {quantities[ing.id] ? quantities[ing.id] : '...'}
                  </span>
                )}
              </motion.div>
            );
          })
        )}

        {/* Custom-named depletion → posts to the common notice board.
            Lives at the end of the list so the assigned-ingredient flow
            stays the primary affordance; the input here is for anything
            the employee notices is running out that isn't in their
            assignment. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card p-4 mt-4 space-y-3 border border-border/40"
        >
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Megaphone size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-foreground text-sm leading-tight">
                Báo cáo nguyên liệu khác
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Đăng lên bảng tin chung
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/notice-board')}
              className="text-[11px] text-primary hover:underline shrink-0 font-medium"
            >
              Bảng tin →
            </button>
          </div>
          <div className="space-y-2">
            <input
              value={customName}
              onChange={ev => setCustomName(ev.target.value)}
              placeholder="Tên nguyên liệu (vd. Nước mắm)"
              maxLength={80}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50"
            />
            {/* Quantity + "cần mua" checkbox on one row */}
            <div className="flex items-center gap-2">
              <input
                value={customQty}
                onChange={ev => setCustomQty(ev.target.value)}
                onKeyDown={ev => { if (ev.key === 'Enter') postCustomNotice(); }}
                placeholder="Số lượng (tuỳ chọn)"
                maxLength={40}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => setCustomNeedsPurchase(v => !v)}
                aria-pressed={customNeedsPurchase}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold border transition-colors shrink-0 ${
                  customNeedsPurchase
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center ${
                  customNeedsPurchase ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'
                }`}>
                  {customNeedsPurchase && <Check size={12} strokeWidth={3} />}
                </span>
                Cần mua
              </button>
            </div>
            <input
              value={customNote}
              onChange={ev => setCustomNote(ev.target.value)}
              onKeyDown={ev => { if (ev.key === 'Enter') postCustomNotice(); }}
              placeholder="Ghi chú (tuỳ chọn)"
              maxLength={140}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={postCustomNotice}
              disabled={!customName.trim() || postingCustom}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-display font-semibold text-sm transition-colors ${
                customName.trim() && !postingCustom
                  ? 'gradient-gold text-primary-foreground shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.6)]'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <Send size={14} />
              {postingCustom ? 'Đang gửi…' : customNeedsPurchase ? 'Thêm cần mua' : 'Đăng bảng tin'}
            </motion.button>
          </div>
        </motion.div>

        {/* Spacer for numpad */}
        <div className="h-[300px]" />
      </div>

      {/* Fixed bottom panel: always visible */}
      {activeIngredient && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border"
        >
            {/* Active ingredient info + status buttons inline */}
            <div className="px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeIngredient.emoji}</span>
                <p className="font-medium text-sm flex-1 truncate">{activeIngredient.name}</p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStatus('nhieu')}
                  className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    activeStatus === 'nhieu'
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                      : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  Nhiều
                </motion.button>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setStatus('ganHet')}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                      activeStatus === 'ganHet'
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    Gần hết
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setStatus('het')}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                      activeStatus === 'het'
                        ? 'bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    Hết
                  </motion.button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 px-10">
                {activeStatus === 'het' ? 'Hết' : activeStatus === 'ganHet' ? 'Gần hết' : activeStatus === 'nhieu' ? 'Nhiều' : `${activeQty || '0'} ${activeIngredient.unit}`}
              </p>
            </div>

            {/* Numpad */}
            <div className="px-3 pb-2">
              <div className="grid grid-cols-3 gap-1.5">
                {numpadKeys.map(key => (
                  <motion.button
                    key={key}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleNumpadPress(key)}
                    className={`py-3 rounded-lg text-lg font-medium transition-colors ${
                      key === 'DEL'
                        ? 'bg-muted/50 text-muted-foreground'
                        : key === '.'
                        ? 'bg-muted text-foreground'
                        : 'bg-muted/70 text-foreground'
                    }`}
                  >
                    {key === 'DEL' ? '⌫' : key}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-3 pb-4 flex gap-2">
              {activeIndex < ingredients.length - 1 ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleNext}
                  className="flex-1 py-3 rounded-lg gradient-gold text-primary-foreground text-sm font-medium"
                >
                  Tiếp theo
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmitAll}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Đang gửi...' : `Hoàn thành (${submitted.size + 1}/${ingredients.length})`}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
    </div>
  );
}
