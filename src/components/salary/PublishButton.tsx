import { motion } from 'framer-motion';
import { Send, RefreshCw } from 'lucide-react';

interface PublishButtonProps {
  isPublished: boolean;
  isSaving: boolean;
  onPublish: () => void;
}

export default function PublishButton({ isPublished, isSaving, onPublish }: PublishButtonProps) {
  if (isPublished) {
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onPublish}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors font-display font-semibold text-sm disabled:opacity-50"
      >
        <RefreshCw size={16} />
        {isSaving ? 'Đang lưu...' : 'Công bố lại'}
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onPublish}
      disabled={isSaving}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-gold text-primary-foreground font-display font-semibold disabled:opacity-50"
    >
      <Send size={16} />
      {isSaving ? 'Đang lưu...' : 'Công bố lương'}
    </motion.button>
  );
}
