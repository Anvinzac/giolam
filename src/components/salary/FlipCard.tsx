import { AnimatePresence, motion } from 'framer-motion';

interface FlipCardProps {
  /** When true, the back face (settings) is shown. */
  flipped: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
}

/**
 * Two-sided "page flip" container. The active face stays in normal flow
 * (so each side defines its own height) while the inactive face swings
 * away around the vertical axis — like flipping a page over.
 */
export default function FlipCard({ flipped, front, back }: FlipCardProps) {
  return (
    <div style={{ perspective: 1600 }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={flipped ? 'settings' : 'salary'}
          initial={{ rotateY: flipped ? 90 : -90, opacity: 0, scale: 0.96 }}
          animate={{ rotateY: 0, opacity: 1, scale: 1 }}
          exit={{ rotateY: flipped ? -90 : 90, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          style={{ transformStyle: 'preserve-3d', transformOrigin: 'center center' }}
        >
          {flipped ? back : front}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}