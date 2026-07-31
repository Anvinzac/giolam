import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Check, Pen, X, Undo, Clock, Calendar, ChevronLeft, ChevronRight, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { getWeekDates } from "@/lib/lunarUtils";
import { format } from "date-fns";

interface Registration {
  id: string;
  user_id: string;
  shift_date: string;
  shift_slot: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  admin_clock_in: string | null;
  admin_clock_out: string | null;
  admin_note: string | null;
  created_at: string;
}

interface Props {
  onBadgeCount?: (count: number) => void;
}

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  pending:  { bg: 'from-amber-400/25 via-amber-400/10 via-60% to-transparent', border: 'border-amber-400/25', text: 'text-amber-500', icon: 'text-amber-400', label: 'Chờ' },
  approved: { bg: 'from-emerald-500/15 via-emerald-500/10 via-60% to-transparent', border: 'border-emerald-500/20', text: 'text-emerald-600', icon: 'text-emerald-500', label: 'Duyệt' },
  rejected: { bg: 'from-red-500/15 via-red-500/10 via-60% to-transparent', border: 'border-red-500/20', text: 'text-red-600', icon: 'text-red-500', label: 'Từ chối' },
  modified: { bg: 'from-violet-500/15 via-violet-500/10 via-60% to-transparent', border: 'border-violet-500/20', text: 'text-violet-600', icon: 'text-violet-500', label: 'Sửa' },
  assigned: { bg: 'from-blue-500/15 via-blue-500/10 via-60% to-transparent', border: 'border-blue-500/20', text: 'text-blue-600', icon: 'text-blue-500', label: 'Xếp' },
};

