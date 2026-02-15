import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInMinutes } from "date-fns";

interface EmployeeShift {
  user_id: string;
  full_name: string;
  shift_type: string;
  department_name: string;
  shifts: Record<string, {
    is_active: boolean;
    clock_in: string | null;
    clock_out: string | null;
    main_clock_in: string | null;
    main_clock_out: string | null;
    overtime_clock_in: string | null;
    overtime_clock_out: string | null;
    notice: string | null;
  }>;
}

function timeToMinutes(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function calcWorkingHours(shift: EmployeeShift["shifts"][string], shiftType: string): string {
  if (!shift || !shift.is_active) return "-";

  if (shiftType === "overtime") {
    // For overtime: main hours + overtime hours
    let totalMinutes = 0;
    if (shift.main_clock_in && shift.main_clock_out) {
      totalMinutes += timeToMinutes(shift.main_clock_out) - timeToMinutes(shift.main_clock_in);
    }
    if (shift.overtime_clock_in && shift.overtime_clock_out) {
      totalMinutes += timeToMinutes(shift.overtime_clock_out) - timeToMinutes(shift.overtime_clock_in);
    }
    // Fallback to clock_in/clock_out if main not set
    if (totalMinutes === 0 && shift.clock_in && shift.clock_out) {
      totalMinutes = timeToMinutes(shift.clock_out) - timeToMinutes(shift.clock_in);
    }
    if (totalMinutes <= 0) return "-";
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }

  // Basic/fixed shift: clock_out - clock_in
  if (shift.clock_in && shift.clock_out) {
    const totalMinutes = timeToMinutes(shift.clock_out) - timeToMinutes(shift.clock_in);
    if (totalMinutes <= 0) return "-";
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }
  return "-";
}

interface Props {
  periodId: string;
  periodStart: string;
  periodEnd: string;
  offDays: string[];
}

export default function AdminEmployeeTable({ periodId, periodStart, periodEnd, offDays }: Props) {
  const [employees, setEmployees] = useState<EmployeeShift[]>([]);
  const [loading, setLoading] = useState(true);

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
      // Fetch all profiles with departments
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, shift_type, department_id");

      // Fetch departments
      const { data: departments } = await supabase.from("departments").select("id, name");
      const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);

      // Fetch all shifts for this period
      const { data: allShifts } = await supabase
        .from("shifts")
        .select("*")
        .eq("period_id", periodId);

      // Map data
      const empMap = new Map<string, EmployeeShift>();
      for (const p of (profiles || [])) {
        empMap.set(p.user_id, {
          user_id: p.user_id,
          full_name: p.full_name || "Unnamed",
          shift_type: p.shift_type || "basic",
          department_name: deptMap.get(p.department_id || "") || "—",
          shifts: {},
        });
      }

      for (const s of (allShifts || [])) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  const isOffDay = (d: string) => offDays.includes(d);
  const isWeekend = (d: string) => {
    const day = parseISO(d).getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="overflow-x-auto -mx-4">
      <table className="text-[10px] border-collapse min-w-max">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-card px-2 py-1.5 text-left font-semibold text-foreground border-b border-border min-w-[80px]">
              Nhân viên
            </th>
            <th className="sticky left-[80px] z-20 bg-card px-1 py-1.5 text-left font-medium text-muted-foreground border-b border-border min-w-[50px]">
              BP
            </th>
            {dates.map(d => {
              const date = parseISO(d);
              const dayNum = format(date, "d");
              const dayName = format(date, "EEE");
              const off = isOffDay(d);
              const weekend = isWeekend(d);
              return (
                <th
                  key={d}
                  className={`px-1 py-1 text-center border-b border-border min-w-[36px] ${
                    off ? "bg-destructive/10 text-destructive" :
                    weekend ? "bg-accent/10 text-accent" :
                    "text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold">{dayNum}</div>
                  <div className="text-[8px] opacity-70">{dayName}</div>
                </th>
              );
            })}
            <th className="px-2 py-1.5 text-center font-semibold text-primary border-b border-border min-w-[40px]">
              Tổng
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            let totalMinutes = 0;
            return (
              <tr key={emp.user_id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium text-foreground whitespace-nowrap">
                  {emp.full_name}
                  {emp.shift_type === "overtime" && (
                    <span className="ml-1 text-[8px] text-accent font-normal">OT</span>
                  )}
                </td>
                <td className="sticky left-[80px] z-10 bg-card px-1 py-1 text-muted-foreground whitespace-nowrap">
                  {emp.department_name}
                </td>
                {dates.map(d => {
                  const shift = emp.shifts[d];
                  const hours = calcWorkingHours(shift, emp.shift_type);
                  const off = isOffDay(d);

                  // Accumulate total
                  if (hours !== "-") {
                    const match = hours.match(/(\d+)h(\d+)?/);
                    if (match) {
                      totalMinutes += parseInt(match[1]) * 60 + (parseInt(match[2] || "0"));
                    }
                  }

                  return (
                    <td
                      key={d}
                      className={`px-0.5 py-1 text-center ${
                        off ? "bg-destructive/5" :
                        shift?.is_active ? "text-success" :
                        shift?.notice ? "text-accent" :
                        "text-muted-foreground/30"
                      }`}
                    >
                      {shift?.notice && !shift.is_active ? (
                        <span className="text-[8px]" title={shift.notice}>📝</span>
                      ) : hours !== "-" ? (
                        hours
                      ) : off ? "" : "·"}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center font-semibold text-primary">
                  {totalMinutes > 0 ? `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 > 0 ? totalMinutes % 60 : ""}` : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
