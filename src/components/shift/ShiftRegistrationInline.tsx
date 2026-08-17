import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Check, ChevronLeft, ChevronRight, X, User, HelpCircle, LayoutList } from "lucide-react";
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

const PERSON_COLORS = [
  "175 70% 45%",
  "280 60% 55%",
  "42 90% 55%",
  "195 85% 50%",
  "340 70% 55%",
  "155 70% 45%",
  "25 85% 55%",
  "210 70% 55%",
  "60 75% 50%",
  "0 65% 55%",
  "320 70% 50%",
  "120 65% 45%",
];
const personColorMap = new Map<string, string>();
function getPersonColor(userId: string): string {
  if (!personColorMap.has(userId)) {
    personColorMap.set(userId, PERSON_COLORS[personColorMap.size % PERSON_COLORS.length]);
  }
  return personColorMap.get(userId)!;
}

// Cells the employee is rostered on get a soft tint; co-workers'
// names stay legible but recede so their own shifts pop at a glance.
const MINE_CELL_OUTLINE = 'bg-primary/10';
const OTHERS_NAME_OPACITY = 'opacity-30';

interface ShiftRegistrationInlineProps {
  userId: string;
  periodId: string;
  fullName: string;
}

export default function ShiftRegistrationInline({ userId, periodId, fullName }: ShiftRegistrationInlineProps) {
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [registrationStatus, setRegistrationStatus] = useState<Record<string, string>>({});
  const [pendingDetails, setPendingDetails] = useState<Record<string, { clockIn: string; clockOut: string; note: string }>>({});
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [slotNames, setSlotNames] = useState<Record<string, { name: string; userId: string }[]>>({});
  const [showApproved, setShowApproved] = useState(false);
  const slideDir = useRef(0);

  const [editOpen, setEditOpen] = useState<{ dateStr: string; shiftKey: string } | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNote, setEditNote] = useState("");
  const editRef = useRef<HTMLDivElement>(null);

  const [weekStart, setWeekStart] = useState(() => {
    const now = getVietnamToday();
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
    const vnDay = (d: Date) => `${d.getDate()} Th ${d.getMonth() + 1}`;
    return `${vnDay(start)} – ${vnDay(end)}`;
  }, [weekDates]);

  useEffect(() => {
    if (!userId) return;

    const fetchShifts = async () => {
      let shiftsQuery = supabase.from("shifts")
        .select("shift_date, shift_slot")
        .eq("user_id", userId);
      if (periodId) shiftsQuery = shiftsQuery.eq("period_id", periodId);
      const { data: shiftsData } = await shiftsQuery;

      const reg = new Set<string>();
      for (const s of (shiftsData || [])) {
        reg.add(`${s.shift_date}|${s.shift_slot}`);
      }

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

      let allShiftsQuery = supabase.from("shifts")
        .select("shift_date, shift_slot, user_id");
      if (periodId) allShiftsQuery = allShiftsQuery.eq("period_id", periodId);
      const { data: allShifts } = await allShiftsQuery;

      const userIds = [...new Set((allShifts || []).map((s: any) => s.user_id))];
      const { data: empProfiles } = await supabase.from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nameMap = new Map<string, string>();
      for (const p of (empProfiles || [])) {
        nameMap.set(p.user_id, p.full_name);
      }

      const counts: Record<string, number> = {};
      const names: Record<string, { name: string; userId: string }[]> = {};
      for (const s of (allShifts || [])) {
        const k = `${s.shift_date}|${s.shift_slot}`;
        counts[k] = (counts[k] || 0) + 1;
        const name = nameMap.get(s.user_id) || "?";
        if (!names[k]) names[k] = [];
        if (!names[k].some(n => n.userId === s.user_id)) {
          names[k].push({ name, userId: s.user_id });
        }
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
      setPending(prev => { const n = new Set(prev); n.delete(key); return n; });
      setPendingDetails(prev => { const n = { ...prev }; delete n[key]; return n; });
      setRegistrationStatus(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setPending(prev => { const n = new Set(prev); n.add(key); return n; });
      setPendingDetails(prev => ({
        ...prev, [key]: { clockIn: defaults.clockIn, clockOut: defaults.clockOut, note: "" },
      }));
      setRegistrationStatus(prev => ({ ...prev, [key]: 'pending' }));
    }

    if (isPending) {
      await supabase.from("shift_registrations")
        .delete()
        .eq("user_id", userId)
        .eq("shift_date", dateStr)
        .eq("shift_slot", shiftKey);
      toast.success("Đã hủy đăng ký");
    } else {
      await supabase.from("shift_registrations").upsert({
        user_id: userId,
        shift_date: dateStr,
        shift_slot: shiftKey,
        status: "pending",
        clock_in: defaults.clockIn,
        clock_out: defaults.clockOut,
        admin_note: null,
      } as any, { onConflict: "user_id,shift_date,shift_slot" });
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
    if (!editOpen) return;
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
    setPending(prev => { const n = new Set(prev); n.add(key); return n; });
    setPendingDetails(prev => ({
      ...prev, [key]: { clockIn: editClockIn, clockOut: editClockOut, note: editNote },
    }));
    setRegistrationStatus(prev => ({ ...prev, [key]: 'pending' }));
    toast.success("Đã cập nhật");
    setEditOpen(null);
  };

  return (
    <div className="flex flex-col">
      {/* Week nav */}
      <div className="flex items-center px-4 py-2">
        <div className="flex items-center gap-1 w-[60%] min-w-0">
          <button
            onClick={() => { slideDir.current = -1; setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; }); }}
            className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="flex-1 font-display font-semibold text-xs text-center truncate flex items-center justify-center gap-1.5">
            <Calendar size={14} className="text-primary shrink-0" />
            {weekLabel}
          </h2>
          <button
            onClick={() => { slideDir.current = 1; setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; }); }}
            className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="w-[10%]" />
        <button
          onClick={() => {
            const today = getVietnamToday();
            const day = today.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            const currentMonday = new Date(today);
            currentMonday.setDate(today.getDate() + diff);
            if (showApproved) {
              if (weekStart.getTime() <= currentMonday.getTime()) {
                const nextMonday = new Date(currentMonday);
                nextMonday.setDate(nextMonday.getDate() + 7);
                setWeekStart(nextMonday);
              }
            } else {
              setWeekStart(currentMonday);
            }
            slideDir.current = showApproved ? 1 : -1;
            setShowApproved(prev => !prev);
          }}
          className={`w-[30%] inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium transition-colors ${
            showApproved
              ? 'bg-muted text-muted-foreground hover:text-foreground'
              : 'bg-emerald-500/15 text-emerald-500'
          }`}
        >
          <LayoutList size={12} />
          Đăng ký
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${weekLabel}-${showApproved}`}
          initial={{ x: slideDir.current * 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -slideDir.current * 50, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="px-4">
            {showApproved ? (
              <div className="border border-border overflow-hidden">
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
                      const dateStr = formatLocalDate(date);
                      const lookupDate = dateStr;
                      const dayIndex = (date.getDay() + 6) % 7;
                      const isWeekend = dayIndex >= 5;
                      const morningSlots = slotNames[`${lookupDate}|morning`] || [];
                      const afternoonSlots = slotNames[`${lookupDate}|afternoon`] || [];
                      const mineMorning = morningSlots.some(info => info.userId === userId);
                      const mineAfternoon = afternoonSlots.some(info => info.userId === userId);

                      return (
                        <tr key={dateStr} className="border-b border-border/30 last:border-0">
                          <td className="bg-muted/30 px-1 py-2 border-r border-border text-center select-none">
                            <div className="flex flex-wrap items-baseline justify-center gap-x-1">
                              <span className={`text-base font-bold leading-none ${isWeekend ? 'text-accent' : 'text-foreground'}`}>{DAY_NAMES[dayIndex]}</span>
                              <span className="text-sm font-semibold text-foreground/50">{format(date, 'dd')}</span>
                            </div>
                          </td>
                          <td className={`px-2 py-2 border-r border-border/30 h-[80px] align-middle ${mineMorning ? MINE_CELL_OUTLINE : ''}`}>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                              {morningSlots.length === 0 ? (
                                <span className="text-[10px] text-muted-foreground/50">—</span>
                              ) : morningSlots.map((info, i) => {
                                const isMe = info.userId === userId;
                                const c = getPersonColor(info.userId);
                                return (
                                  <span
                                    key={i}
                                    className={`text-xs font-bold ${isMe ? '' : OTHERS_NAME_OPACITY}`}
                                    style={{ color: `hsl(${c})` }}
                                  >
                                    {shortName(info.name)}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className={`px-2 py-2 h-[80px] align-middle ${mineAfternoon ? MINE_CELL_OUTLINE : ''}`}>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                              {afternoonSlots.length === 0 ? (
                                <span className="text-[10px] text-muted-foreground/50">—</span>
                              ) : afternoonSlots.map((info, i) => {
                                const isMe = info.userId === userId;
                                const c = getPersonColor(info.userId);
                                return (
                                  <span
                                    key={i}
                                    className={`text-xs font-bold ${isMe ? '' : OTHERS_NAME_OPACITY}`}
                                    style={{ color: `hsl(${c})` }}
                                  >
                                    {shortName(info.name)}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div className="flex gap-4 mb-3 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/20 border border-success/30" /> Đã đăng ký</span>
                  <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/20 border border-warning/30" /> Chờ duyệt</span>
                </div>

                <div className="border border-border overflow-hidden">
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
                        const dateStr = formatLocalDate(date);
                        const lookupDate = dateStr;
                        const dayIndex = (date.getDay() + 6) % 7;
                        const isWeekend = dayIndex >= 5;
                        const moonLabel = getMoonLabel(date);
                        const hasMorning = registered.has(`${lookupDate}|morning`);
                        const hasAfternoon = registered.has(`${lookupDate}|afternoon`);
                        const morningStatus = registrationStatus[`${lookupDate}|morning`] || '';
                        const afternoonStatus = registrationStatus[`${lookupDate}|afternoon`] || '';
                        const morningDetail = pendingDetails[`${lookupDate}|morning`];
                        const afternoonDetail = pendingDetails[`${lookupDate}|afternoon`];
                        const morningCount = slotCounts[`${lookupDate}|morning`] || 0;
                        const afternoonCount = slotCounts[`${lookupDate}|afternoon`] || 0;
                        const morningNames = (slotNames[`${lookupDate}|morning`] || []).map(s => s.name);
                        const afternoonNames = (slotNames[`${lookupDate}|afternoon`] || []).map(s => s.name);

                        return (
                          <tr key={dateStr} className="border-b border-border/30 last:border-0">
                            <td className="bg-muted/30 px-1 py-2 border-r border-border text-center select-none">
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
        </motion.div>
      </AnimatePresence>

      {/* Edit modal */}
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
              <div className="flex items-end justify-between w-full">
                <div className="w-[43%]">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Giờ vào</label>
                  <input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)}
                    className="w-full m-0 block px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none" />
                </div>
                <div className="flex-1 pb-3 text-center text-muted-foreground text-sm">–</div>
                <div className="w-[43%] flex flex-col items-end">
                  <div className="w-full">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Giờ ra</label>
                    <input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)}
                      className="w-full m-0 block px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none" />
                  </div>
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

function ToggleCell({ dateStr, shiftKey, isAdminRegistered, status, detail, count, names, onTap, onEdit }: {
  dateStr: string; shiftKey: string; isAdminRegistered: boolean;
  status: string; detail?: { clockIn: string; clockOut: string; note: string }; count: number; names: string[];
  onTap: () => void; onEdit: () => void;
}) {
  const flashRef = useRef<HTMLButtonElement>(null);
  const [editReady, setEditReady] = useState(true);
  const cooldownRef = useRef<ReturnType<typeof setTimeout>>();

  const handleEditTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!editReady) return;
    setEditReady(false);
    clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => setEditReady(true), 500);
    if (flashRef.current) {
      flashRef.current.classList.add('bg-foreground/10');
      setTimeout(() => flashRef.current?.classList.remove('bg-foreground/10'), 200);
    }
    onEdit();
  };

  useEffect(() => {
    return () => clearTimeout(cooldownRef.current);
  }, []);

  const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    pending:  { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-amber-400/35 to-transparent', text: 'text-amber-500', icon: 'text-amber-400', label: 'Chờ duyệt' },
    approved: { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-emerald-500/30 to-transparent', text: 'text-emerald-600', icon: 'text-emerald-500', label: 'Đã duyệt' },
    rejected: { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-red-500/30 to-transparent', text: 'text-red-600', icon: 'text-red-500', label: 'Từ chối' },
    modified: { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-violet-500/30 to-transparent', text: 'text-violet-600', icon: 'text-violet-500', label: 'Đã sửa' },
    assigned: { bg: 'bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-blue-500/25 to-transparent', text: 'text-blue-600', icon: 'text-blue-500', label: 'Admin xếp' },
  };

  if (isAdminRegistered) {
    return (
      <div className="w-full bg-[length:100%_54px] bg-bottom bg-no-repeat bg-gradient-to-t from-emerald-500/30 to-transparent min-h-[72px] flex flex-col relative">
        <div className="h-1/3 flex items-start justify-end pt-0.5 px-1">
          {count > 1 && (
            <span className="text-[8px] text-emerald-400/60 flex items-center gap-0.5">
              <User size={8} />{count}
            </span>
          )}
          {count <= 1 && <span className="h-4" />}
        </div>
        <div className="h-1/3 flex items-center justify-center gap-1.5">
          <Check size={16} className="text-emerald-500" />
          <span className="text-[11px] font-semibold text-emerald-600">Đã đăng ký</span>
        </div>
        <div className="h-1/3" />
      </div>
    );
  }

  if (status && STATUS_STYLES[status]) {
    const s = STATUS_STYLES[status];
    const defaults = shiftKey === "morning" ? { in: "08:00", out: "15:00" } : { in: "15:00", out: "22:00" };
    const hasCustom = detail?.clockIn && detail?.clockOut &&
      (detail.clockIn !== defaults.in || detail.clockOut !== defaults.out || detail.note);

    return (
      <div className={`w-full ${s.bg} min-h-[72px] flex flex-col relative`}>
        {/* Top half: count + status */}
        <div className="h-1/2 flex flex-col">
          <div className="flex items-start justify-end pt-0.5 px-1">
            {count > 1 && (
              <span className="text-[8px] opacity-40 flex items-center gap-0.5">
                <User size={8} />{count}
              </span>
            )}
            {count <= 1 && <span className="h-4" />}
          </div>
          <button type="button"
            onClick={status === 'pending' ? onTap : (status === 'assigned' ? undefined : () => onEdit())}
            className={`flex-1 flex flex-col items-center gap-0.5 appearance-none outline-none border-0 bg-transparent ${hasCustom || status === 'modified' ? 'justify-start pt-0.5' : 'justify-center'}`}>
            <div className="flex items-center gap-1.5">
              {status === 'pending' ? (
                <>
                  <HelpCircle size={14} className={s.icon} />
                  <span className={`text-[11px] font-semibold ${s.text}`}>{s.label}</span>
                </>
              ) : status === 'approved' ? (
                <>
                  <Check size={14} className={s.icon} />
                  <span className={`text-[11px] font-semibold ${s.text}`}>{s.label}</span>
                </>
              ) : status === 'assigned' ? (
                <User size={14} className={s.text} />
              ) : (
                <span className={`text-[11px] font-semibold ${s.text}`}>{s.label}</span>
              )}
            </div>
            {(hasCustom || status === 'modified') && (
              <span className={`text-[10px] ${s.text}/60`}>
                {detail!.clockIn !== defaults.in && detail!.clockOut !== defaults.out
                  ? `Vào ${detail!.clockIn} – Ra ${detail!.clockOut}`
                  : detail!.clockIn !== defaults.in
                    ? `Vào ${detail!.clockIn}`
                    : detail!.clockOut !== defaults.out
                      ? `Ra ${detail!.clockOut}`
                      : detail!.note || ''}
              </span>
            )}
          </button>
        </div>
        {/* Bottom half: Yêu cầu thêm */}
        <button ref={flashRef} type="button" onClick={handleEditTap}
          className="w-full h-1/2 flex items-start justify-center pt-3 appearance-none outline-none border-0 bg-transparent">
          <span className="text-[10px] text-foreground/60 font-medium">Yêu cầu thêm</span>
        </button>
      </div>
    );
  }

  return (
    <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={onTap}
      className="w-full min-h-[72px] flex flex-col appearance-none outline-none border-0 bg-transparent">
      <div className="h-1/3 flex items-start justify-end pt-0.5 px-1">
        {count > 0 && (
          <span className="text-[8px] opacity-30 flex items-center gap-0.5">
            <User size={8} />{count}
          </span>
        )}
      </div>
      <div className="h-1/3 flex items-center justify-center">
        <span className="text-[32px] leading-none text-muted-foreground/20">+</span>
      </div>
      <div className="h-1/3" />
    </motion.button>
  );
}
