import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, PenLine } from "lucide-react";

interface Registration {
  id: string;
  shift_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  admin_clock_in: string | null;
  admin_clock_out: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
}

interface RegistrationResultProps {
  userId: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; color: string; bg: string }> = {
  pending: { icon: Clock, label: 'Chờ duyệt', color: 'text-warning', bg: 'bg-warning/10' },
  approved: { icon: CheckCircle2, label: 'Đã duyệt', color: 'text-success', bg: 'bg-success/10' },
  rejected: { icon: XCircle, label: 'Từ chối', color: 'text-destructive', bg: 'bg-destructive/10' },
  modified: { icon: PenLine, label: 'Đã sửa', color: 'text-accent', bg: 'bg-accent/10' },
};

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export default function RegistrationResult({ userId }: RegistrationResultProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('shift_registrations')
        .select('*')
        .eq('user_id', userId)
        .order('shift_date', { ascending: true });
      setRegistrations((data as Registration[]) || []);
      setLoading(false);
    };
    fetch();

    // Subscribe to changes
    const channel = supabase
      .channel('reg-results')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shift_registrations',
        filter: `user_id=eq.${userId}`,
      }, () => {
        fetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const reviewed = registrations.filter(r => r.status !== 'pending');
  const pending = registrations.filter(r => r.status === 'pending');

  if (loading || registrations.length === 0) return null;

  return (
    <div className="w-full">
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/60 border border-border"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-display font-semibold text-foreground">Kết quả đăng ký</span>
          {reviewed.length > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-1">
              {reviewed.length}
            </span>
          )}
          {pending.length > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-warning/20 text-warning text-[10px] font-bold px-1">
              {pending.length} chờ
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 pt-2">
              {registrations.map((reg) => {
                const d = new Date(reg.shift_date + 'T00:00:00');
                const dayName = DAY_NAMES[d.getDay()];
                const dateNum = d.getDate();
                const month = d.getMonth() + 1;
                const cfg = STATUS_CONFIG[reg.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;

                return (
                  <div key={reg.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${cfg.bg} border border-border/50`}>
                    <div className="w-10 text-center">
                      <div className="text-xs font-semibold text-foreground">{dayName}</div>
                      <div className="text-[10px] text-muted-foreground">{dateNum}/{month}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {reg.clock_in?.slice(0, 5)} – {reg.clock_out?.slice(0, 5)}
                      </div>
                      {reg.status === 'modified' && reg.admin_clock_in && (
                        <div className="text-xs font-medium text-accent">
                          → {reg.admin_clock_in.slice(0, 5)} – {reg.admin_clock_out?.slice(0, 5)}
                        </div>
                      )}
                      {reg.admin_note && (
                        <div className="text-[10px] text-muted-foreground truncate">{reg.admin_note}</div>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 ${cfg.color}`}>
                      <Icon size={14} />
                      <span className="text-[10px] font-medium">{cfg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
