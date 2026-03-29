import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SalaryRecord, SalaryBreakdown } from '@/types/salary';
import { formatVND } from './TotalSalaryDisplay';
import SalaryBreakdownPopup from './SalaryBreakdownPopup';

interface EmployeeSalaryViewProps {
  userId: string;
}

interface RecordWithPeriod extends SalaryRecord {
  period_start?: string;
  period_end?: string;
}

export default function EmployeeSalaryView({ userId }: EmployeeSalaryViewProps) {
  const [records, setRecords] = useState<RecordWithPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<RecordWithPeriod | null>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      // Fetch published salary records with period info
      const { data: salaryRecords } = await (supabase
        .from('salary_records' as any) as any)
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (!salaryRecords || salaryRecords.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch period dates for each record
      const periodIds = [...new Set(salaryRecords.map((r: any) => r.period_id))] as string[];
      const { data: periods } = await supabase
        .from('working_periods')
        .select('id, start_date, end_date')
        .in('id', periodIds);

      const periodMap = new Map(periods?.map(p => [p.id, p]) || []);

      const enriched: RecordWithPeriod[] = salaryRecords.map(r => ({
        ...(r as unknown as SalaryRecord),
        period_start: periodMap.get(r.period_id)?.start_date,
        period_end: periodMap.get(r.period_id)?.end_date,
      }));

      setRecords(enriched);
      setLoading(false);
    };

    fetchRecords();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="glass-card p-8 text-center space-y-2">
        <Calendar className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground text-sm">Chưa có bảng lương nào</p>
        <p className="text-muted-foreground text-xs">Bảng lương sẽ hiển thị sau khi quản lý công bố.</p>
      </div>
    );
  }

  const formatPeriodLabel = (r: RecordWithPeriod) => {
    if (!r.period_start || !r.period_end) return 'Kỳ lương';
    const start = new Date(r.period_start);
    const end = new Date(r.period_end);
    return `${start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  // Determine if a record is current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      {records.map((r, idx) => {
        const isCurrent = r.period_start?.startsWith(currentMonth);
        return (
          <motion.button
            key={r.id || idx}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRecord(r)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`w-full glass-card p-4 text-left ${
              isCurrent ? 'ring-1 ring-primary/40' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{formatPeriodLabel(r)}</p>
                <p className="font-display font-bold text-lg text-foreground mt-0.5">
                  {formatVND(r.total_salary)}
                </p>
                {r.published_at && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Công bố: {new Date(r.published_at).toLocaleDateString('vi-VN')}
                  </p>
                )}
              </div>
              <ChevronDown size={16} className="text-muted-foreground" />
            </div>
          </motion.button>
        );
      })}

      <SalaryBreakdownPopup
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        breakdown={selectedRecord?.salary_breakdown as SalaryBreakdown | null}
      />
    </div>
  );
}
