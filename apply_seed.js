const { createClient } = require('@supabase/supabase-js');

// Load environment variables manually since we might not have dotenv
const SUPABASE_URL = "https://rrjmkqpexcjsqkxenpet.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyam1rcXBleGNqc3FreGVucGV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDc2MTIxNSwiZXhwIjoyMDkwMzM3MjE1fQ.6L03E8X6L03E8X6L03E8X6L03E8X6L03E8X6L03E8X"; // Service role key is better for seeding

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  console.log("Starting manual seed for Feb 25 - Mar 25...");

  // 1. Create/Update Period
  const startDate = "2026-02-25";
  const endDate = "2026-03-25";
  const offDay = "2026-03-23";

  // Upsert period
  const { data: period, error: pErr } = await supabase
    .from("working_periods")
    .upsert({
      start_date: startDate,
      end_date: endDate,
      off_days: [offDay]
    }, { onConflict: 'start_date,end_date' })
    .select()
    .single();

  if (pErr) { console.error("Error creating period:", pErr); return; }
  const periodId = period.id;
  console.log("Period ID:", periodId);

  // 2. Special Day Rates
  const specialDays = [
    { date: "2026-02-28", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
    { date: "2026-03-01", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
    { date: "2026-03-02", type: "day_before_full_moon", desc: "Trước Rằm + 15%", rate: 15 },
    { date: "2026-03-03", type: "full_moon", desc: "Rằm + 40%", rate: 40 },
    { date: "2026-03-07", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
    { date: "2026-03-08", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
    { date: "2026-03-14", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 }, // Standard weekend as requested
    { date: "2026-03-15", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },  // Standard weekend as requested
    { date: "2026-03-18", type: "day_before_new_moon", desc: "Trước Mùng 1 + 15%", rate: 15 },
    { date: "2026-03-19", type: "new_moon", desc: "Mùng 1 + 40%", rate: 40 },
    { date: "2026-03-21", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
    { date: "2026-03-22", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
  ];

  // Delete old rates for this period
  await supabase.from("special_day_rates").delete().eq("period_id", periodId);
  
  // Insert new rates
  const { error: rErr } = await supabase.from("special_day_rates").insert(
    specialDays.map((sd, i) => ({
      period_id: periodId,
      special_date: sd.date,
      day_type: sd.type,
      description_vi: sd.desc,
      rate_percent: sd.rate,
      sort_order: i
    }))
  );
  if (rErr) console.error("Error inserting rates:", rErr);

  // 3. Profiles (Test Employees)
  const employees = [
    { user_id: 'user_a_id', full_name: 'Nguyễn Văn A (Test)', shift_type: 'basic', base_salary: 8400000, hourly_rate: 0 },
    { user_id: 'user_b_id', full_name: 'Trần Thị B (Test)', shift_type: 'overtime', base_salary: 7000000, hourly_rate: 25000 },
    { user_id: 'user_c_id', full_name: 'Lê Văn C (Test)', shift_type: 'notice_only', base_salary: 0, hourly_rate: 30000 },
  ];

  for (const emp of employees) {
    await supabase.from("profiles").upsert(emp, { onConflict: 'user_id' });
  }

  // 4. Salary Entries (Calculation logic)
  const roundToThousand = (n) => Math.round(n / 1000) * 1000;
  const getRate = (dStr) => specialDays.find(s => s.date === dStr)?.rate || 0;

  // Clear old entries
  await supabase.from("salary_entries").delete().eq("period_id", periodId);

  // Seed Emp A (Basic)
  const dailyBaseA = roundToThousand(8400000 / 28);
  const entriesA = specialDays.map(sd => {
    const isOff = sd.date === offDay;
    const rate = sd.rate;
    const allowance = roundToThousand(dailyBaseA * rate / 100);
    const deduction = isOff ? dailyBaseA : 0;
    return {
      user_id: 'user_a_id',
      period_id: periodId,
      entry_date: sd.date,
      sort_order: 0,
      is_day_off: isOff,
      off_percent: isOff ? 100 : 0,
      base_daily_wage: dailyBaseA,
      allowance_amount: isOff ? 0 : allowance,
      extra_wage: 0,
      total_daily_wage: isOff ? 0 : dailyBaseA + allowance,
    };
  });
  await supabase.from("salary_entries").insert(entriesA);

  // Seed Emp B (Overtime)
  const dailyBaseB = roundToThousand(7000000 / 28);
  const entriesB = [];
  let d_it = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (d_it <= end) {
    const date = d_it.toISOString().split('T')[0];
    const isOff = date === offDay;
    const rate = getRate(date);
    const allowance = roundToThousand(dailyBaseB * rate / 100);
    const hasOT = d_it.getDay() === 0 || d_it.getDay() === 6;
    const hours = hasOT && !isOff ? 2 : 0;
    const extraWage = roundToThousand(hours * 25000);

    entriesB.push({
      user_id: 'user_b_id',
      period_id: periodId,
      entry_date: date,
      sort_order: 0,
      is_day_off: isOff,
      off_percent: isOff ? 100 : 0,
      base_daily_wage: dailyBaseB,
      allowance_amount: isOff ? 0 : allowance,
      extra_wage: extraWage,
      total_daily_wage: isOff ? 0 : dailyBaseB + allowance + extraWage,
    });
    d_it.setDate(d_it.getDate() + 1);
  }
  await supabase.from("salary_entries").insert(entriesB);

  console.log("Seeding complete!");
}

seed();
