import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Megaphone, ShoppingCart, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';

interface Notice {
  id: string;
  reported_by: string;
  ingredient_name: string;
  note: string | null;
  reported_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  needs_purchase: boolean;
  quantity: string | null;
  dismissed_at: string | null;
  dismissed_by: string | null;
}

interface ReporterMap {
  [user_id: string]: { full_name: string; username: string };
}

const RELATIVE = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return RELATIVE.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return RELATIVE.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  return RELATIVE.format(-days, 'day');
}

/**
 * Common notice board. Every signed-in user can read; only authors and
 * admins can resolve / delete their entries.
 */
export default function NoticeBoard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [reporters, setReporters] = useState<ReporterMap>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setBootError(null);
      const { data: { user } } = await withTimeout(supabase.auth.getUser(), 10_000, 'Session check timed out.');
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);

      // Admin gate for the purchase-list done/dismiss controls.
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      setIsAdmin((roles || []).some((r: any) => r.role === 'admin'));

      const { data: rows, error } = await supabase
        .from('custom_depletion_notices')
        .select('id, reported_by, ingredient_name, note, reported_at, resolved_at, resolved_by, needs_purchase, quantity, dismissed_at, dismissed_by')
        .order('reported_at', { ascending: false });
      if (error) throw error;
      const list = (rows || []) as Notice[];
      setNotices(list);

      // Pull reporter display names in one round-trip.
      const ids = Array.from(new Set(list.map(n => n.reported_by)));
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, username')
          .in('user_id', ids);
        const map: ReporterMap = {};
        for (const p of (profs || []) as { user_id: string; full_name: string; username: string }[]) {
          map[p.user_id] = { full_name: p.full_name || p.username, username: p.username };
        }
        setReporters(map);
      } else {
        setReporters({});
      }
    } catch (err) {
      console.error('Failed to load notice board:', err);
      setBootError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load, retryKey]);

  // Live updates so the board feels current without manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel('custom_depletion_notices:board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_depletion_notices' }, () => {
        // Re-fetch the full list on any change. Cheap (single query) and
        // avoids reconciling diffs with the reporter-name cache.
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Buckets:
  //   purchase  — open + needs_purchase (the "Cần mua" shopping list)
  //   open      — open + plain notice
  //   resolved  — done or dismissed (history, collapsed)
  const { purchase, open, resolved } = useMemo(() => {
    const p: Notice[] = [];
    const o: Notice[] = [];
    const r: Notice[] = [];
    for (const n of notices) {
      const isClosed = !!n.resolved_at || !!n.dismissed_at;
      if (isClosed) r.push(n);
      else if (n.needs_purchase) p.push(n);
      else o.push(n);
    }
    return { purchase: p, open: o, resolved: r };
  }, [notices]);

  const markResolved = async (n: Notice) => {
    // Optimistic update.
    const stamp = new Date().toISOString();
    setNotices(prev => prev.map(x => x.id === n.id ? { ...x, resolved_at: stamp, resolved_by: userId } : x));
    const { error } = await supabase
      .from('custom_depletion_notices')
      .update({ resolved_at: stamp, resolved_by: userId })
      .eq('id', n.id);
    if (error) {
      console.error(error);
      setNotices(prev => prev.map(x => x.id === n.id ? { ...x, resolved_at: null, resolved_by: null } : x));
    }
  };

  const markDismissed = async (n: Notice) => {
    const stamp = new Date().toISOString();
    setNotices(prev => prev.map(x => x.id === n.id ? { ...x, dismissed_at: stamp, dismissed_by: userId } : x));
    const { error } = await supabase
      .from('custom_depletion_notices')
      .update({ dismissed_at: stamp, dismissed_by: userId } as any)
      .eq('id', n.id);
    if (error) {
      console.error(error);
      setNotices(prev => prev.map(x => x.id === n.id ? { ...x, dismissed_at: null, dismissed_by: null } : x));
    }
  };

  const reopen = async (n: Notice) => {
    const snap = { resolved_at: n.resolved_at, resolved_by: n.resolved_by, dismissed_at: n.dismissed_at, dismissed_by: n.dismissed_by };
    setNotices(prev => prev.map(x => x.id === n.id ? { ...x, resolved_at: null, resolved_by: null, dismissed_at: null, dismissed_by: null } : x));
    const { error } = await supabase
      .from('custom_depletion_notices')
      .update({ resolved_at: null, resolved_by: null, dismissed_at: null, dismissed_by: null } as any)
      .eq('id', n.id);
    if (error) {
      console.error(error);
      setNotices(prev => prev.map(x => x.id === n.id ? { ...x, ...snap } : x));
    }
  };

  const remove = async (n: Notice) => {
    const prev = notices;
    setNotices(prev.filter(x => x.id !== n.id));
    const { error } = await supabase.from('custom_depletion_notices').delete().eq('id', n.id);
    if (error) {
      console.error(error);
      setNotices(prev);
    }
  };

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(k => k + 1)} />;
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="px-6 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            aria-label="Quay lại"
            className="p-2 rounded-xl bg-muted text-muted-foreground"
          >
            <ArrowLeft size={18} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold text-gradient-gold leading-tight truncate">Bảng tin kiểm kho</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {open.length + purchase.length > 0
                ? [purchase.length > 0 ? `${purchase.length} cần mua` : null,
                   open.length > 0 ? `${open.length} thông báo` : null].filter(Boolean).join(' · ')
                : 'Mọi thứ đã được xử lý'}
            </p>
          </div>
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 text-primary">
            <Megaphone size={18} />
          </span>
        </div>
      </header>

      <div className="px-4 space-y-3">
        {/* Cần mua — dedicated shopping-list section */}
        {purchase.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <ShoppingCart size={14} className="text-amber-400" />
              <p className="text-[12px] uppercase tracking-wider text-amber-400 font-bold">
                Cần mua ({purchase.length})
              </p>
            </div>
            <AnimatePresence initial={false}>
              {purchase.map((n, idx) => {
                const r = reporters[n.reported_by];
                const canManage = isAdmin || n.reported_by === userId;
                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ delay: idx * 0.03 }}
                    className="glass-card p-4 border-l-4 border-l-amber-400 bg-amber-500/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="font-display font-bold text-foreground text-[16px] leading-tight">
                            {n.ingredient_name}
                          </p>
                          {n.quantity && (
                            <span className="text-[12px] font-semibold text-amber-400">× {n.quantity}</span>
                          )}
                        </div>
                        {n.note && (
                          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{n.note}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/80 mt-2">
                          <span className="text-foreground/70 font-medium">{r?.full_name || 'Ai đó'}</span>
                          {' · '}{formatRelative(n.reported_at)}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={() => markResolved(n)}
                            aria-label="Đã mua"
                            className="px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
                          >
                            <Check size={12} /> Đã mua
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={() => markDismissed(n)}
                            aria-label="Bỏ qua"
                            className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground border border-border text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors"
                          >
                            <X size={12} /> Bỏ qua
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Unresolved */}
        {open.length === 0 && purchase.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 text-center space-y-2"
          >
            <Sparkles className="w-10 h-10 text-primary/50 mx-auto" />
            <p className="font-display font-semibold text-foreground">Sạch bảng tin</p>
            <p className="text-xs text-muted-foreground">Chưa có thông báo nguyên liệu nào.</p>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {open.map((n, idx) => {
              const r = reporters[n.reported_by];
              const isMine = n.reported_by === userId;
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ delay: idx * 0.03 }}
                  className="glass-card p-4 border-l-4 border-l-primary/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-bold text-foreground text-[16px] leading-tight">
                        {n.ingredient_name}
                      </p>
                      {n.note && (
                        <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{n.note}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/80 mt-2">
                        <span className="text-foreground/70 font-medium">{r?.full_name || 'Ai đó'}</span>
                        {' · '}{formatRelative(n.reported_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => markResolved(n)}
                        aria-label="Đã xử lý"
                        className="px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Check size={12} /> Đã xử lý
                      </motion.button>
                      {isMine && (
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          onClick={() => remove(n)}
                          aria-label="Xoá"
                          className="p-1.5 rounded-full text-muted-foreground/60 hover:text-destructive transition-colors"
                        >
                          <Trash2 size={13} />
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Resolved (collapsed look) */}
        {resolved.length > 0 && (
          <div className="pt-2">
            <p className="px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Đã xử lý ({resolved.length})
            </p>
            <div className="mt-2 space-y-2">
              {resolved.slice(0, 10).map(n => {
                const r = reporters[n.reported_by];
                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                    className="glass-card p-3 flex items-center justify-between gap-3 opacity-70"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {n.dismissed_at ? (
                        <X size={13} className="text-muted-foreground shrink-0" />
                      ) : (
                        <Check size={13} className="text-emerald-400/70 shrink-0" />
                      )}
                      <p className="text-[13px] text-foreground/70 line-through truncate">
                        {n.ingredient_name}
                        {n.quantity && <span className="ml-1 no-underline">× {n.quantity}</span>}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        · {n.dismissed_at ? 'bỏ qua' : 'xong'}
                      </span>
                    </div>
                    {(isAdmin || n.reported_by === userId || n.resolved_by === userId || n.dismissed_by === userId) && (
                      <button
                        onClick={() => reopen(n)}
                        aria-label="Mở lại"
                        className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground transition-colors"
                      >
                        <Undo2 size={13} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
