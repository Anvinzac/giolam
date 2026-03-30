import { useState, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface SwipeablePagesProps {
  pages: React.ReactNode[];
  labels?: string[];
  currentPage: number;
  onPageChange: (page: number) => void;
}

export default function SwipeablePages({ pages, labels, currentPage, onPageChange }: SwipeablePagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(0);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold && currentPage < pages.length - 1) {
      setDirection(1);
      onPageChange(currentPage + 1);
    } else if (info.offset.x > threshold && currentPage > 0) {
      setDirection(-1);
      onPageChange(currentPage - 1);
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="overflow-hidden relative">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentPage}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            {pages[currentPage]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Page bar — bottom, wrap around text */}
      {pages.length > 1 && (
        <div className="flex justify-center gap-2 px-1">
          {pages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setDirection(idx > currentPage ? 1 : -1);
                onPageChange(idx);
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                idx === currentPage
                  ? 'gradient-gold text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {labels?.[idx] ?? `Trang ${idx + 1}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
