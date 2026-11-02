const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');

// Read .env file
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
  console.log("Inspecting shift_registrations for 2026-08-03 to 2026-08-09...\n");

  const { data, error } = await supabase
    .from("shift_registrations")
    .select("id, user_id, shift_date, shift_slot, clock_in, clock_out, status, admin_note, created_at")
    .gte("shift_date", "2026-08-03")
    .lte("shift_date", "2026-08-09")
    .order("shift_date", { ascending: true });

  if (error) {
    console.error("Error fetching:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log("No registrations found in this date range.");
    return;
  }

  console.log(`Found ${data.length} registrations:\n`);

  // Get user names
  const userIds = [...new Set(data.map(r => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, full_name")
    .in("user_id", userIds);

  const nameMap = new Map();
  for (const p of (profiles || [])) {
    nameMap.set(p.user_id, p.username || p.full_name || p.user_id);
  }

  // Group by date
  const byDate = {};
  for (const r of data) {
    if (!byDate[r.shift_date]) byDate[r.shift_date] = [];
    byDate[r.shift_date].push(r);
  }

  for (const [date, regs] of Object.entries(byDate)) {
    console.log(`--- ${date} (${regs.length} registrations) ---`);
    for (const r of regs) {
      console.log(`  ${nameMap.get(r.user_id) || r.user_id} | ${r.shift_slot} | ${r.clock_in || 'null'} - ${r.clock_out || 'null'} | ${r.status} | ${r.admin_note || ''}`);
    }
    console.log();
  }

  // Also check shifts table
  console.log("\n=== Checking shifts table for same range ===");
  const { data: shifts, error: shiftErr } = await supabase
    .from("shifts")
    .select("id, user_id, shift_date, shift_slot, clock_in, clock_out, is_active, period_id")
    .gte("shift_date", "2026-08-03")
    .lte("shift_date", "2026-08-09")
    .order("shift_date", { ascending: true });

  if (shiftErr) {
    console.error("Error fetching shifts:", shiftErr.message);
  } else if (!shifts || shifts.length === 0) {
    console.log("No shifts found in this date range.");
  } else {
    console.log(`Found ${shifts.length} shifts:\n`);
    const byDate2 = {};
    for (const s of shifts) {
      if (!byDate2[s.shift_date]) byDate2[s.shift_date] = [];
      byDate2[s.shift_date].push(s);
    }
    for (const [date, sh] of Object.entries(byDate2)) {
      console.log(`--- ${date} (${sh.length} shifts) ---`);
      for (const s of sh) {
        console.log(`  ${nameMap.get(s.user_id) || s.user_id} | ${s.shift_slot} | ${s.clock_in || 'null'} - ${s.clock_out || 'null'} | active=${s.is_active}`);
      }
      console.log();
    }
  }
}

inspect();