import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Package, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface StockReport {
  id: string;
  ingredient_id: string;
  reported_by: string;
  remaining_quantity: number | null;
  warning_message: string | null;
  is_low_stock: boolean;
  reported_at: string;
  resolved_at: string | null;
  profiles: { full_name: string; username: string | null } | null;
  ingredients: { name: string; emoji: string; unit: string; category: string } | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  vegetables: '🥬', sauces: '🫙', spices: '🧂', grains: '🌾',
  oils: '🫒', proteins: '🥩', dairy: '🧀', gas: '⛽',
  equipment: '🔧', tissue: '🧻',
};

export default function AdminStockReports() {
  const [reports, setReports] = useState<StockReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved' | 'low_stock'>('pending');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stock_reports')
      .select(`
        id, ingredient_id, reported_by, remaining_quantity, warning_message,
        is_low_stock, reported_at, resolved_at,
        profiles!stock_reports_reported_by_fkey(full_name, username),
        ingredients(name, emoji, unit, category)
      `)
      .order('reported_at', { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setReports((data as unknown as StockReport[]) || []);
    }
    setLoading(false);
  };

  const resolveReport = async (id: string) => {
    const { error } = await supabase
      .from('stock_reports')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Đã đánh dấu đã xử lý');
      loadReports();
    }
  };

  const filteredReports = useMemo(() => {
    switch (filter) {
      case 'pending': return reports.filter(r => !r.resolved_at);
      case 'resolved': return reports.filter(r => r.resolved_at);
      case 'low_stock': return reports.filter(r => r.is_low_stock && !r.resolved_at);
      default: return reports;
    }
  }, [reports, filter]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="glass-card p-8 text-center text-muted-foreground">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'pending', label: 'Chờ xử lý' },
          { key: 'low_stock', label: 'Sắp hết' },
          { key: 'resolved', label: 'Đã xử lý' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              filter === f.key ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredReports.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">Không có báo cáo nào</div>
      ) : (
        <div className="space-y-2">
          {filteredReports.map(report => {
            const ing = report.ingredients;
            const prof = report.profiles;
            return (
              <div key={report.id} className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ing?.emoji || '📦'}</span>
                    <div>
                      <h4 className="font-medium">{ing?.name || report.ingredient_id}</h4>
                      <p className="text-xs text-muted-foreground">
                        Báo cáo bởi: {prof?.full_name || 'Unknown'}
                        {prof?.username && <span className="ml-1">({prof.username})</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.resolved_at ? (
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <CheckCircle2 size={14} /> Đã xử lý
                      </span>
                    ) : report.is_low_stock ? (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle size={14} /> Sắp hết
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={14} /> {formatDate(report.reported_at)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tồn kho:</span>
                    <span className="ml-2 font-medium">
                      {report.remaining_quantity != null ? `${report.remaining_quantity} ${ing?.unit || ''}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Danh mục:</span>
                    <span className="ml-2">{CATEGORY_EMOJI[ing?.category || ''] || '📦'} {ing?.category || '—'}</span>
                  </div>
                </div>

                {report.warning_message && (
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 text-xs">
                    {report.warning_message}
                  </div>
                )}

                {!report.resolved_at && (
                  <button
                    onClick={() => resolveReport(report.id)}
                    className="w-full py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={14} />
                    Đánh dấu đã xử lý
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
