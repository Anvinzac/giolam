import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Pen, Undo, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { getWeekDates } from "@/lib/lunarUtils";
import { formatLocalDate } from "@/lib/utils";
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

const PERSON_COLORS = [
  "175 70% 45%", "280 60% 55%", "42 90% 55%", "195 85% 50%",
  "340 70% 55%", "155 70% 45%", "25 85% 55%", "210 70% 55%",
  "60 75% 50%", "0 65% 55%", "320 70% 50%", "120 65% 45%",
];
const personColorMap = new Map<string, string>();
function getPersonColor(userId: string): string {
  if (!personColorMap.has(userId)) {
    personColorMap.set(userId, PERSON_COLORS[personColorMap.size % PERSON_COLORS.length]);
  }
  return personColorMap.get(userId)!;
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
  const [originalRegistrations, setOriginalRegistrations] = useState<Registration[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

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

    const { data: allRegs } = await supabase.from('shift_registrations').select('*').order('created_at', { ascending: false });

    setRegistrations((allRegs as Registration[]) || []);
    setOriginalRegistrations((allRegs as Registration[]) || []);
    onBadgeCount?.(((allRegs as Registration[]) || []).filter(r => r.status === 'pending').length);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    onBadgeCount?.(registrations.filter(r => r.status === 'pending' && r.id !== id).length);
  };

  const handleModify = async (id: string) => {
    setRegistrations(prev => prev.map(r => r.id === id ? {
      ...r, status: 'modified', admin_clock_in: editClockIn || null,
      admin_clock_out: editClockOut || null, admin_note: editNote || null,
    } : r));
    setEditingId(null);
  };

  const startEdit = (reg: Registration) => {
    setEditingId(reg.id);
    setEditClockIn(reg.clock_in?.slice(0, 5) || '');
    setEditClockOut(reg.clock_out?.slice(0, 5) || '');
    setEditNote(reg.admin_note || '');
  };

  const handleRevert = async (id: string, wasAssigned?: boolean) => {
    setRegistrations(prev => prev.map(r => r.id === id ? {
      ...r, status: 'pending', reviewed_by: null, reviewed_at: null,
      admin_clock_in: null, admin_clock_out: null, admin_note: null,
    } : r));
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const updates = [];
    for (const reg of registrations) {
      const orig = originalRegistrations.find(r => r.id === reg.id);
      if (!orig) continue;
      
      let finalStatus = reg.status;
      if (finalStatus === 'pending') {
         finalStatus = 'rejected';
      }

      if (orig.status !== finalStatus || reg.status !== orig.status) {
        updates.push({
          id: reg.id,
          status: finalStatus,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_clock_in: reg.admin_clock_in,
          admin_clock_out: reg.admin_clock_out,
          admin_note: reg.admin_note,
        });
      }
    }

    if (updates.length > 0) {
      const { error } = await supabase.from('shift_registrations').upsert(updates);
      if (error) {
        toast.error('Có lỗi khi lưu');
        setIsPublishing(false);
        return;
      }
    }
    
    // Process assigned reversions
    for (const reg of registrations) {
       const orig = originalRegistrations.find(r => r.id === reg.id);
       let finalStatus = reg.status === 'pending' ? 'rejected' : reg.status;
       if (orig && orig.status === 'assigned' && finalStatus !== 'assigned') {
         await supabase.from('shifts')
           .delete()
           .eq('user_id', reg.user_id)
           .eq('shift_date', reg.shift_date)
           .eq('shift_slot', reg.shift_slot);
       }
    }
    
    toast.success('Đã xuất bản lịch mới!');
    await fetchData();
    setIsPublishing(false);
  };

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

      <div className="rounded-xl border border-border overflow-x-auto max-w-full">
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
              const dateStr = formatLocalDate(date);
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
                    <RegCell regs={morningRegs} shiftKey="morning" profiles={profiles} editingId={editingId}
                      editClockIn={editClockIn} editClockOut={editClockOut} editNote={editNote}
                      onAction={handleAction} onStartEdit={startEdit}
                      onModify={handleModify} onRevert={handleRevert} setEditingId={setEditingId}
                      setEditClockIn={setEditClockIn} setEditClockOut={setEditClockOut} setEditNote={setEditNote} />
                  </td>
                  <td className="p-0.5">
                    <RegCell regs={afternoonRegs} shiftKey="afternoon" profiles={profiles} editingId={editingId}
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
      
      {registrations.length > 0 && (
        <div className="pt-4 pb-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handlePublish}
            disabled={isPublishing}
            className="w-full py-3 rounded-xl gradient-gold text-primary-foreground font-display font-semibold text-sm shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isPublishing ? (
               <><div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> Đang xuất bản...</>
            ) : (
               <>Xuất bản lịch tuần {weekLabel}</>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}

const SHIFT_DEFAULTS: Record<string, { clock_in: string; clock_out: string }> = {
  morning: { clock_in: '08:00', clock_out: '15:00' },
  afternoon: { clock_in: '15:00', clock_out: '22:00' },
};

function RegCell({ regs, shiftKey, profiles, editingId, editClockIn, editClockOut, editNote,
  onAction, onStartEdit, onModify, onRevert, setEditingId, setEditClockIn, setEditClockOut, setEditNote }: any) {

  return (
    <div className="flex flex-wrap gap-1 p-1 max-h-[140px] overflow-y-auto overflow-x-hidden">
      {regs.map((reg: Registration) => {
        const color = getPersonColor(reg.user_id);
        const name = profiles.get(reg.user_id)?.split(' ').pop() || '?';
        const isDefault = reg.clock_in?.slice(0, 5) === SHIFT_DEFAULTS[shiftKey]?.clock_in && reg.clock_out?.slice(0, 5) === SHIFT_DEFAULTS[shiftKey]?.clock_out;
        const isPending = reg.status === 'pending';
        
        return (
          <motion.button 
            key={reg.id} 
            whileTap={{ scale: 0.95 }}
            onClick={() => isPending ? onAction(reg.id, 'approved') : onRevert(reg.id, reg.status === 'assigned')}
            className={`flex items-center justify-between gap-1 px-3 py-1.5 rounded-md text-white text-xs font-semibold shadow-sm flex-1 min-w-[45%] ${isPending ? 'opacity-60 hover:opacity-80 transition-opacity' : ''}`}
            style={{ backgroundColor: `hsl(${color})` }}
            title={`${isPending ? 'Pending - ' : ''}${profiles.get(reg.user_id)}: ${reg.clock_in?.slice(0, 5)}–${reg.clock_out?.slice(0, 5)}`}
          >
            <span className="truncate max-w-[50px]">{name}</span>
            {!isDefault && <span className="opacity-90 font-medium text-[10px] bg-black/20 px-1 py-0.5 rounded">{reg.clock_in?.slice(0, 5)}</span>}
            {reg.status === 'assigned' && <UserCheck size={12} className="shrink-0 opacity-80" />}
          </motion.button>
        );
      })}

      {regs.length === 0 && (
        <div className="text-[10px] text-muted-foreground/30 text-center py-2 w-full">—</div>
      )}
    </div>
  );
}
