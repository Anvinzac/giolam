import { useState, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { formatDateViet } from '@/lib/salaryCalculations';

interface SwipeablePagesProps {
  pages: React.ReactNode[];
  labels?: React.ReactNode[];
  currentPage: number;
  onPageChange: (page: number) => void;
}

/**
 * Pill label for a salary page's date range.
 * Default is a single-line "dd/mm - dd/mm". Stack start over end only
 * when there are 4+ pages (extra out-of-range days) — those pills are
 * too narrow on mobile for the full range. Desktop still fits one line.
 */
export function dateRangePageLabel(startDate: string, endDate: string, pageCount: number): React.ReactNode {
  const start = formatDateViet(startDate);
  const end = formatDateViet(endDate);
  const range = `${start} - ${end}`;
  if (pageCount < 4) {
    return <span className="whitespace-nowrap">{range}</span>;
  }
  return (
    <>
      <span className="hidden whitespace-nowrap sm:inline">{range}</span>
      <span className="flex flex-col items-center leading-tight sm:hidden">
        <span className="text-[9px] font-medium opacity-60">{start}</span>
        <span className="text-[11px] font-semibold">{end}</span>
      </span>
    </>
  );
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

  const handlePageChange = (idx: number) => {
    const scrollY = window.scrollY;
    setDirection(idx > currentPage ? 1 : -1);
    onPageChange(idx);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
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
              type="button"
              onClick={() => handlePageChange(idx)}
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
