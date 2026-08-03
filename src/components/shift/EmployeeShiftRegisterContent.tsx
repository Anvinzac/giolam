import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Check, ChevronLeft, ChevronRight, X, User, Edit3, HelpCircle } from "lucide-react";
import { getWeekDates, getMoonLabel, getVietnamToday } from "@/lib/lunarUtils";
import { formatLocalDate } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return full;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

interface Props { userId: string; }

export default function EmployeeShiftRegisterContent({ userId }: Props) {
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [registrationStatus, setRegistrationStatus] = useState<Record<string, string>>({});
  const [pendingDetails, setPendingDetails] = useState<Record<string, { clockIn: string; clockOut: string; note: string }>>({});
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [slotNames, setSlotNames] = useState<Record<string, string[]>>({});
  const [showApproved, setShowApproved] = useState(false);
  const tabDir = useRef(0);

  const [weekStart, setWeekStart] = useState(() => {
    const now = getVietnamToday();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday;
  });

  // Default to schedule for current/past weeks, registration for future
  useEffect(() => {
    const today = getVietnamToday();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + diff);
    setShowApproved(weekStart.getTime() <= currentMonday.getTime());
  }, [weekStart]);

  const handleToggle = () => {
    tabDir.current = showApproved ? 1 : -1;
    const today = getVietnamToday();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + diff);

    if (showApproved) {
      // Switching to registration — jump to next week if on current or past
      if (weekStart.getTime() <= currentMonday.getTime()) {
        const nextMonday = new Date(currentMonday);
        nextMonday.setDate(nextMonday.getDate() + 7);
        setWeekStart(nextMonday);
      }
    } else {
      // Switching to schedule — always reset to current week
      setWeekStart(currentMonday);
    }
    setShowApproved(!showApproved);
  };

  const [editOpen, setEditOpen] = useState<{ dateStr: string; shiftKey: string } | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNote, setEditNote] = useState("");
  const editRef = useRef<HTMLDivElement>(null);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[start.getMonth()]} ${start.getDate()} – ${monthNames[end.getMonth()]} ${end.getDate()}`;
  }, [weekDates]);

  useEffect(() => {
    const init = async () => {
      const { data: periods } = await supabase.from("working_periods")
        .select("*")
        .lte("start_date", formatLocalDate(new Date()))
        .gte("end_date", formatLocalDate(new Date()))
        .order("start_date", { ascending: false })
        .limit(1);

      const period = periods?.[0] || null;
      if (!period) {
        const { data: latest } = await supabase.from("working_periods").select("*").order("start_date", { ascending: false }).limit(1);
        if (latest?.[0]) setPeriodId(latest[0].id);
      } else {
        setPeriodId(period.id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!periodId) return;

    const fetchShifts = async () => {
      const { data: shiftsData } = await supabase.from("shifts")
        .select("shift_date, shift_slot")
        .eq("user_id", userId)
        .eq("period_id", periodId);

      const reg = new Set<string>();
      for (const s of (shiftsData || [])) reg.add(`${s.shift_date}|${s.shift_slot}`);

      const { data: allRegs } = await supabase.from("shift_registrations")
        .select("shift_date, shift_slot, clock_in, clock_out, admin_note, status")
        .eq("user_id", userId);

      const pen = new Set<string>();
      const statusMap: Record<string, string> = {};
      const details: Record<string, { clockIn: string; clockOut: string; note: string }> = {};
      for (const r of (allRegs || [])) {
        const key = `${r.shift_date}|${r.shift_slot}`;
        if (r.status === "pending") pen.add(key);
        if (r.status === "assigned") reg.add(key);
        statusMap[key] = r.status;
        details[key] = {
          clockIn: (r as any).clock_in?.slice(0, 5) || "",
          clockOut: (r as any).clock_out?.slice(0, 5) || "",
          note: (r as any).admin_note || "",
        };
      }
      setRegistered(reg);
      setPending(pen);
      setRegistrationStatus(statusMap);
      setPendingDetails(details);

      const { data: allShifts } = await supabase.from("shifts")
        .select("shift_date, shift_slot, user_id")
        .eq("period_id", periodId);

      const userIds = [...new Set((allShifts || []).map((s: any) => s.user_id))];
      const { data: empProfiles } = await supabase.from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nameMap = new Map<string, string>();
      for (const p of (empProfiles || [])) nameMap.set(p.user_id, p.full_name);

      const counts: Record<string, number> = {};
      const namesMap: Record<string, string[]> = {};
      for (const s of (allShifts || [])) {
        const k = `${s.shift_date}|${s.shift_slot}`;
        counts[k] = (counts[k] || 0) + 1;
        const name = nameMap.get(s.user_id) || "?";
        if (!namesMap[k]) namesMap[k] = [];
        if (!namesMap[k].includes(name)) namesMap[k].push(name);
      }
      setSlotCounts(counts);
      setSlotNames(namesMap);
    };
    fetchShifts();
  }, [userId, periodId, weekDates]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) setEditOpen(null);
    };
    if (editOpen) {
      document.addEventListener("mousedown", handle);
      return () => document.removeEventListener("mousedown", handle);
    }
  }, [editOpen]);

  const quickRegister = async (dateStr: string, shiftKey: string) => {
    if (!periodId) return;
    if (registered.has(`${dateStr}|${shiftKey}`)) { toast.info("Ca này đã được admin đăng ký"); return; }
    const key = `${dateStr}|${shiftKey}`;
    const isPending = pending.has(key);
    const defaults = shiftKey === "morning" ? { clockIn: "08:00", clockOut: "15:00" } : { clockIn: "15:00", clockOut: "22:00" };

    if (isPending) {
      setPending(prev => { const n = new Set(prev); n.delete(key); return n; });
      setPendingDetails(prev => { const n = { ...prev }; delete n[key]; return n; });
      setRegistrationStatus(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setPending(prev => { const n = new Set(prev); n.add(key); return n; });
      setPendingDetails(prev => ({ ...prev, [key]: { clockIn: defaults.clockIn, clockOut: defaults.clockOut, note: "" } }));
      setRegistrationStatus(prev => ({ ...prev, [key]: 'pending' }));
    }

    if (isPending) {
      await supabase.from("shift_registrations").delete().eq("user_id", userId).eq("shift_date", dateStr).eq("shift_slot", shiftKey);
      toast.success("Đã hủy đăng ký");
    } else {
      await supabase.from("shift_registrations").upsert({ user_id: userId, shift_date: dateStr, shift_slot: shiftKey, status: "pending", clock_in: defaults.clockIn, clock_out: defaults.clockOut, admin_note: null } as any, { onConflict: "user_id,shift_date,shift_slot" });
      toast.success("Đã gửi đăng ký");
    }
  };

  const openEdit = (dateStr: string, shiftKey: string) => {
    const key = `${dateStr}|${shiftKey}`;
    const detail = pendingDetails[key];
    const defaults = shiftKey === "morning" ? { in: "08:00", out: "15:00" } : { in: "15:00", out: "22:00" };
    setEditClockIn(detail?.clockIn || defaults.in);
    setEditClockOut(detail?.clockOut || defaults.out);
    setEditNote(detail?.note || "");
    setEditOpen({ dateStr, shiftKey });
  };

  const saveEdit = async () => {
    if (!editOpen || !periodId) return;
    const { dateStr, shiftKey } = editOpen;
    await supabase.from("shift_registrations").upsert({ user_id: userId, shift_date: dateStr, shift_slot: shiftKey, status: "pending", clock_in: editClockIn || null, clock_out: editClockOut || null, admin_note: editNote || null } as any, { onConflict: "user_id,shift_date,shift_slot" });
    const key = `${dateStr}|${shiftKey}`;
    setPending(prev => { const n = new Set(prev); n.add(key); return n; });
    setPendingDetails(prev => ({ ...prev, [key]: { clockIn: editClockIn, clockOut: editClockOut, note: editNote } }));
    setRegistrationStatus(prev => ({ ...prev, [key]: 'pending' }));
    toast.success("Đã cập nhật");
    setEditOpen(null);
  };

  return (
    <div className="pb-4">
      {/* Week nav with toggle */}
      <div className="flex items-center mb-3">
        <div className="flex-[6] flex items-center justify-between bg-muted/50 rounded-lg px-1.5 py-1">
          <button onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={14} />
          </button>
          <h2 className="font-display font-semibold text-xs text-foreground">{weekLabel}</h2>
          <button onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
        <button
          onClick={handleToggle}
          className="ml-3 flex-[1] py-1.5 text-[11px] font-medium rounded-lg transition-colors flex items-center justify-center bg-muted/50 text-muted-foreground hover:bg-muted"
        >
          {showApproved ? 'Lịch ca' : 'Đăng ký'}
        </button>
      </div>

      <div className="relative" style={{ minHeight: 400 }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={`${weekLabel}-${showApproved}`}
          className="absolute inset-x-0 top-0"
          initial={{ x: -tabDir.current * 120, opacity: 0 }}
          animate={{ x: 0, opacity: 1, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 } }}
          exit={{ x: tabDir.current * 120, opacity: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } }}
        >
          {showApproved ? (
            <ApprovedShiftTable weekDates={weekDates} periodId={periodId} />
          ) : (
            <>
              <div className="flex gap-4 mb-3 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/20 border border-success/30" /> Đã đăng ký</span>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/20 border border-warning/30" /> Chờ duyệt</span>
              </div>
              <div className="border border-border overflow-hidden">
                <table className="table-fixed w-full text-xs border-collapse">
                  <colgroup><col className="w-[24%]" /><col className="w-[38%]" /><col className="w-[38%]" /></colgroup>
                  <thead><tr><th className="bg-muted/50 px-2 py-2 font-semibold text-foreground border-b border-border">Ngày</th><th className="px-2 py-2 text-center border-b border-border text-success"><Clock size={12} className="inline mr-1" />Sáng</th><th className="px-2 py-2 text-center border-b border-border text-accent"><Clock size={12} className="inline mr-1" />Chiều</th></tr></thead>
                  <tbody>
                    {weekDates.map(date => {
                      const dateStr = formatLocalDate(date);
                      const dayIndex = (date.getDay() + 6) % 7;
                      const moonLabel = getMoonLabel(date);
                      return (
                        <tr key={dateStr} className="border-b border-border/30 last:border-0">
                          <td className="bg-muted/30 px-1 py-2 border-r border-border text-center select-none">
                            <div className="flex flex-wrap items-baseline justify-center gap-x-1">
                              <span className={`text-base font-bold leading-none ${dayIndex >= 5 ? 'text-accent' : 'text-foreground'}`}>{DAY_NAMES[dayIndex]}</span>
                              <span className="text-sm font-semibold text-foreground/50">{format(date, 'dd')}</span>
                            </div>
                            {moonLabel && <div className="text-[10px] text-primary font-medium mt-0.5">{moonLabel === 'Full Moon' ? 'Rằm' : moonLabel === 'New Moon' ? 'Mùng 1' : moonLabel.startsWith('Chay') ? 'Ngày chay' : moonLabel}</div>}
                          </td>
                          <td className="p-0.5 border-r border-border/30">
                            <ToggleCell dateStr={dateStr} shiftKey="morning" isAdminRegistered={registered.has(`${dateStr}|morning`)} status={registrationStatus[`${dateStr}|morning`] || ''} detail={pendingDetails[`${dateStr}|morning`]} count={slotCounts[`${dateStr}|morning`] || 0} names={slotNames[`${dateStr}|morning`] || []} onTap={() => quickRegister(dateStr, "morning")} onEdit={() => openEdit(dateStr, "morning")} />
                          </td>
                          <td className="p-0.5">
                            <ToggleCell dateStr={dateStr} shiftKey="afternoon" isAdminRegistered={registered.has(`${dateStr}|afternoon`)} status={registrationStatus[`${dateStr}|afternoon`] || ''} detail={pendingDetails[`${dateStr}|afternoon`]} count={slotCounts[`${dateStr}|afternoon`] || 0} names={slotNames[`${dateStr}|afternoon`] || []} onTap={() => quickRegister(dateStr, "afternoon")} onEdit={() => openEdit(dateStr, "afternoon")} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditOpen(null)} />
          <motion.div ref={editRef} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-[calc(100vw-2rem)] max-w-sm bg-card border border-border rounded-2xl shadow-2xl">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-sm">{editOpen.shiftKey === "morning" ? "Ca Sáng" : "Ca Chiều"} — {editOpen.dateStr}</h3>
              <button onClick={() => setEditOpen(null)} className="p-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-end justify-between w-full">
                <div className="w-[43%]"><label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Giờ vào</label><input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} className="w-full m-0 block px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none" /></div>
                <div className="flex-1 pb-3 text-center text-muted-foreground text-sm">–</div>
                <div className="w-[43%]"><label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Giờ ra</label><input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} className="w-full m-0 block px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none" /></div>
              </div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wide">Ghi chú</label><textarea value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Lý do muộn, đổi ca, ..." rows={2} className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" /></div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={saveEdit} className="w-full py-2.5 rounded-xl gradient-gold text-primary-foreground font-display font-semibold text-sm">Lưu</motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

const PERSON_COLORS = ["175 70% 45%", "280 60% 55%", "42 90% 55%", "195 85% 50%", "340 70% 55%", "155 70% 45%", "25 85% 55%", "210 70% 55%", "60 75% 50%", "0 65% 55%", "320 70% 50%", "120 65% 45%"];
const personColorMap = new Map<string, string>();
function getPersonColor(userId: string): string {
  if (!personColorMap.has(userId)) personColorMap.set(userId, PERSON_COLORS[personColorMap.size % PERSON_COLORS.length]);
  return personColorMap.get(userId)!;
}

function ApprovedShiftTable({ weekDates, periodId }: { weekDates: Date[]; periodId: string | null }) {
  const [shifts, setShifts] = useState<Record<string, { morning: { name: string; userId: string }[]; afternoon: { name: string; userId: string }[] }>>({});

  useEffect(() => {
    if (!periodId) return;
    const fetch = async () => {
      const { data: allShifts } = await supabase.from("shifts").select("shift_date, shift_slot, user_id").eq("period_id", periodId);
      const userIds = [...new Set((allShifts || []).map((s: any) => s.user_id))];
      const { data: empProfiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const nameMap = new Map<string, string>();
      for (const p of (empProfiles || [])) nameMap.set(p.user_id, p.full_name);

      const byDate: Record<string, { morning: { name: string; userId: string }[]; afternoon: { name: string; userId: string }[] }> = {};
      for (const s of (allShifts || [])) {
        const d = s.shift_date;
        if (!byDate[d]) byDate[d] = { morning: [], afternoon: [] };
        const info = { name: nameMap.get(s.user_id) || "?", userId: s.user_id };
        if (s.shift_slot === "afternoon") byDate[d].afternoon.push(info);
        else byDate[d].morning.push(info);
      }
      setShifts(byDate);
    };
    fetch();
  }, [periodId]);

  return (
    <div className="border border-border overflow-hidden">
      <table className="table-fixed w-full text-xs border-collapse">
        <colgroup><col className="w-[24%]" /><col className="w-[38%]" /><col className="w-[38%]" /></colgroup>
        <thead><tr><th className="bg-muted/50 px-2 py-2 font-semibold text-foreground border-b border-border">Ngày</th><th className="px-2 py-2 text-center border-b border-border text-success"><Clock size={12} className="inline mr-1" />Sáng</th><th className="px-2 py-2 text-center border-b border-border text-accent"><Clock size={12} className="inline mr-1" />Chiều</th></tr></thead>
        <tbody>
          {weekDates.map(date => {
            const dateStr = formatLocalDate(date);
            const dayIndex = (date.getDay() + 6) % 7;
            const day = shifts[dateStr] || { morning: [], afternoon: [] };
            return (
              <tr key={dateStr} className="border-b border-border/30 last:border-0">
                <td className="bg-muted/30 px-1 py-2 border-r border-border text-center">
                  <div className="flex flex-wrap items-baseline justify-center gap-x-1">
                    <span className={`text-base font-bold leading-none ${dayIndex >= 5 ? 'text-accent' : 'text-foreground'}`}>{DAY_NAMES[dayIndex]}</span>
                    <span className="text-sm font-semibold text-foreground/50">{format(date, "dd")}</span>
                  </div>
                </td>
                <td className="px-2 py-2 border-r border-border/30 h-[80px] align-middle">
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                    {day.morning.length === 0 ? <span className="text-[10px] text-muted-foreground/50">—</span> : day.morning.map((info, i) => <span key={i} className="text-xs font-bold" style={{ color: `hsl(${getPersonColor(info.userId)})` }}>{shortName(info.name)}</span>)}
                  </div>
                </td>
                <td className="px-2 py-2 h-[80px] align-middle">
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                    {day.afternoon.length === 0 ? <span className="text-[10px] text-muted-foreground/50">—</span> : day.afternoon.map((info, i) => <span key={i} className="text-xs font-bold" style={{ color: `hsl(${getPersonColor(info.userId)})` }}>{shortName(info.name)}</span>)}
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
  const flashRef = useRef<HTMLButtonElement>(null);
  const [editReady, setEditReady] = useState(true);
  const cooldownRef = useRef<ReturnType<typeof setTimeout>>();

  const handleEditTap = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!editReady) return;
    setEditReady(false);
    clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => setEditReady(true), 500);
    if (flashRef.current) { flashRef.current.classList.add('bg-foreground/10'); setTimeout(() => flashRef.current?.classList.remove('bg-foreground/10'), 200); }
    onEdit();
  };

  useEffect(() => { return () => clearTimeout(cooldownRef.current); }, []);

  const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    pending: { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-amber-400/35 to-transparent', text: 'text-amber-500', icon: 'text-amber-400', label: 'Chờ duyệt' },
    approved: { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-emerald-500/30 to-transparent', text: 'text-emerald-600', icon: 'text-emerald-500', label: 'Đã duyệt' },
    rejected: { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-red-500/30 to-transparent', text: 'text-red-600', icon: 'text-red-500', label: 'Từ chối' },
    modified: { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-violet-500/30 to-transparent', text: 'text-violet-600', icon: 'text-violet-500', label: 'Đã sửa' },
    assigned: { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-blue-500/25 to-transparent', text: 'text-blue-600', icon: 'text-blue-500', label: 'Admin xếp' },
  };

  if (isAdminRegistered) {
    return (
      <div className="w-full bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-emerald-500/30 to-transparent min-h-[72px] flex flex-col relative">
        <div className="h-1/3 flex items-start justify-end pt-0.5 px-1">{count > 1 && <span className="text-[8px] text-emerald-400/60 flex items-center gap-0.5"><User size={8} />{count}</span>}{count <= 1 && <span className="h-4" />}</div>
        <div className="h-1/3 flex items-center justify-center gap-1.5"><Check size={16} className="text-emerald-500" /><span className="text-[11px] font-semibold text-emerald-600">Đã đăng ký</span></div>
        <div className="h-1/3" />
      </div>
    );
  }

  if (status && STATUS_STYLES[status]) {
    const s = STATUS_STYLES[status];
    const defaults = shiftKey === "morning" ? { in: "08:00", out: "15:00" } : { in: "15:00", out: "22:00" };
    const hasCustom = detail?.clockIn && detail?.clockOut && (detail.clockIn !== defaults.in || detail.clockOut !== defaults.out || detail.note);

    return (
      <div className={`w-full ${s.bg} min-h-[72px] flex flex-col relative`}>
        <div className="h-1/2 flex flex-col">
          <div className="flex items-start justify-end pt-0.5 px-1">{count > 1 && <span className="text-[8px] opacity-40 flex items-center gap-0.5"><User size={8} />{count}</span>}{count <= 1 && <span className="h-4" />}</div>
          <button type="button" onClick={status === 'pending' ? onTap : (status === 'assigned' ? undefined : () => onEdit())} className={`flex-1 flex flex-col items-center gap-0.5 appearance-none outline-none border-0 bg-transparent ${hasCustom || status === 'modified' ? 'justify-start pt-0.5' : 'justify-center'}`}>
            <div className="flex items-center gap-1.5">
              {status === 'pending' ? <><HelpCircle size={14} className={s.icon} /><span className={`text-[11px] font-semibold ${s.text}`}>{s.label}</span></> : status === 'approved' ? <><Check size={14} className={s.icon} /><span className={`text-[11px] font-semibold ${s.text}`}>{s.label}</span></> : status === 'assigned' ? <User size={14} className={s.text} /> : <span className={`text-[11px] font-semibold ${s.text}`}>{s.label}</span>}
            </div>
            {(hasCustom || status === 'modified') && <span className={`text-[10px] ${s.text}/60`}>{detail!.clockIn !== defaults.in && detail!.clockOut !== defaults.out ? `Vào ${detail!.clockIn} – Ra ${detail!.clockOut}` : detail!.clockIn !== defaults.in ? `Vào ${detail!.clockIn}` : detail!.clockOut !== defaults.out ? `Ra ${detail!.clockOut}` : detail!.note || ''}</span>}
          </button>
        </div>
        <button ref={flashRef} type="button" onClick={handleEditTap} className="w-full h-1/2 flex items-start justify-center pt-3 appearance-none outline-none border-0 bg-transparent"><span className="text-[10px] text-foreground/60 font-medium">Yêu cầu thêm</span></button>
      </div>
    );
  }

  return (
    <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={onTap} className="w-full min-h-[72px] flex flex-col appearance-none outline-none border-0 bg-transparent">
      <div className="h-1/3 flex items-start justify-end pt-0.5 px-1">{count > 0 && <span className="text-[8px] opacity-30 flex items-center gap-0.5"><User size={8} />{count}</span>}</div>
      <div className="h-1/3 flex items-center justify-center"><span className="text-[32px] leading-none text-muted-foreground/20">+</span></div>
      <div className="h-1/3" />
    </motion.button>
  );
}
