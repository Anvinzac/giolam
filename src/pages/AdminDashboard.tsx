import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Users, Calendar, Trash2, Table2, LogOut, Bell } from "lucide-react";
import { toast } from "sonner";
import AdminEmployeeList from "@/components/AdminEmployeeList";
import AdminChangesList, { getLastViewedTime } from "@/components/AdminChangesList";
import AdminRegistrations from "@/components/AdminRegistrations";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [periods, setPeriods] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [tab, setTab] = useState<'periods' | 'employees' | 'shifts' | 'changes' | 'registrations'>('shifts');
  const [changesBadge, setChangesBadge] = useState(0);
  const [regBadge, setRegBadge] = useState(0);

  // New period form
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [offDays, setOffDays] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      if (!roles?.some(r => r.role === 'admin')) { navigate("/"); return; }
      setIsAdmin(true);

      // Fetch periods
      const { data: p } = await supabase.from('working_periods').select('*').order('start_date', { ascending: false });
      setPeriods(p || []);

      // Compute initial badge count for changes tab
      if (p && p.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const { data: recentShifts } = await supabase
          .from('shifts')
          .select('updated_at')
          .eq('period_id', p[0].id)
          .gte('shift_date', today);
        const lastViewed = getLastViewedTime();
        const unseen = (recentShifts || []).filter(s => s.updated_at > lastViewed).length;
        setChangesBadge(unseen);
      }

      // Fetch employees  
      const { data: profiles } = await supabase.from('profiles').select('*');
      setEmployees(profiles || []);

      setLoading(false);
    };
    init();
  }, [navigate]);

  const createPeriod = async () => {
    if (!startDate || !endDate) { toast.error("Start and end dates required"); return; }
    
    const offDaysArray = offDays.split(',').map(d => d.trim()).filter(Boolean);
    
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('working_periods').insert({
      start_date: startDate,
      end_date: endDate,
      off_days: offDaysArray,
      created_by: user?.id,
    });

    if (error) { toast.error(error.message); return; }
    toast.success("Period created!");
    
    const { data: p } = await supabase.from('working_periods').select('*').order('start_date', { ascending: false });
    setPeriods(p || []);
    setStartDate("");
    setEndDate("");
    setOffDays("");
  };

  const deletePeriod = async (id: string) => {
    await supabase.from('working_periods').delete().eq('id', id);
    setPeriods(prev => prev.filter(p => p.id !== id));
    toast.success("Period deleted");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
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
          {[
            { key: 'shifts' as const, label: 'Bảng công', icon: Table2, badge: 0 },
            { key: 'registrations' as const, label: 'Đăng ký', icon: Calendar, badge: regBadge },
            { key: 'changes' as const, label: 'Thay đổi', icon: Bell, badge: changesBadge },
            { key: 'periods' as const, label: 'Kỳ làm việc', icon: Calendar, badge: 0 },
            { key: 'employees' as const, label: 'Nhân viên', icon: Users, badge: 0 },
          ].map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
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
              <h3 className="font-display font-semibold text-sm text-foreground">New Working Period</h3>
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
              <div>
                <label className="text-xs text-muted-foreground">Off Days (comma-separated dates: YYYY-MM-DD)</label>
                <input
                  type="text"
                  value={offDays}
                  onChange={(e) => setOffDays(e.target.value)}
                  placeholder="2026-02-08, 2026-02-15"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={createPeriod}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-gold text-primary-foreground font-display font-semibold text-sm"
              >
                <Plus size={16} />
                Create Period
              </motion.button>
            </div>

            {/* Periods list */}
            {periods.map((p) => (
              <div key={p.id} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
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
          <>
            {employees.map((emp) => (
              <div key={emp.id} className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{emp.full_name || 'Unnamed'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Type: {emp.shift_type} | Default: {emp.default_clock_in || 'None'} – {emp.default_clock_out || 'None'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {employees.length === 0 && (
              <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                No employees registered yet
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
