// Seed script: working period April 25 – May 24, 2026
// Global off-days: May 4, May 19
// Special rates: Sat 15%, Sun 20%, New Moon 40%, Full Moon 40%,
//                Day Before New/Full Moon 15%
// Run: node seed_apr25_may24.cjs

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyam1rcXBleGNqc3FreGVucGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjEyMTUsImV4cCI6MjA5MDMzNzIxNX0.UQRi9s3MQt-Gpj3uYzW6ghoKZo608d6r0KEnPcKIgeo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  console.log('=== Seeding period: 2026-04-25 → 2026-05-24 ===\n');

  // ── 1. Upsert working period ──────────────────────────────────────────────
  const startDate = '2026-04-25';
  const endDate   = '2026-05-24';
  const offDays   = ['2026-05-04', '2026-05-19'];

  // Check if period already exists
  const { data: existing } = await supabase
    .from('working_periods')
    .select('id')
    .eq('start_date', startDate)
    .eq('end_date', endDate)
    .maybeSingle();

  let periodId;
  if (existing) {
    periodId = existing.id;
    await supabase.from('working_periods').update({ off_days: offDays }).eq('id', periodId);
    console.log('✅ Updated existing period ID:', periodId);
  } else {
    const { data: created, error: pErr } = await supabase
      .from('working_periods')
      .insert({ start_date: startDate, end_date: endDate, off_days: offDays })
      .select()
      .single();
    if (pErr) { console.error('❌ Period insert failed:', pErr.message); return; }
    periodId = created.id;
    console.log('✅ Created period ID:', periodId);
  }

  // ── 2. Special day rates ──────────────────────────────────────────────────
  // Computed from lunarUtils algorithm for this date range.
  // Off-days (May 4, May 19) are excluded per project convention.
  // When a date has multiple types, highest rate wins (same as generateDefaultSpecialDays).
  //
  // Date        Day         Type(s)                          Rate
  // 2026-04-25  Saturday    saturday                          15%
  // 2026-04-26  Sunday      sunday & Lễ                       30%
  // 2026-04-30  Thursday    Ngày chay & Lễ                    30%
  // 2026-05-01  Friday      Rằm & Lễ                          50%
  // 2026-05-02  Saturday    saturday                          15%
  // 2026-05-03  Sunday      sunday                            20%
  // 2026-05-09  Saturday    saturday                          15%
  // 2026-05-10  Sunday      sunday                            20%
  // 2026-05-16  Saturday    T7 & Ngày chay                    25%
  // 2026-05-17  Sunday      Chủ Nhật & Mùng 1                 50%
  // 2026-05-23  Saturday    saturday                          15%
  // 2026-05-24  Sunday      sunday                            20%

  const specialDays = [
    { date: '2026-04-25', type: 'saturday',              desc: 'Thứ Bảy + 15%',        rate: 15 },
    { date: '2026-04-26', type: 'sunday',                desc: 'Chủ Nhật & Lễ + 30%',  rate: 30 },
    { date: '2026-04-30', type: 'custom',                desc: 'Ngày chay & Lễ + 30%', rate: 30 },
    { date: '2026-05-01', type: 'full_moon',             desc: 'Rằm & Lễ + 50%',       rate: 50 },
    { date: '2026-05-02', type: 'saturday',              desc: 'Thứ Bảy + 15%',        rate: 15 },
    { date: '2026-05-03', type: 'sunday',                desc: 'Chủ Nhật + 20%',       rate: 20 },
    { date: '2026-05-09', type: 'saturday',              desc: 'Thứ Bảy + 15%',        rate: 15 },
    { date: '2026-05-10', type: 'sunday',                desc: 'Chủ Nhật + 20%',       rate: 20 },
    { date: '2026-05-16', type: 'custom',                desc: 'T7 & Ngày chay + 25%', rate: 25 },
    { date: '2026-05-17', type: 'new_moon',              desc: 'Chủ Nhật & Mùng 1 + 50%', rate: 50 },
    { date: '2026-05-23', type: 'saturday',              desc: 'Thứ Bảy + 15%',        rate: 15 },
    { date: '2026-05-24', type: 'sunday',                desc: 'Chủ Nhật + 20%',       rate: 20 },
  ];

  // Clear any existing rates for this period first
  await supabase.from('special_day_rates').delete().eq('period_id', periodId);

  const { error: rErr } = await supabase.from('special_day_rates').insert(
    specialDays.map((sd, i) => ({
      period_id:      periodId,
      special_date:   sd.date,
      day_type:       sd.type,
      description_vi: sd.desc,
      rate_percent:   sd.rate,
      sort_order:     i,
    }))
  );

  if (rErr) { console.error('❌ Special rates insert failed:', rErr.message); return; }
  console.log(`✅ Inserted ${specialDays.length} special day rates`);
  specialDays.forEach(sd => console.log(`   ${sd.date}  ${sd.desc}`));

  console.log('\n=== Done ===');
  console.log('Period is ready. Employees will appear once you open the admin salary page for this period.');
}

seed().catch(console.error);
