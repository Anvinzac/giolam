import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { ArrowLeft, ChevronRight, Copy, Download, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { getMoonEmoji, getMoonLabel, formatTime } from "@/lib/lunarUtils";

interface ShiftData {
  is_active: boolean;
  clock_in: string | null;
  clock_out: string | null;
  main_clock_in: string | null;
  main_clock_out: string | null;
  overtime_clock_in: string | null;
  overtime_clock_out: string | null;
  notice: string | null;
}

interface Employee {
  user_id: string;
  full_name: string;
  shift_type: string;
  department_name: string;
  shifts: Record<string, ShiftData>;
}

function timeToMinutes(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function calcHours(shift: ShiftData | undefined, shiftType: string): string {
  if (!shift || !shift.is_active) return "";
  if (shiftType === "overtime") {
    let total = 0;
    if (shift.main_clock_in && shift.main_clock_out)
      total += timeToMinutes(shift.main_clock_out) - timeToMinutes(shift.main_clock_in);
    if (shift.overtime_clock_in && shift.overtime_clock_out)
      total += timeToMinutes(shift.overtime_clock_out) - timeToMinutes(shift.overtime_clock_in);
    if (total === 0 && shift.clock_in && shift.clock_out)
      total = timeToMinutes(shift.clock_out) - timeToMinutes(shift.clock_in);
    if (total <= 0) return "";
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }
  if (shift.clock_in && shift.clock_out) {
    const total = timeToMinutes(shift.clock_out) - timeToMinutes(shift.clock_in);
    if (total <= 0) return "";
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }
  return "";
}

const DEPT_COLORS = [
  "175 70% 45%",   // teal
  "280 60% 55%",   // purple
  "42 90% 55%",    // gold
  "195 85% 50%",   // cyan
  "340 70% 55%",   // pink
  "155 70% 45%",   // green
  "25 85% 55%",    // orange
  "210 70% 55%",   // blue
];
const deptColorMap = new Map<string, string>();
function getDeptColor(dept: string): string {
  if (!deptColorMap.has(dept)) {
    deptColorMap.set(dept, DEPT_COLORS[deptColorMap.size % DEPT_COLORS.length]);
  }
  return deptColorMap.get(dept)!;
}

interface Props {
  periodId: string;
  periodStart: string;
  periodEnd: string;
  offDays: string[];
}

export default function AdminEmployeeList({ periodId, periodStart, periodEnd, offDays }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [copied, setCopied] = useState(false);

  const dates = useMemo(() => {
    const result: string[] = [];
    const start = parseISO(periodStart);
    const end = parseISO(periodEnd);
    const current = new Date(start);
    while (current <= end) {
      result.push(format(current, "yyyy-MM-dd"));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [periodStart, periodEnd]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: profiles }, { data: departments }, { data: allShifts }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, shift_type, department_id"),
        supabase.from("departments").select("id, name"),
        supabase.from("shifts").select("*").eq("period_id", periodId),
      ]);

      const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);
      const empMap = new Map<string, Employee>();

      for (const p of profiles || []) {
        empMap.set(p.user_id, {
          user_id: p.user_id,
          full_name: p.full_name || "Unnamed",
          shift_type: p.shift_type || "basic",
          department_name: deptMap.get(p.department_id || "") || "—",
          shifts: {},
        });
      }

      for (const s of allShifts || []) {
        const emp = empMap.get(s.user_id);
        if (emp) {
          emp.shifts[s.shift_date] = {
            is_active: s.is_active,
            clock_in: s.clock_in,
            clock_out: s.clock_out,
            main_clock_in: s.main_clock_in,
            main_clock_out: s.main_clock_out,
            overtime_clock_in: s.overtime_clock_in,
            overtime_clock_out: s.overtime_clock_out,
            notice: s.notice,
          };
        }
      }

      setEmployees(Array.from(empMap.values()).sort((a, b) => a.department_name.localeCompare(b.department_name)));
      setLoading(false);
    };
    fetchData();
  }, [periodId]);

  const getEmpStats = (emp: Employee) => {
    let worked = 0;
    let totalMin = 0;
    for (const d of dates) {
      const h = calcHours(emp.shifts[d], emp.shift_type);
      if (h) {
        worked++;
        const match = h.match(/(\d+)h(\d+)?/);
        if (match) totalMin += parseInt(match[1]) * 60 + parseInt(match[2] || "0");
      }
    }
    const totalH = Math.floor(totalMin / 60);
    const totalM = totalMin % 60;
    return { worked, total: totalM > 0 ? `${totalH}h${totalM}` : `${totalH}h` };
  };

  // CSV: each row = date, hours (blank for off day)
  const generateCSV = (emp: Employee): string => {
    const rows: string[] = ["Ngày,Giờ công"];
    for (const d of dates) {
      const isOff = offDays.includes(d);
      const dateLabel = format(parseISO(d), "dd/MM");
      if (isOff) {
        rows.push(`${dateLabel},`);
      } else {
        const h = calcHours(emp.shifts[d], emp.shift_type);
        rows.push(`${dateLabel},${h}`);
      }
    }
    return rows.join("\n");
  };

  const generateAllCSV = (): string => {
    // Header: Name, Dept, date1, date2, ...
    const dateHeaders = dates.map(d => format(parseISO(d), "dd/MM"));
    const rows: string[] = [`Nhân viên,Bộ phận,${dateHeaders.join(",")}`];
    for (const emp of employees) {
      const values = dates.map(d => {
        if (offDays.includes(d)) return "";
        return calcHours(emp.shifts[d], emp.shift_type);
      });
      rows.push(`${emp.full_name},${emp.department_name},${values.join(",")}`);
    }
    return rows.join("\n");
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Đã sao chép!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  // Detail view for a single employee
  if (selectedEmp) {
    const stats = getEmpStats(selectedEmp);
    const csv = generateCSV(selectedEmp);

    return (
      <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }}>
        {/* Back button */}
        <button
          onClick={() => setSelectedEmp(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground mb-4 active:opacity-70"
        >
          <ArrowLeft size={16} />
          Quay lại
        </button>

        {/* Employee header */}
        <div className="glass-card p-4 mb-3">
          <h2 className="font-display font-bold text-foreground">{selectedEmp.full_name}</h2>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
            <span>{selectedEmp.department_name}</span>
            <span>•</span>
            <span>{stats.worked} ngày</span>
            <span>•</span>
            <span className="text-primary font-semibold">{stats.total}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => copyToClipboard(csv)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium active:scale-[0.97] transition-transform"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            {copied ? "Đã chép" : "Sao chép"}
          </button>
          <button
            onClick={() => downloadCSV(csv, `${selectedEmp.full_name}.csv`)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-gold text-primary-foreground text-sm font-medium active:scale-[0.97] transition-transform"
          >
            <Download size={16} />
            Tải CSV
          </button>
        </div>

        {/* Shift list */}
        <div className="space-y-1.5">
          {dates.map(d => {
            const isOff = offDays.includes(d);
            const shift = selectedEmp.shifts[d];
            const hours = calcHours(shift, selectedEmp.shift_type);
            const date = parseISO(d);
            const dayName = format(date, "EEE", { locale: vi });
            const isSunday = date.getDay() === 0;
            const isSaturday = date.getDay() === 6;
            const isWeekend = isSaturday || isSunday;

            const moonEmoji = getMoonEmoji(date);
            const moonLabel = getMoonLabel(date);
            const isFullMoon = moonLabel === 'Full Moon';
            const isNewMoon = moonLabel === 'New Moon';
            const isMoonEve = moonLabel?.startsWith('Chay');

            const hasWork = shift?.is_active && hours;
            const noActivity = !isOff && !shift?.is_active && !shift?.notice;

            const bgClass = isOff
              ? "bg-off-day/30 opacity-50"
              : noActivity ? "bg-card border border-border/50 opacity-40"
              : isFullMoon ? "bg-fullmoon/10 border border-fullmoon/30"
              : isNewMoon ? "bg-newmoon/10 border border-newmoon/30"
              : isMoonEve ? "bg-primary/5 border border-primary/20"
              : isSunday ? "bg-sunday/10 border border-sunday/20"
              : isSaturday ? "bg-saturday/10 border border-saturday/20"
              : "bg-card border border-border/50";

            return (
              <div
                key={d}
                className={`rounded-xl overflow-hidden ${bgClass}`}
              >
                <div className="flex items-stretch min-h-[44px]">
                  {/* Day label */}
                  <div className={`w-14 flex flex-col items-center justify-center py-1.5 border-r border-border/30 ${
                    isOff ? "text-muted-foreground" :
                    isSunday ? "text-sunday" :
                    isSaturday ? "text-saturday" :
                    "text-foreground"
                  }`}>
                    <span className="text-xs font-semibold leading-none">{dayName}</span>
                    <span className="text-[10px] opacity-70">{format(date, "dd/MM")}</span>
                    {moonEmoji && <span className="text-xs mt-0.5">{moonEmoji}</span>}
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-center px-3 py-1.5">
                    {isOff ? (
                      <span className="text-xs text-muted-foreground">Nghỉ</span>
                    ) : shift?.is_active ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-success font-medium">{formatTime(shift.clock_in)}</span>
                          <span className="text-muted-foreground/50">→</span>
                          <span className="text-accent font-medium">{formatTime(shift.clock_out)}</span>
                        </div>
                        <span className="text-sm font-bold text-primary">{hours || "—"}</span>
                      </div>
                    ) : shift?.notice ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">📝</span>
                        <span className="text-xs text-muted-foreground truncate">{shift.notice}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">·</span>
                    )}

                    {/* Notice line (when active and has notice) */}
                    {shift?.is_active && shift.notice && (
                      <div className="mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate block">📝 {shift.notice}</span>
                      </div>
                    )}

                    {/* Moon label */}
                    {moonLabel && !isOff && (
                      <div className="mt-0.5">
                        <span className={`text-[10px] font-semibold ${
                          isFullMoon ? "text-fullmoon" : isNewMoon ? "text-newmoon" : "text-primary"
                        }`}>{moonLabel}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  }

  // Employee list view
  return (
    <div>
      {/* Export all button */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => copyToClipboard(generateAllCSV())}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium active:scale-[0.97] transition-transform"
        >
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          {copied ? "Đã chép" : "Chép tất cả"}
        </button>
        <button
          onClick={() => downloadCSV(generateAllCSV(), `bang-cong-${periodStart}.csv`)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-gold text-primary-foreground text-sm font-medium active:scale-[0.97] transition-transform"
        >
          <Download size={16} />
          Tải CSV
        </button>
      </div>

      {/* Employee cards - 2 column grid */}
      <div className="grid grid-cols-2 gap-2">
        {employees.map(emp => {
          const stats = getEmpStats(emp);
          return (
            <motion.button
              key={emp.user_id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedEmp(emp)}
              className="w-full glass-card p-3 flex flex-col items-start text-left active:bg-muted/50 transition-colors"
            >
              <div className="text-sm font-semibold text-foreground leading-tight truncate w-full">{emp.full_name}</div>
              <span
                className="mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold truncate max-w-full"
                style={{
                  backgroundColor: `hsl(${getDeptColor(emp.department_name)} / 0.15)`,
                  color: `hsl(${getDeptColor(emp.department_name)})`,
                  borderWidth: '1px',
                  borderColor: `hsl(${getDeptColor(emp.department_name)} / 0.3)`,
                }}
              >
                {emp.department_name}
              </span>
              <div className="flex items-center justify-between w-full mt-2">
                <span className="text-[11px] text-muted-foreground">{stats.worked}/{dates.length} ngày</span>
                <span className="text-sm font-bold text-primary">{stats.total}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