export default function AdminRegistrations({ onBadgeCount }: Props) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNote, setEditNote] = useState("");

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

  const fetchData = async () => {
    const { data: pro } = await supabase.from('profiles').select('user_id, full_name');
    const profileMap = new Map((pro || []).map(p => [p.user_id, p.full_name]));
    setProfiles(profileMap);

    const testUsernames = new Set(['N. Viên C', 'N. Viên D']);
    const testIds = [...profileMap.entries()]
      .filter(([_, name]) => testUsernames.has(name))
      .map(([id]) => id);

    const { data: allRegs } = await supabase.from('shift_registrations').select('*').order('created_at', { ascending: false });

    const regs = ((allRegs as Registration[]) || []).filter(r =>
      testIds.includes(r.user_id) || r.status === 'assigned'
    );

    setRegistrations(regs);
    onBadgeCount?.(regs.filter(r => r.status === 'pending').length);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    // Optimistic: update UI immediately
    setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    onBadgeCount?.(registrations.filter(r => r.status === 'pending' && r.id !== id).length);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('shift_registrations').update({
      status,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    } as any).eq('id', id);
    toast.success(status === 'approved' ? 'Đã duyệt' : 'Đã từ chối');
  };

  const handleModify = async (id: string) => {
    // Optimistic: update UI immediately
    setRegistrations(prev => prev.map(r => r.id === id ? {
      ...r, status: 'modified', admin_clock_in: editClockIn || null,
      admin_clock_out: editClockOut || null, admin_note: editNote || null,
    } : r));
    setEditingId(null);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('shift_registrations').update({
      status: 'modified',
      admin_clock_in: editClockIn || null,
      admin_clock_out: editClockOut || null,
      admin_note: editNote || null,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    } as any).eq('id', id);
    toast.success('Đã sửa và duyệt');
  };

  const startEdit = (reg: Registration) => {
    setEditingId(reg.id);
    setEditClockIn(reg.clock_in?.slice(0, 5) || '');
    setEditClockOut(reg.clock_out?.slice(0, 5) || '');
    setEditNote(reg.admin_note || '');
  };

  const handleRevert = async (id: string, wasAssigned?: boolean) => {
    // Optimistic: revert UI immediately
    setRegistrations(prev => prev.map(r => r.id === id ? {
      ...r, status: 'pending', reviewed_by: null, reviewed_at: null,
      admin_clock_in: null, admin_clock_out: null, admin_note: null,
    } : r));

    await supabase.from('shift_registrations').update({
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      admin_clock_in: null,
      admin_clock_out: null,
      admin_note: null,
    } as any).eq('id', id);

    if (wasAssigned) {
      // Remove from shifts table too since it was admin-assigned
      const reg = registrations.find(r => r.id === id);
      if (reg) {
        await supabase.from('shifts')
          .delete()
          .eq('user_id', reg.user_id)
          .eq('shift_date', reg.shift_date)
          .eq('shift_slot', reg.shift_slot);
      }
    }

    toast.success('Đã hoàn tác');
  };

  // Group registrations by date + shift_slot
  const cellMap = useMemo(() => {
    const map: Record<string, Registration[]> = {};
    for (const r of registrations) {
      const key = `${r.shift_date}|${r.shift_slot}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [registrations]);

  const pendingCount = registrations.filter(r => r.status === 'pending').length;

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" /></div>;

  return (
    <div className="space-y-3">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground">
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-display font-semibold text-sm flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          {weekLabel}
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-500 text-[10px] font-bold">{pendingCount}</span>
          )}
        </h2>
        <button onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="table-fixed w-full text-xs border-collapse">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[41%]" />
            <col className="w-[41%]" />
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
              const dateStr = date.toISOString().split('T')[0];
              const dayIndex = (date.getDay() + 6) % 7;
              const isWeekend = dayIndex >= 5;
              const morningRegs = cellMap[`${dateStr}|morning`] || [];
              const afternoonRegs = cellMap[`${dateStr}|afternoon`] || [];

              return (
                <tr key={dateStr} className="border-b border-border/30 last:border-0">
                  <td className="bg-muted/30 px-1 py-2 border-r border-border text-center">
                    <div className="flex flex-wrap items-baseline justify-center gap-x-1">
                      <span className={`text-base font-bold leading-none ${isWeekend ? 'text-accent' : 'text-foreground'}`}>
                        {DAY_NAMES[dayIndex]}
                      </span>
                      <span className="text-sm font-semibold text-foreground/50">{format(date, 'dd')}</span>
                    </div>
                  </td>
                  <td className="p-0.5 border-r border-border/30">
                    <RegCell regs={morningRegs} profiles={profiles} editingId={editingId}
                      editClockIn={editClockIn} editClockOut={editClockOut} editNote={editNote}
                      onAction={handleAction} onStartEdit={startEdit}
                      onModify={handleModify} onRevert={handleRevert} setEditingId={setEditingId}
                      setEditClockIn={setEditClockIn} setEditClockOut={setEditClockOut} setEditNote={setEditNote} />
                  </td>
                  <td className="p-0.5">
                    <RegCell regs={afternoonRegs} profiles={profiles} editingId={editingId}
                      editClockIn={editClockIn} editClockOut={editClockOut} editNote={editNote}
                      onAction={handleAction} onStartEdit={startEdit}
                      onModify={handleModify} onRevert={handleRevert} setEditingId={setEditingId}
                      setEditClockIn={setEditClockIn} setEditClockOut={setEditClockOut} setEditNote={setEditNote} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegCell({ regs, profiles, editingId, editClockIn, editClockOut, editNote,
  onAction, onStartEdit, onModify, onRevert, setEditingId, setEditClockIn, setEditClockOut, setEditNote }: any) {

  const pendingRegs = regs.filter((r: Registration) => r.status === 'pending');
  const doneRegs = regs.filter((r: Registration) => r.status !== 'pending');

  return (
    <div className="space-y-1 p-1">
      {/* Done registrations (approved/rejected/modified) */}
      {doneRegs.map((reg: Registration) => {
        const s = STATUS_STYLES[reg.status] || STATUS_STYLES.approved;
        const deviated = reg.admin_clock_in && reg.admin_clock_in !== reg.clock_in?.slice(0, 5);
        return (
          <div key={reg.id} className={`rounded-sm bg-gradient-to-t ${s.bg} border ${s.border} p-1.5`}>
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold text-foreground truncate">{profiles.get(reg.user_id) || '?'}</div>
              <span className={`text-[9px] font-semibold shrink-0 ml-1 ${s.text}`}>
                {reg.status === 'assigned' ? <UserCheck size={12} /> : s.label}
              </span>
            </div>
            <div className="text-[8px] text-muted-foreground">
              {reg.clock_in?.slice(0, 5)}–{reg.clock_out?.slice(0, 5)}
              {deviated && <span className="text-accent ml-1">→ {reg.admin_clock_in?.slice(0, 5)}–{reg.admin_clock_out?.slice(0, 5)}</span>}
            </div>
            {reg.admin_note && <div className="text-[8px] text-muted-foreground/70 italic">{reg.admin_note}</div>}
            <div className="flex items-center mt-1.5 pt-1 border-t border-foreground/10">
              <span className="text-[7px] text-muted-foreground/40 w-1/2">
                {reg.clock_in?.slice(0, 5)}–{reg.clock_out?.slice(0, 5)}
              </span>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => onRevert(reg.id, reg.status === 'assigned')}
                className="w-1/2 py-1 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-foreground/5">
                <Undo size={13} />
              </motion.button>
            </div>
          </div>
        );
      })}

      {/* Pending registrations */}
      {pendingRegs.map((reg: Registration) => {
        const isEditing = editingId === reg.id;
        return (
          <div key={reg.id} className="rounded-sm bg-gradient-to-t from-amber-400/25 via-amber-400/10 via-60% to-transparent border border-amber-400/25 p-1.5">
            {!isEditing ? (
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-semibold text-foreground truncate">{profiles.get(reg.user_id) || '?'}</div>
                  <span className="text-[8px] text-amber-400/90 italic shrink-0 ml-1">{STATUS_STYLES.pending.label}</span>
                </div>
                <div className="text-[8px] text-muted-foreground">
                  {reg.clock_in?.slice(0, 5)}–{reg.clock_out?.slice(0, 5)}
                  {reg.admin_note && <span className="text-amber-400/70 ml-1 italic">{reg.admin_note}</span>}
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1.5 pt-1 border-t border-amber-400/20">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => onAction(reg.id, 'approved')}
                    className="py-1 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10">
                    <Check size={14} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => onStartEdit(reg)}
                    className="py-1 rounded flex items-center justify-center text-violet-600 hover:bg-violet-500/10">
                    <Pen size={12} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => onAction(reg.id, 'rejected')}
                    className="py-1 rounded flex items-center justify-center text-red-600 hover:bg-red-500/10">
                    <X size={14} />
                  </motion.button>
                </div>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                <input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)}
                  className="w-full px-1.5 py-1 rounded bg-muted border border-border text-[10px] text-foreground" />
                <input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)}
                  className="w-full px-1.5 py-1 rounded bg-muted border border-border text-[10px] text-foreground" />
                <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Ghi chú"
                  className="w-full px-1.5 py-1 rounded bg-muted border border-border text-[10px] text-foreground" />
                <div className="flex gap-1">
                  <button onClick={() => onModify(reg.id)}
                    className="flex-1 py-1 rounded gradient-gold text-primary-foreground text-[9px] font-semibold">Lưu & Duyệt</button>
                  <button onClick={() => setEditingId(null)}
                    className="px-2 py-1 rounded bg-muted text-muted-foreground text-[9px]">Hủy</button>
                </div>
              </motion.div>
            )}
          </div>
        );
      })}

      {regs.length === 0 && (
        <div className="text-[10px] text-muted-foreground/30 text-center py-2">—</div>
      )}
    </div>
  );
}
