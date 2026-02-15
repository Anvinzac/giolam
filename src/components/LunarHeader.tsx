import { getLunarPhase } from "@/lib/lunarUtils";
import { Moon, Sun } from "lucide-react";

interface LunarHeaderProps {
  userName: string;
  periodLabel?: string;
}

export default function LunarHeader({ userName, periodLabel }: LunarHeaderProps) {
  const phase = getLunarPhase(new Date());
  const isFullish = Math.abs(phase - 0.5) < 0.15;

  return (
    <header className="relative overflow-hidden px-6 pt-12 pb-8">
      {/* Background glow */}
      <div className={`absolute inset-0 opacity-30 ${isFullish ? 'lunar-glow' : 'newmoon-glow'}`} />
      <div className="absolute top-4 right-6 opacity-20">
        {isFullish ? (
          <Sun className="w-24 h-24 text-fullmoon animate-float" />
        ) : (
          <Moon className="w-24 h-24 text-newmoon animate-float" />
        )}
      </div>

      <div className="relative z-10">
        <h1 className="font-display text-2xl font-bold text-gradient-gold">LunarFlow</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome, {userName}</p>
        {periodLabel && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full gradient-gold animate-glow-pulse" />
            <span className="text-xs font-medium text-primary">{periodLabel}</span>
          </div>
        )}
      </div>
    </header>
  );
}
