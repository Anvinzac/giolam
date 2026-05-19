import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import AppBootState from '@/components/AppBootState';
import { withTimeout } from '@/lib/withTimeout';
import { buildEmployeeTitle } from '@/lib/employeeGreeting';

interface AssignedIngredient {
  id: string;
  name: string;
  emoji: string;
  unit: string;
  category: string;
}

interface StockReport {
  id: string;
  ingredient_id: string;
  remaining_quantity: number | null;
  warning_message: string | null;
  is_low_stock: boolean;
  reported_at: string;
  resolved_at: string | null;
}

export default function StockAlertForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [ingredients, setIngredients] = useState<AssignedIngredient[]>([]);
  const [reports, setReports] = useState<StockReport[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [lowStock, setLowStock] = useState<Record<string, boolean>>({});
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setBootError(null);
      const { data: { user } } = await withTimeout(
        supabase.auth.getUser(),
        10000,
        'Session check timed out.',
      );
      if (!user) {
        navigate('/login');
        return;
      }
      setUserId(user.id);

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      if (prof) setFullName((prof as any).full_name || '');

      const { data: assigned } = await supabase
        .from('employee_ingredients')
        .select('ingredient_id, ingredients(id, name, emoji, unit, category)')
        .eq('employee_id', user.id);
      if (assigned?.length) {
        const ings = assigned
          .map((a: any) => a.ingredients)
          .filter(Boolean);
        setIngredients(ings);
        const initLowStock: Record<string, boolean> = {};
        ings.forEach((i: any) => { initLowStock[i.id] = false; });
        setLowStock(initLowStock);
      }

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const { data: existingReports } = await supabase
        .from('stock_reports')
        .select('id, ingredient_id, remaining_quantity, warning_message, is_low_stock, reported_at, resolved_at')
        .eq('reported_by', user.id)
        .gte('reported_at', startOfMonth)
        .order('reported_at', { ascending: false });
      if (existingReports?.length) setReports(existingReports as StockReport[]);

      setLoading(false);
    } catch (error) {
      console.error('Failed to load stock alert data:', error);
      setBootError(error instanceof Error ? error.message : 'Unknown error.');
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData, retryKey]);

  const handleSubmit = async (ingredientId: string) => {
    if (!userId) return;
    setSubmitting(ingredientId);
    const remaining = quantities[ingredientId] ? parseFloat(quantities[ingredientId]) : null;
    const { error } = await supabase.from('stock_reports').insert({
      ingredient_id: ingredientId,
      reported_by: userId,
      remaining_quantity: remaining,
      warning_message: warnings[ingredientId] || null,
      is_low_stock: lowStock[ingredientId] || false,
    });
    setSubmitting(null);
    if (!error) {
      setQuantities(prev => ({ ...prev, [ingredientId]: '' }));
      setWarnings(prev => ({ ...prev, [ingredientId]: '' }));
      setLowStock(prev => ({ ...prev, [ingredientId]: false }));
      loadData();
    }
  };

  const getCategoryEmoji = (category: string) => {
    const map: Record<string, string> = {
      vegetables: '🥬', sauces: '🫙', spices: '🧂', grains: '🌾',
      oils: '🫒', proteins: '🥩', dairy: '🧀', gas: '⛽',
      equipment: '🔧', tissue: '🧻',
    };
    return map[category] || '📦';
  };

  const getIngredientReport = (ingredientId: string) => {
    return reports.find(r => r.ingredient_id === ingredientId);
  };

  if (loading || bootError) {
    return <AppBootState error={bootError} onRetry={() => setRetryKey(key => key + 1)} />;
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl bg-muted text-muted-foreground"
          >
            <ArrowLeft size={18} />
          </motion.button>
          <h1 className="font-display text-xl font-bold text-gradient-gold flex-1">
            {fullName ? buildEmployeeTitle(fullName, 'Cảnh báo tồn kho') : 'Cảnh báo tồn kho'}
          </h1>
        </div>
      </header>

      <div className="px-4 space-y-4">
        {ingredients.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">Bạn chưa được phân công nguyên liệu nào.</p>
          </div>
        ) : (
          ingredients.map((ing) => {
            const report = getIngredientReport(ing.id);
            return (
              <motion.div
                key={ing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ing.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-medium">{ing.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {getCategoryEmoji(ing.category)} Đơn vị: {ing.unit}
                    </p>
                  </div>
                </div>

                {report && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/50">
                    {report.resolved_at ? (
                      <CheckCircle2 size={14} className="text-green-500" />
                    ) : report.is_low_stock ? (
                      <AlertTriangle size={14} className="text-destructive" />
                    ) : (
                      <Clock size={14} />
                    )}
                    <span>
                      {report.resolved_at
                        ? 'Đã xử lý'
                        : `Báo cáo: ${report.remaining_quantity ?? '—'} ${ing.unit}`}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder={`Tồn kho (${ing.unit})`}
                      value={quantities[ing.id] || ''}
                      onChange={e => setQuantities(prev => ({ ...prev, [ing.id]: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <label className="flex items-center gap-1 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lowStock[ing.id] || false}
                        onChange={e => setLowStock(prev => ({ ...prev, [ing.id]: e.target.checked }))}
                        className="rounded border-border"
                      />
                      <span className="text-destructive text-xs">Sắp hết</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ghi chú (tùy chọn)"
                    value={warnings[ing.id] || ''}
                    onChange={e => setWarnings(prev => ({ ...prev, [ing.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSubmit(ing.id)}
                    disabled={submitting === ing.id}
                    className="w-full py-2 rounded-lg gradient-gold text-primary-foreground text-sm font-medium disabled:opacity-50"
                  >
                    {submitting === ing.id ? 'Đang gửi...' : 'Báo cáo'}
                  </motion.button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
