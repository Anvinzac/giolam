import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Calendar, Clock, Check, ChevronLeft, ChevronRight, X, Users, Edit3 } from "lucide-react";
import { getWeekDates, getMoonLabel } from "@/lib/lunarUtils";
import { format } from "date-fns";
import { toast } from "sonner";
import AppBootState from "@/components/AppBootState";

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const SHORT_NAMES: Record<string, string> = {
  'Minh Vũ': 'M.Vũ', 'Minh Anh': 'M.Anh', 'Hữu Khang': 'H.Khang',
};
function shortName(full: string): string { return SHORT_NAMES[full] || full; }

export default function EmployeeShiftRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [registrationStatus, setRegistrationStatus] = useState<Record<string, string>>({});
  const [pendingDetails, setPendingDetails] = useState<Record<string, { clockIn: string; clockOut: string; note: string }>>({});
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [slotNames, setSlotNames] = useState<Record<string, string[]>>({});
  const [showApproved, setShowApproved] = useState(false);

  const [editOpen, setEditOpen] = useState<{ dateStr: string; shiftKey: string } | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNote, setEditNote] = useState("");
  const editRef = useRef<HTMLDivElement>(null);
  const touchX = useRef(0);

  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday;
  });

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[start.getMonth()]} ${start.getDate()} – ${monthNames[end.getMonth()]} ${end.getDate()}`;
  }, [weekDates]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUserId(session.user.id);

      const { data: periods } = await supabase.from("working_periods")
        .select("*")
        .lte("start_date", new Date().toISOString().split("T")[0])
        .gte("end_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: false })
        .limit(1);

      const period = periods?.[0] || null;
      if (!period) {
        const { data: latest } = await supabase.from("working_periods").select("*").order("start_date", { ascending: false }).limit(1);
        if (latest?.[0]) {
          setPeriodId(latest[0].id);
          setPeriodStart(latest[0].start_date);
          setPeriodEnd(latest[0].end_date);
        } else {
          setError("Không có kỳ làm việc nào");
          setLoading(false);
          return;
        }
      } else {
        setPeriodId(period.id);
        setPeriodStart(period.start_date);
        setPeriodEnd(period.end_date);
      }

      setLoading(false);
    };
    init();
  }, [navigate]);

  useEffect(() => {
    if (!userId || !periodId) return;

    const fetchShifts = async () => {
      const { data } = await supabase.from("shifts")
        .select("shift_date, shift_slot")
        .eq("user_id", userId)
        .eq("period_id", periodId);

      const reg = new Set<string>();
      for (const s of (data || [])) {
        reg.add(`${s.shift_date}|${s.shift_slot}`);
      }
      setRegistered(reg);

      const { data: regs } = await supabase.from("shift_registrations")
        .select("shift_date, shift_slot, clock_in, clock_out, admin_note, status")
        .eq("user_id", userId);

      const pen = new Set<string>();
      const statusMap: Record<string, string> = {};
      const details: Record<string, { clockIn: string; clockOut: string; note: string }> = {};
      for (const r of (regs || [])) {
        const key = `${r.shift_date}|${r.shift_slot}`;
        if (r.status === "pending") pen.add(key);
        statusMap[key] = r.status;
        details[key] = {
          clockIn: (r as any).clock_in?.slice(0, 5) || "",
          clockOut: (r as any).clock_out?.slice(0, 5) || "",
          note: (r as any).admin_note || "",
        };
      }
      setPending(pen);
      setRegistrationStatus(statusMap);
      setPendingDetails(details);

      // Count people + names per slot
      const { data: allShifts } = await supabase.from("shifts")
        .select("shift_date, shift_slot, user_id")
        .eq("period_id", periodId);

      const userIds = [...new Set((allShifts || []).map((s: any) => s.user_id))];
      const { data: empProfiles } = await supabase.from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nameMap = new Map<string, string>();
      for (const p of (empProfiles || [])) {
        nameMap.set(p.user_id, p.full_name);
      }

      const counts: Record<string, number> = {};
      const names: Record<string, string[]> = {};
      for (const s of (allShifts || [])) {
        const k = `${s.shift_date}|${s.shift_slot}`;
        counts[k] = (counts[k] || 0) + 1;
        const name = nameMap.get(s.user_id) || "?";
        if (!names[k]) names[k] = [];
        if (!names[k].includes(name)) names[k].push(name);
      }
      setSlotCounts(counts);
      setSlotNames(names);
    };
    fetchShifts();
  }, [userId, periodId, weekDates]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditOpen(null);
      }
    };
    if (editOpen) {
      document.addEventListener("mousedown", handle);
      return () => document.removeEventListener("mousedown", handle);
    }
  }, [editOpen]);

  const quickRegister = async (dateStr: string, shiftKey: string) => {
    if (!userId || !periodId) return;
    if (registered.has(`${dateStr}|${shiftKey}`)) {
      toast.info("Ca này đã được admin đăng ký, không thể thay đổi");
      return;
    }
    const key = `${dateStr}|${shiftKey}`;
    const isPending = pending.has(key);
    const defaults = shiftKey === "morning"
      ? { clockIn: "08:00", clockOut: "15:00" }
      : { clockIn: "15:00", clockOut: "22:00" };

    if (isPending) {
      // Cancel
      await supabase.from("shift_registrations")
        .delete()
        .eq("user_id", userId)
        .eq("shift_date", dateStr)
        .eq("shift_slot", shiftKey);

      setPending(prev => { const n = new Set(prev); n.delete(key); return n; });
      setPendingDetails(prev => { const n = { ...prev }; delete n[key]; return n; });
      toast.success("Đã hủy đăng ký");
    } else {
      // Quick register with defaults
      await supabase.from("shift_registrations").upsert({
        user_id: userId,
        shift_date: dateStr,
        shift_slot: shiftKey,
        status: "pending",
        clock_in: defaults.clockIn,
        clock_out: defaults.clockOut,
        admin_note: null,
      } as any, { onConflict: "user_id,shift_date,shift_slot" });

      setPending(prev => { const n = new Set(prev); n.add(key); return n; });
      setPendingDetails(prev => ({
        ...prev, [key]: { clockIn: defaults.clockIn, clockOut: defaults.clockOut, note: "" },
      }));
      toast.success("Đã gửi đăng ký");
    }
  };

  const openEdit = (dateStr: string, shiftKey: string) => {
    const key = `${dateStr}|${shiftKey}`;
    const detail = pendingDetails[key];
    const defaults = shiftKey === "morning"
      ? { in: "08:00", out: "15:00" }
      : { in: "15:00", out: "22:00" };
    setEditClockIn(detail?.clockIn || defaults.in);
    setEditClockOut(detail?.clockOut || defaults.out);
    setEditNote(detail?.note || "");
    setEditOpen({ dateStr, shiftKey });
  };

  const saveEdit = async () => {
    if (!editOpen || !userId || !periodId) return;
    const { dateStr, shiftKey } = editOpen;

    await supabase.from("shift_registrations").upsert({
      user_id: userId,
      shift_date: dateStr,
      shift_slot: shiftKey,
      status: "pending",
      clock_in: editClockIn || null,
      clock_out: editClockOut || null,
      admin_note: editNote || null,
    } as any, { onConflict: "user_id,shift_date,shift_slot" });

    const key = `${dateStr}|${shiftKey}`;
    setPendingDetails(prev => ({
      ...prev, [key]: { clockIn: editClockIn, clockOut: editClockOut, note: editNote },
    }));
    toast.success("Đã cập nhật");
    setEditOpen(null);
  };

  if (loading) return <AppBootState error={null} onRetry={() => {}} />;

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="glass-card p-8 text-center space-y-4">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-4 overflow-hidden">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/dashboard")}
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </motion.button>
          <div className="flex-1 flex bg-muted rounded-xl p-0.5">
            <button
              onClick={() => setShowApproved(false)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                !showApproved ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Đăng ký
            </button>
            <button
              onClick={() => setShowApproved(true)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                showApproved ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Đã xếp ca
            </button>
          </div>
        </div>

        {/* Week nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground">
            <ChevronLeft size={16} />
          </button>
          <h2 className="font-display font-semibold text-xs flex items-center gap-1.5">
            <Calendar size={14} className="text-primary" />
            {weekLabel}
          </h2>
          <button onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Swipe + content area */}
      <div
        className="px-4 pt-2"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 60) {
            setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + (dx > 0 ? -7 : 7)); return d; });
          }
        }}
      >
      {showApproved ? (
        <ApprovedShiftTable weekDates={weekDates} periodId={periodId} />
      ) : (
        <>
          <div className="flex gap-4 mb-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/20 border border-success/30" /> Đã đăng ký</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/20 border border-warning/30" /> Chờ duyệt</span>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="table-fixed w-full text-xs border-collapse">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[38%]" />
                <col className="w-[38%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="bg-muted/50 px-2 py-2 font-semibold text-foreground border-b border-border">Ngày</th>
                  <th className="px-2 py-2 text-center border-b border-border text-success">
                    <Clock size={12} className="inline mr-1" />Sáng
                  </th>
                  <th className="px-2 py-2 text-center border-b border-border text-accent">
                    <Clock size={12} className="inline mr-1" />Chiều
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekDates.map(date => {
                  const dateStr = date.toISOString().split('T')[0];
                  const dayIndex = (date.getDay() + 6) % 7;
                  const isWeekend = dayIndex >= 5;
                  const moonLabel = getMoonLabel(date);
                  const hasMorning = registered.has(`${dateStr}|morning`);
                  const hasAfternoon = registered.has(`${dateStr}|afternoon`);
                  const morningStatus = registrationStatus[`${dateStr}|morning`] || '';
                  const afternoonStatus = registrationStatus[`${dateStr}|afternoon`] || '';
                  const morningDetail = pendingDetails[`${dateStr}|morning`];
                  const afternoonDetail = pendingDetails[`${dateStr}|afternoon`];
                  const morningCount = slotCounts[`${dateStr}|morning`] || 0;
                  const afternoonCount = slotCounts[`${dateStr}|afternoon`] || 0;
                  const morningNames = slotNames[`${dateStr}|morning`] || [];
                  const afternoonNames = slotNames[`${dateStr}|afternoon`] || [];

                  return (
                    <tr key={dateStr} className="border-b border-border/30 last:border-0">
                      <td className="bg-muted/30 px-1 py-2 border-r border-border text-center">
                        <div className="flex flex-wrap items-baseline justify-center gap-x-1">
                          <span className={`text-base font-bold leading-none ${isWeekend ? 'text-accent' : 'text-foreground'}`}>{DAY_NAMES[dayIndex]}</span>
                          <span className="text-sm font-semibold text-foreground/50">{format(date, 'dd')}</span>
                        </div>
                        {moonLabel && (
                          <div className="text-[10px] text-primary font-medium mt-0.5">
                            {moonLabel === 'Full Moon' ? 'Rằm' : moonLabel === 'New Moon' ? 'Mùng 1' : moonLabel.startsWith('Chay') ? 'Ngày chay' : moonLabel}
                          </div>
                        )}
                      </td>
                      <td className="p-0.5 border-r border-border/30">
                        <ToggleCell
                          dateStr={dateStr} shiftKey="morning" isAdminRegistered={hasMorning}
                          status={morningStatus} detail={morningDetail} count={morningCount} names={morningNames}
                          onTap={() => quickRegister(dateStr, "morning")}
                          onEdit={() => openEdit(dateStr, "morning")}
                        />
                      </td>
                      <td className="p-0.5">
                        <ToggleCell
                          dateStr={dateStr} shiftKey="afternoon" isAdminRegistered={hasAfternoon}
                          status={afternoonStatus} detail={afternoonDetail} count={afternoonCount} names={afternoonNames}
                          onTap={() => quickRegister(dateStr, "afternoon")}
                          onEdit={() => openEdit(dateStr, "afternoon")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      </div>

      {/* Edit modal for custom times */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditOpen(null)} />
          <motion.div ref={editRef} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="relative w-[calc(100vw-2rem)] max-w-sm bg-card border border-border rounded-2xl shadow-2xl">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-sm">
                {editOpen.shiftKey === "morning" ? "Ca Sáng" : "Ca Chiều"} — {editOpen.dateStr}
              </h3>
              <button onClick={() => setEditOpen(null)} className="p-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Giờ vào</label>
                  <input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <span className="text-muted-foreground text-sm pb-2">–</span>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Giờ ra</label>
                  <input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Ghi chú</label>
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                  placeholder="Lý do muộn, đổi ca, ..." rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={saveEdit}
                className="w-full py-2.5 rounded-xl gradient-gold text-primary-foreground font-display font-semibold text-sm">
                Lưu
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ApprovedShiftTable({ weekDates, periodId }: { weekDates: Date[]; periodId: string | null }) {
  const [shifts, setShifts] = useState<Record<string, { morning: string[]; afternoon: string[] }>>({});

  useEffect(() => {
    if (!periodId) return;
    const fetch = async () => {
      const { data: allShifts } = await supabase.from("shifts")
        .select("shift_date, shift_slot, user_id")
        .eq("period_id", periodId);

      const userIds = [...new Set((allShifts || []).map((s: any) => s.user_id))];
      const { data: empProfiles } = await supabase.from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nameMap = new Map<string, string>();
      for (const p of (empProfiles || [])) {
        nameMap.set(p.user_id, p.full_name);
      }

      const byDate: Record<string, { morning: string[]; afternoon: string[] }> = {};
      for (const s of (allShifts || [])) {
        const d = s.shift_date;
        if (!byDate[d]) byDate[d] = { morning: [], afternoon: [] };
        const name = nameMap.get(s.user_id) || "?";
        if (s.shift_slot === "afternoon") {
          byDate[d].afternoon.push(name);
        } else {
          byDate[d].morning.push(name);
        }
      }
      setShifts(byDate);
    };
    fetch();
  }, [periodId]);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="table-fixed w-full text-xs border-collapse">
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[38%]" />
          <col className="w-[38%]" />
        </colgroup>
        <thead>
          <tr>
            <th className="bg-muted/50 px-2 py-2 font-semibold text-foreground border-b border-border">Ngày</th>
            <th className="px-2 py-2 text-center border-b border-border text-success"><Clock size={12} className="inline mr-1" />Sáng</th>
            <th className="px-2 py-2 text-center border-b border-border text-accent"><Clock size={12} className="inline mr-1" />Chiều</th>
          </tr>
        </thead>
        <tbody>
          {weekDates.map(date => {
            const dateStr = date.toISOString().split("T")[0];
            const dayIndex = (date.getDay() + 6) % 7;
            const isWeekend = dayIndex >= 5;
            const day = shifts[dateStr] || { morning: [], afternoon: [] };

            return (
              <tr key={dateStr} className="border-b border-border/30 last:border-0">
                <td className="bg-muted/30 px-1 py-2 border-r border-border text-center">
                  <div className="flex flex-wrap items-baseline justify-center gap-x-1">
                    <span className={`text-base font-bold leading-none ${isWeekend ? 'text-accent' : 'text-foreground'}`}>{DAY_NAMES[dayIndex]}</span>
                    <span className="text-sm font-semibold text-foreground/50">{format(date, "dd")}</span>
                  </div>
                </td>
                <td className="px-2 py-2 border-r border-border/30">
                  <div className="flex flex-wrap gap-1">
                    {day.morning.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    ) : day.morning.map((name, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium">{shortName(name)}</span>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {day.afternoon.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    ) : day.afternoon.map((name, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-medium">{shortName(name)}</span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ToggleCell({ dateStr, shiftKey, isAdminRegistered, status, detail, count, names, onTap, onEdit }: {
  dateStr: string; shiftKey: string; isAdminRegistered: boolean;
  status: string; detail?: { clockIn: string; clockOut: string; note: string }; count: number; names: string[];
  onTap: () => void; onEdit: () => void;
}) {
  const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    pending:  { bg: 'bg-gradient-to-t from-amber-500/20 via-amber-500/10 via-60% to-transparent', text: 'text-amber-600', icon: 'text-amber-500', label: 'Chờ duyệt' },
    approved: { bg: 'bg-gradient-to-t from-emerald-500/20 via-emerald-500/10 via-60% to-transparent', text: 'text-emerald-600', icon: 'text-emerald-500', label: 'Đã duyệt' },
    rejected: { bg: 'bg-gradient-to-t from-red-500/20 via-red-500/10 via-60% to-transparent', text: 'text-red-600', icon: 'text-red-500', label: 'Từ chối' },
    modified: { bg: 'bg-gradient-to-t from-violet-500/20 via-violet-500/10 via-60% to-transparent', text: 'text-violet-600', icon: 'text-violet-500', label: 'Đã sửa' },
  };

  if (isAdminRegistered) {
    return (
      <div className="w-full rounded-sm bg-gradient-to-t from-emerald-500/20 via-emerald-500/10 via-60% to-transparent flex flex-col items-center justify-center py-3 relative">
        <Check size={16} className="text-emerald-500" />
        <span className="text-[10px] font-semibold text-emerald-600">Đã đăng ký</span>
        {count > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5 opacity-40">
            {Array.from({ length: Math.min(count, 5) }, (_, i) => (
              <Users key={i} size={8} />
            ))}
            {count > 5 && <span className="text-[8px]">+{count - 5}</span>}
          </div>
        )}
      </div>
    );
  }

  if (status && STATUS_STYLES[status]) {
    const s = STATUS_STYLES[status];
    const defaults = shiftKey === "morning" ? { in: "08:00", out: "15:00" } : { in: "15:00", out: "22:00" };
    const hasCustom = detail?.clockIn && detail?.clockOut &&
      (detail.clockIn !== defaults.in || detail.clockOut !== defaults.out || detail.note);

    return (
      <button type="button"
        onClick={status === 'pending' ? onTap : () => onEdit()}
        className={`w-full rounded-sm ${s.bg} flex flex-col items-center justify-center gap-0.5 py-3 relative`}>
        <Check size={14} className={s.icon} />
        <span className={`text-[10px] font-semibold ${s.text}`}>{s.label}</span>
        {(hasCustom || status === 'modified') && (
          <span className={`text-[8px] ${s.text}/50`}>
            {hasCustom ? `${detail!.clockIn} – ${detail!.clockOut}` : ''}
          </span>
        )}
        <span className="text-[9px] text-foreground/25 mt-1">Yêu cầu thêm</span>
        {count > 1 && (
          <span className="absolute top-0.5 right-1.5 text-[8px] opacity-40 flex items-center gap-0.5">
            <Users size={8} />{count}
          </span>
        )}
      </button>
    );
  }

  return (
    <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={onTap}
      className="w-full rounded-sm flex flex-col items-center justify-center py-3 hover:bg-muted/30 transition-colors">
      <span className="text-lg leading-none text-muted-foreground/40">+</span>
      {count > 0 && (
        <div className="flex items-center gap-0.5 mt-1 opacity-30">
          {Array.from({ length: Math.min(count, 5) }, (_, i) => (
            <Users key={i} size={8} />
          ))}
          {count > 5 && <span className="text-[8px]">+{count - 5}</span>}
        </div>
      )}
    </motion.button>
  );
}
