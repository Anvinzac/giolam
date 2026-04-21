import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (updateError) {
        toast.error(updateError.message);
        setLoading(false);
        return;
      }

      // Mark password as changed (in case must_change_password was true)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ must_change_password: false } as any)
          .eq('user_id', user.id);
      }

      toast.success('Đổi mật khẩu thành công');
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Navigate back after a short delay
      setTimeout(() => {
        navigate(-1);
      }, 1000);
    } catch (err) {
      console.error('Password change error:', err);
      toast.error('Có lỗi xảy ra khi đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
          </motion.button>
          <h1 className="font-display text-xl font-bold text-gradient-gold">
            Cài đặt
          </h1>
        </div>
      </header>

      <div className="px-6 max-w-md mx-auto">
        <div className="glass-card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Đổi mật khẩu</h2>
            <p className="text-sm text-muted-foreground">
              Nhập mật khẩu mới để thay đổi
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current Password - Optional, kept for UX but not validated */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Mật khẩu hiện tại (tùy chọn)
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-muted/50 border border-border/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Mật khẩu mới *
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-muted/50 border border-border/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Xác nhận mật khẩu mới *
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-muted/50 border border-border/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </motion.button>
          </form>

          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center">
              Mật khẩu mới phải có ít nhất 6 ký tự
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
