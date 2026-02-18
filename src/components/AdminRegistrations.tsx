import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, PenLine, Clock } from "lucide-react";
import { toast } from "sonner";

interface Registration {
  id: string;
  user_id: string;
  shift_date: string;
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

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export default function AdminRegistrations({ onBadgeCount }: Props) {
  const [registrations, setRegistrations] = useState<(Registration & { full_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNote, setEditNote] = useState("");

  const fetchData = async () => {
    const { data: regs } = await supabase
      .from('shift_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

    const mapped = ((regs as Registration[]) || []).map(r => ({
      ...r,
      full_name: profileMap.get(r.user_id) || 'Unknown',
    }));

    setRegistrations(mapped);
    onBadgeCount?.(mapped.filter(r => r.status === 'pending').length);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('shift_registrations').update({
      status,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    } as any).eq('id', id);
    toast.success(status === 'approved' ? 'Đã duyệt' : 'Đã từ chối');
    fetchData();
  };

  const handleModify = async (id: string) => {
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
    setEditingId(null);
    fetchData();
  };

  const startEdit = (reg: Registration & { full_name: string }) => {
    setEditingId(reg.id);
    setEditClockIn(reg.clock_in?.slice(0, 5) || '');
    setEditClockOut(reg.clock_out?.slice(0, 5) || '');
    setEditNote(reg.admin_note || '');
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" /></div>;
  }

  const pending = registrations.filter(r => r.status === 'pending');
  const reviewed = registrations.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-4">
      {/* Pending */}
      <div>
        <h3 className="text-sm font-display font-semibold text-foreground mb-2 flex items-center gap-2">
          <Clock size={14} className="text-warning" />
          Chờ duyệt ({pending.length})
        </h3>
        {pending.length === 0 && (
          <div className="glass-card p-4 text-center text-xs text-muted-foreground">Không có đăng ký mới</div>
        )}
        {pending.map(reg => {
          const d = new Date(reg.shift_date + 'T00:00:00');
          const isEditing = editingId === reg.id;

          return (
            <div key={reg.id} className="glass-card p-3 mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{reg.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {DAY_NAMES[d.getDay()]} {d.getDate()}/{d.getMonth() + 1} · {reg.clock_in?.slice(0, 5)} – {reg.clock_out?.slice(0, 5)}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAction(reg.id, 'approved')} className="p-2 rounded-xl bg-success/10 text-success">
                    <CheckCircle2 size={16} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => startEdit(reg)} className="p-2 rounded-xl bg-accent/10 text-accent">
                    <PenLine size={16} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAction(reg.id, 'rejected')} className="p-2 rounded-xl bg-destructive/10 text-destructive">
                    <XCircle size={16} />
                  </motion.button>
                </div>
              </div>

              {isEditing && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-2 pt-1 border-t border-border">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Giờ vào</label>
                      <input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-muted border border-border text-sm text-foreground" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Giờ ra</label>
                      <input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-muted border border-border text-sm text-foreground" />
                    </div>
                  </div>
                  <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Ghi chú..."
                    className="w-full px-2 py-1.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleModify(reg.id)}
                      className="flex-1 py-1.5 rounded-lg gradient-gold text-primary-foreground text-xs font-semibold">
                      Lưu & Duyệt
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs">
                      Hủy
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground mb-2">Đã xử lý ({reviewed.length})</h3>
          {reviewed.map(reg => {
            const d = new Date(reg.shift_date + 'T00:00:00');
            const statusMap: Record<string, { label: string; color: string }> = {
              approved: { label: 'Duyệt', color: 'text-success' },
              rejected: { label: 'Từ chối', color: 'text-destructive' },
              modified: { label: 'Đã sửa', color: 'text-accent' },
            };
            const st = statusMap[reg.status] || statusMap.approved;

            return (
              <div key={reg.id} className="glass-card p-3 mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{reg.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {DAY_NAMES[d.getDay()]} {d.getDate()}/{d.getMonth() + 1} · {reg.clock_in?.slice(0, 5)} – {reg.clock_out?.slice(0, 5)}
                    {reg.status === 'modified' && reg.admin_clock_in && (
                      <span className="text-accent"> → {reg.admin_clock_in.slice(0, 5)} – {reg.admin_clock_out?.slice(0, 5)}</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-semibold ${st.color}`}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
