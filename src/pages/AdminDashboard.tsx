import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Users, Calendar, Trash2, Table2, LogOut, Bell, DollarSign, Database, Terminal, Wand2, Package, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { SpecialDayRate, DayType, DAY_TYPE_LABELS, DEFAULT_RATES } from "@/types/salary";
import { generateDefaultSpecialDays, getVietnameseDescription, formatDateViet } from "@/lib/salaryCalculations";
import AdminEmployeeList from "@/components/AdminEmployeeList";
import AdminChangesList, { getLastViewedTime } from "@/components/AdminChangesList";
import AdminRegistrations from "@/components/AdminRegistrations";
import AdminEmployeeManager from "@/components/AdminEmployeeManager";
import AdminIngredientManager from "@/components/AdminIngredientManager";
import AdminIngredientEditor from "@/components/AdminIngredientEditor";
import AdminStockReports from "@/components/AdminStockReports";
import DemoEmployeeStockView from "@/components/DemoEmployeeStockView";
import AppBootState from "@/components/AppBootState";
import { withTimeout } from "@/lib/withTimeout";

function IngredientsTab() {
  const [subTab, setSubTab] = useState<'editor' | 'assign'>('editor');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('editor')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            subTab === 'editor' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Chỉnh sửa nguyên liệu
        </button>
        <button
          onClick={() => setSubTab('assign')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            subTab === 'assign' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Phân công nhân viên
        </button>
      </div>
      {subTab === 'editor' ? <AdminIngredientEditor /> : <AdminIngredientManager />}
    </div>
  );
}

