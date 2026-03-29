import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, DollarSign } from 'lucide-react';
import EmployeeSalaryView from '@/components/salary/EmployeeSalaryView';

export default function SalaryEmployee() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);
      setLoading(false);
    };
    init();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-muted text-muted-foreground"
          >
            <ArrowLeft size={18} />
          </motion.button>
          <h1 className="font-display text-xl font-bold text-gradient-gold flex items-center gap-2">
            <DollarSign size={20} />
            Bảng lương
          </h1>
        </div>
      </header>

      <div className="px-4">
        {userId && <EmployeeSalaryView userId={userId} />}
      </div>
    </div>
  );
}
