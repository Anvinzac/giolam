import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { formatTime } from "@/lib/lunarUtils";
import { Badge } from "@/components/ui/badge";

interface ShiftChange {
  id: string;
  user_id: string;
  full_name: string;
  shift_date: string;
  is_active: boolean;
  clock_in: string | null;
  clock_out: string | null;
  notice: string | null;
  updated_at: string;
}

const LAST_VIEWED_KEY = "admin_changes_last_viewed";

export function getLastViewedTime(): string {
  return localStorage.getItem(LAST_VIEWED_KEY) || "1970-01-01T00:00:00Z";
}

export function setLastViewedTime() {
  localStorage.setItem(LAST_VIEWED_KEY, new Date().toISOString());
}

interface Props {
  periodId: string;
  onBadgeCount?: (count: number) => void;
}

export default function AdminChangesList({ periodId, onBadgeCount }: Props) {
  const [changes, setChanges] = useState<ShiftChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChanges = async () => {
      const [{ data: shifts }, { data: profiles }] = await Promise.all([
        supabase
          .from("shifts")
          .select("id, user_id, shift_date, is_active, clock_in, clock_out, notice, updated_at")
          .eq("period_id", periodId)
          .order("updated_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name"),
      ]);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name || "Unnamed"]) || []);

      const today = new Date().toISOString().split("T")[0];
      const result: ShiftChange[] = (shifts || [])
        .filter(s => s.shift_date >= today && (s.notice || s.clock_in || s.clock_out))
        .map(s => ({
          ...s,
          full_name: nameMap.get(s.user_id) || "Unnamed",
        }));

      setChanges(result);
      setLoading(false);

      // Count unseen
      const lastViewed = getLastViewedTime();
      const unseenCount = result.filter(c => c.updated_at > lastViewed).length;
      onBadgeCount?.(unseenCount);
    };
    fetchChanges();
  }, [periodId, onBadgeCount]);

  useEffect(() => {
    // Mark as viewed when this component mounts
    setLastViewedTime();
    onBadgeCount?.(0);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground text-sm">
        Không có thay đổi nào sắp tới
      </div>
    );
  }

  const lastViewed = getLastViewedTime();

  return (
    <div className="space-y-2">
      {changes.map(c => {
        const isNew = c.updated_at > lastViewed;
        const date = parseISO(c.shift_date);
        const dayName = format(date, "EEEE", { locale: vi });

        return (
          <div
            key={c.id}
            className={`glass-card p-4 space-y-1.5 ${isNew ? "border-primary/40 ring-1 ring-primary/20" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{c.full_name}</span>
                {isNew && <Badge variant="default" className="text-[10px] px-1.5 py-0">Mới</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">
                {format(date, "dd/MM")} · {dayName}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              {c.is_active && (c.clock_in || c.clock_out) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-success font-medium">{formatTime(c.clock_in)}</span>
                  <span className="text-muted-foreground/50">→</span>
                  <span className="text-accent font-medium">{formatTime(c.clock_out)}</span>
                </div>
              )}
              {!c.is_active && !c.notice && (
                <span className="text-muted-foreground">Nghỉ</span>
              )}
            </div>

            {c.notice && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>📝</span>
                <span className="truncate">{c.notice}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
