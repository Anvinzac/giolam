const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://rrjmkqpexcjsqkxenpet.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyam1rcXBleGNqc3FreGVucGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjEyMTUsImV4cCI6MjA5MDMzNzIxNX0.UQRi9s3MQt-Gpj3uYzW6ghoKZo608d6r0KEnPcKIgeo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  console.log("Starting manual seed for Feb 25 - Mar 25...");

  const startDate = "2026-02-25";
  const endDate = "2026-03-25";
  const offDay = "2026-03-23";

  // 1. Find or Create Period
  let periodId;
  const { data: existing } = await supabase
    .from("working_periods")
    .select("id")
    .eq("start_date", startDate)
    .eq("end_date", endDate)
    .maybeSingle();

  if (existing) {
    periodId = existing.id;
    console.log("Using existing period:", periodId);
    await supabase.from("working_periods").update({ off_days: [offDay] }).eq("id", periodId);
  } else {
    const { data: newP, error: pErr } = await supabase
      .from("working_periods")
      .insert({ start_date: startDate, end_date: endDate, off_days: [offDay] })
      .select()
      .single();
    if (pErr) { console.error("Error creating period:", pErr); return; }
    periodId = newP.id;
    console.log("Created period:", periodId);
  }

  // 2. Special Day Rates
  const specialDays = [
    { date: "2026-02-28", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
    { date: "2026-03-01", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
    { date: "2026-03-02", type: "day_before_full_moon", desc: "Trước Rằm + 15%", rate: 15 },
    { date: "2026-03-03", type: "full_moon", desc: "Rằm + 40%", rate: 40 },
    { date: "2026-03-07", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
    { date: "2026-03-08", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
    { date: "2026-03-14", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 }, 
    { date: "2026-03-15", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 }, 
    { date: "2026-03-18", type: "day_before_new_moon", desc: "Trước Mùng 1 + 15%", rate: 15 },
    { date: "2026-03-19", type: "new_moon", desc: "Mùng 1 + 40%", rate: 40 },
    { date: "2026-03-21", type: "saturday", desc: "Thứ Bảy + 15%", rate: 15 },
    { date: "2026-03-22", type: "sunday", desc: "Chủ Nhật + 20%", rate: 20 },
  ];

  await supabase.from("special_day_rates").delete().eq("period_id", periodId);
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

  // 3. Test Employees
  const employees = [
    { user_id: 'eb79e954-0000-0000-0000-000000000001', full_name: 'Nguyễn Văn A (Test)', shift_type: 'basic', base_salary: 8400000, hourly_rate: 0 },
    { user_id: 'eb79e954-0000-0000-0000-000000000002', full_name: 'Trần Thị B (Test)', shift_type: 'overtime', base_salary: 7000000, hourly_rate: 25000 },
    { user_id: 'eb79e954-0000-0000-0000-000000000003', full_name: 'Lê Văn C (Test)', shift_type: 'notice_only', base_salary: 0, hourly_rate: 30000 },
  ];

  for (const emp of employees) {
    await supabase.from("profiles").upsert(emp, { onConflict: 'user_id' });
  }

  // 4. entries
  await supabase.from("salary_entries").delete().eq("period_id", periodId);
  
  const roundToThousand = (n) => Math.round(n / 1000) * 1000;
  const getRate = (dStr) => specialDays.find(s => s.date === dStr)?.rate || 0;

  // Emp A
  const dailyBaseA = roundToThousand(8400000 / 28);
  const entriesA = specialDays.map(sd => {
    const isOff = sd.date === offDay;
    const rate = sd.rate;
    const allowance = roundToThousand(dailyBaseA * rate / 100);
    return {
      user_id: 'eb79e954-0000-0000-0000-000000000001',
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

  // Emp B
  const dailyBaseB = roundToThousand(7000000 / 28);
  const entriesB = [];
  let d_it = new Date(startDate + "T00:00:00");
  while (toISODateString(d_it) <= endDate) {
    const date = toISODateString(d_it);
    const isOff = date === offDay;
    const rate = getRate(date);
    const allowance = roundToThousand(dailyBaseB * rate / 100);
    const dow = d_it.getDay();
    const hasOT = (dow === 0 || dow === 6) && !isOff;
    const hours = hasOT ? 2 : 0;
    const extraWage = roundToThousand(hours * 25000);

    entriesB.push({
      user_id: 'eb79e954-0000-0000-0000-000000000002',
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

function toISODateString(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

seed();