function StockReportsTab() {
  const [subTab, setSubTab] = useState<'admin' | 'demo'>('admin');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('admin')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            subTab === 'admin' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Tất cả báo cáo
        </button>
        <button
          onClick={() => setSubTab('demo')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            subTab === 'demo' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          Xem trước nhân viên
        </button>
      </div>
      {subTab === 'admin' ? <AdminStockReports /> : <DemoEmployeeStockView />}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [periods, setPeriods] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [tab, setTab] = useState<'periods' | 'employees' | 'shifts' | 'changes' | 'registrations' | 'ingredients' | 'stock-reports'>('shifts');
  const [changesBadge, setChangesBadge] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-salary-test');
      if (error) throw error;
      toast.success("Successfully seeded test data! Refreshing...");
      window.location.reload();
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to seed data: ${error.message}`);
    } finally {
      setIsSeeding(false);
    }
  };
  const [regBadge, setRegBadge] = useState(0);

  // New period form — start date defaults to 1st of previous month
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultStart = `${lastMonth.getFullYear()}-${pad(lastMonth.getMonth() + 1)}-${pad(lastMonth.getDate())}`;
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState("");
  const [offDaysSet, setOffDaysSet] = useState<Set<string>>(new Set());

  // Special day rates preview (generated before period exists)
  const [rates, setRates] = useState<SpecialDayRate[]>([]);
  const [rateEditId, setRateEditId] = useState<string | null>(null);
  const [rateEditDesc, setRateEditDesc] = useState("");
  const [rateEditPercent, setRateEditPercent] = useState("");
  const [showAddRate, setShowAddRate] = useState(false);
  const [addRateDate, setAddRateDate] = useState("");
  const [addRateType, setAddRateType] = useState<DayType>("custom");
  const [addRateDesc, setAddRateDesc] = useState("");
  const [addRatePercent, setAddRatePercent] = useState("0");
  const [rateDeleteConfirm, setRateDeleteConfirm] = useState<string | null>(null);

  // Auto-generate rates when date range changes
  useEffect(() => {
    if (!startDate || !endDate) { setRates([]); return; }
    const generated = generateDefaultSpecialDays(startDate, endDate, "__preview__", Array.from(offDaysSet));
    setRates(generated);
  }, [startDate, endDate, offDaysSet]);

  const dateRange: string[] = [];
  if (startDate && endDate) {
    const cur = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    while (cur <= end) {
      dateRange.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
      cur.setDate(cur.getDate() + 1);
    }
  }

  const toggleOffDay = (date: string) => {
    setOffDaysSet((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setLoading(true);
        setBootError(null);
        const { data: { user } } = await withTimeout(
          supabase.auth.getUser(),
          10000,
          'Session check timed out.',
        );
        if (!isMounted) return;
        if (!user) {
          setLoading(false);
          navigate("/login");
          return;
        }

        const { data: roles } = await withTimeout(
          supabase.from('user_roles').select('role').eq('user_id', user.id),
          10000,
          'Role check timed out.',
        );
        if (!isMounted) return;
        if (!roles?.some(r => r.role === 'admin')) {
          setLoading(false);
          navigate("/");
          return;
        }
        setIsAdmin(true);

        const { data: p } = await withTimeout(
          supabase.from('working_periods').select('*').eq('is_archived', false).order('start_date', { ascending: false }),
          10000,
          'Working period lookup timed out.',
        );
        if (!isMounted) return;
        setPeriods(p || []);

        if (p && p.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const { data: recentShifts } = await withTimeout(
            supabase.from('shifts').select('updated_at').eq('period_id', p[0].id).gte('shift_date', today),
            10000,
            'Recent changes lookup timed out.',
          );
          if (!isMounted) return;
          const lastViewed = getLastViewedTime();
          const unseen = (recentShifts || []).filter(s => s.updated_at > lastViewed).length;
          setChangesBadge(unseen);
        }

        const { data: profiles } = await withTimeout(
          supabase.from('profiles').select('*'),
          10000,
          'Employee lookup timed out.',
        );
        if (!isMounted) return;
        setEmployees(profiles || []);
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize admin dashboard:', error);
        if (!isMounted) return;
        setBootError(error instanceof Error ? error.message : 'Unknown startup error.');
        setLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [navigate, retryKey]);

  const createPeriod = async () => {
    if (!startDate || !endDate) { toast.error("Start and end dates required"); return; }
    
    const offDaysArray = Array.from(offDaysSet);
    
    const { data: { user } } = await supabase.auth.getUser();
    const { data: period, error } = await supabase.from('working_periods').insert({
      start_date: startDate,
      end_date: endDate,
      off_days: offDaysArray,
      created_by: user?.id,
    }).select().single();

    if (error) { toast.error(error.message); return; }

    // Insert special day rates for the new period
    if (period && rates.length > 0) {
      const periodRates = rates.map(r => ({ ...r, period_id: period.id }));
      await supabase.from('special_day_rates').insert(periodRates);
    }

    toast.success("Period created!");
    
    const { data: p } = await supabase.from('working_periods').select('*').eq('is_archived', false).order('start_date', { ascending: false });
    setPeriods(p || []);
    setStartDate(defaultStart);
    setEndDate("");
    setOffDaysSet(new Set());
    setRates([]);
  };

  const deletePeriod = async (id: string) => {
    await supabase.from('working_periods').delete().eq('id', id);
    setPeriods(prev => prev.filter(p => p.id !== id));
    toast.success("Period deleted");
  };

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="px-6 pt-12 pb-6">
       <div className="flex items-center gap-3 mb-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/")} className="p-2 rounded-xl bg-muted text-muted-foreground">
            <ArrowLeft size={18} />
          </motion.button>
          <h1 className="font-display text-xl font-bold text-gradient-gold flex-1">Admin Dashboard</h1>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}
            className="p-2 rounded-xl bg-muted text-muted-foreground"
          >
            <LogOut size={18} />
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => navigate('/admin/salary')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all"
          >
            <DollarSign size={16} />
            Lương
          </button>
          {[
            { key: 'shifts' as const, label: 'Bảng công', icon: Table2, badge: 0 },
            { key: 'registrations' as const, label: 'Đăng ký', icon: Calendar, badge: regBadge },
            { key: 'changes' as const, label: 'Thay đổi', icon: Bell, badge: changesBadge },
            { key: 'periods' as const, label: 'Kỳ làm việc', icon: Calendar, badge: 0 },
            { key: 'employees' as const, label: 'Nhân viên', icon: Users, badge: 0 },
            { key: 'ingredients' as const, label: 'Kho', icon: Package, badge: 0 },
            { key: 'stock-reports' as const, label: 'Báo cáo kho', icon: Package, badge: 0 },
          ].map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => key === 'salary' ? navigate('/admin/salary') : setTab(key)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === key ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icon size={16} />
              {label}
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 space-y-4">
        {tab === 'shifts' && (
          <>
            {periods.length > 0 ? (
              <AdminEmployeeList
                periodId={periods[0].id}
                periodStart={periods[0].start_date}
                periodEnd={periods[0].end_date}
                offDays={periods[0].off_days || []}
              />
            ) : (
              <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                Chưa có kỳ làm việc nào
              </div>
            )}
          </>
        )}

        {tab === 'registrations' && (
          <AdminRegistrations onBadgeCount={setRegBadge} />
        )}

        {tab === 'changes' && (
          <>
            {periods.length > 0 ? (
              <AdminChangesList
                periodId={periods[0].id}
                onBadgeCount={setChangesBadge}
              />
            ) : (
              <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                Chưa có kỳ làm việc nào
              </div>
            )}
          </>
        )}

        {tab === 'periods' && (
          <>
            {/* Create period */}
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm text-foreground">New Working Period</h3>
                <button 
                  onClick={() => {
                    setStartDate("2026-02-25");
                    setEndDate("2026-03-25");
                    setOffDaysSet(new Set(["2026-03-23"]));
                  }}
                  className="text-[10px] px-2 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                >
                  Quick Fill (Feb-Mar)
                </button>
                <button 
                  onClick={handleSeed}
                  disabled={isSeeding}
                  className="text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
                >
                  <Wand2 className="w-3 h-3" />
                  {isSeeding ? 'Seeding...' : 'Seed Test Data'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              {dateRange.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Off Days — tap to toggle ({offDaysSet.size} selected)
                  </label>
                  <div className="mt-1 p-2 rounded-xl bg-muted border border-border max-h-[200px] overflow-y-auto">
                    <div className="grid grid-cols-7 gap-0.5">
                      {dateRange.map((date) => {
                        const d = new Date(date + "T00:00:00");
                        const dayNum = d.getDate();
                        const monthNum = d.getMonth() + 1;
                        const isOff = offDaysSet.has(date);
                        return (
                          <button
                            key={date}
                            type="button"
                            onClick={() => toggleOffDay(date)}
                            className={`py-1.5 rounded-md text-[11px] font-medium transition-all ${
                              isOff
                                ? "bg-destructive/20 text-destructive ring-1 ring-destructive/40"
                                : "bg-background/50 text-foreground hover:bg-background"
                            }`}
                            title={date}
                          >
                            {dayNum}/{monthNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {rates.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">
                      Phụ cấp đặc biệt ({rates.length} ngày)
                    </label>
                    <button
                      onClick={() => { setShowAddRate(!showAddRate); setRateDeleteConfirm(null); }}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      + Thêm
                    </button>
                  </div>
                  <div className="rounded-xl bg-muted border border-border max-h-[180px] overflow-y-auto divide-y divide-border/30">
                    {rates.map((r) => (
                      <div key={r.id || r.special_date + r.day_type} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                        <span className="w-[60px] font-medium text-muted-foreground shrink-0">{formatDateViet(r.special_date)}</span>
                        {rateEditId === (r.id || r.special_date + r.day_type) ? (
                          <>
                            <input
                              value={rateEditDesc}
                              onChange={e => setRateEditDesc(e.target.value)}
                              className="flex-1 px-1.5 py-0.5 rounded bg-background border border-border text-xs min-w-0"
                            />
                            <input
                              value={rateEditPercent}
                              onChange={e => setRateEditPercent(e.target.value)}
                              className="w-12 px-1 py-0.5 rounded bg-background border border-border text-xs text-right"
                              inputMode="decimal"
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
                            <button
                              onClick={() => {
                                setRates(prev => prev.map(rr => (rr.id || rr.special_date + rr.day_type) === rateEditId ? { ...rr, description_vi: rateEditDesc, rate_percent: parseFloat(rateEditPercent) || 0 } : rr));
                                setRateEditId(null);
                              }}
                              className="p-0.5 text-emerald-400"
                            ><Check size={12} /></button>
                            <button onClick={() => setRateEditId(null)} className="p-0.5 text-muted-foreground"><XIcon size={12} /></button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setRateEditId(r.id || r.special_date + r.day_type); setRateEditDesc(r.description_vi); setRateEditPercent(String(r.rate_percent)); setRateDeleteConfirm(null); }}
                              className="flex-1 text-left truncate hover:text-primary transition-colors"
                            >{r.description_vi}</button>
                            <span className="text-foreground">{r.rate_percent}%</span>
                            {rateDeleteConfirm === (r.id || r.special_date + r.day_type) ? (
                              <div className="flex gap-0.5">
                                <button onClick={() => { setRates(prev => prev.filter(rr => (rr.id || rr.special_date + rr.day_type) !== rateDeleteConfirm)); setRateDeleteConfirm(null); }} className="p-0.5 text-destructive"><Check size={12} /></button>
                                <button onClick={() => setRateDeleteConfirm(null)} className="p-0.5 text-muted-foreground"><XIcon size={12} /></button>
                              </div>
                            ) : (
                              <button onClick={() => { setRateDeleteConfirm(r.id || r.special_date + r.day_type); setRateEditId(null); }} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {showAddRate && (
                    <div className="mt-2 p-3 rounded-xl bg-muted/50 border border-border space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Ngày</label>
                          <input type="date" value={addRateDate} onChange={e => setAddRateDate(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Loại</label>
                          <select value={addRateType} onChange={e => { const t = e.target.value as DayType; setAddRateType(t); setAddRatePercent(String(DEFAULT_RATES[t])); setAddRateDesc(getVietnameseDescription(t, DEFAULT_RATES[t])); }} className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-xs">
                            {(['saturday','sunday','day_before_new_moon','day_before_full_moon','new_moon','full_moon','public_holiday','custom'] as DayType[]).map(dt => (
                              <option key={dt} value={dt}>{DAY_TYPE_LABELS[dt]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_80px] gap-2">
                        <input value={addRateDesc} onChange={e => setAddRateDesc(e.target.value)} placeholder="Mô tả" className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs" />
                        <input value={addRatePercent} onChange={e => setAddRatePercent(e.target.value)} inputMode="decimal" className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs text-right" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!addRateDate) { toast.error("Chọn ngày"); return; }
                            const newId = addRateDate + "_" + addRateType;
                            setRates(prev => [...prev, {
                              period_id: "__preview__",
                              special_date: addRateDate,
                              day_type: addRateType,
                              description_vi: addRateDesc || getVietnameseDescription(addRateType, parseFloat(addRatePercent) || 0),
                              rate_percent: parseFloat(addRatePercent) || 0,
                              sort_order: prev.length,
                              id: newId,
                            }].sort((a, b) => a.special_date.localeCompare(b.special_date)));
                            setShowAddRate(false);
                            setAddRateDate("");
                            setAddRateDesc("");
                            setAddRatePercent("0");
                          }}
                          className="flex-1 py-1.5 rounded-lg gradient-gold text-primary-foreground text-xs font-semibold"
                        >+ Thêm</button>
                        <button onClick={() => { setShowAddRate(false); setAddRateDate(""); }} className="px-4 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs">Hủy</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setStartDate(defaultStart); setEndDate(""); setOffDaysSet(new Set()); }}
                  className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm"
                >
                  Hủy
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={createPeriod}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-gold text-primary-foreground font-display font-semibold text-sm"
                >
                  <Plus size={16} />
                  Create Period
                </motion.button>
              </div>
            </div>

            {/* Periods list */}
            {periods.map((p) => (
              <div key={p.id} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {formatDateViet(p.start_date)} – {formatDateViet(p.end_date)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.off_days?.length || 0} off days
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => deletePeriod(p.id)} className="p-2 rounded-xl bg-destructive/10 text-destructive">
                  <Trash2 size={16} />
                </motion.button>
              </div>
            ))}
          </>
        )}

        {tab === 'employees' && (
          <AdminEmployeeManager />
        )}

        {tab === 'ingredients' && (
          <IngredientsTab />
        )}

        {tab === 'stock-reports' && (
          <StockReportsTab />
        )}
      </div>
    </div>
  );
}
