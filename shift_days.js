import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function shiftTableDates(tableName, startDate, endDate) {
  console.log(`Shifting dates in ${tableName} from ${startDate} to ${endDate}...`);
  
  const { data: records, error: fetchErr } = await supabase
    .from(tableName)
    .select("*")
    .gte('shift_date', startDate)
    .lte('shift_date', endDate);
    
  if (fetchErr) {
    console.error(`Error fetching from ${tableName}:`, fetchErr.message);
    return;
  }
  
  if (!records || records.length === 0) {
    console.log(`No records found in ${tableName} for this date range.`);
    return;
  }
  
  console.log(`Found ${records.length} records to shift.`);
  
  // Backup records
  fs.writeFileSync(`${tableName}_backup.json`, JSON.stringify(records, null, 2));
  console.log(`Backed up to ${tableName}_backup.json`);
  
  const { error: deleteErr } = await supabase
    .from(tableName)
    .delete()
    .gte('shift_date', startDate)
    .lte('shift_date', endDate);
    
  if (deleteErr) {
    console.error(`Error deleting old records in ${tableName}:`, deleteErr.message);
    return;
  }
  
  console.log(`Deleted old records in ${tableName}.`);
  
  const newRecords = records.map(r => {
    const { id, created_at, updated_at, ...rest } = r;
    const oldDate = new Date(r.shift_date);
    oldDate.setUTCDate(oldDate.getUTCDate() + 1);
    const newDateStr = oldDate.toISOString().slice(0, 10);
    return { ...rest, shift_date: newDateStr };
  });
  
  const { error: insertErr } = await supabase
    .from(tableName)
    .insert(newRecords);
    
  if (insertErr) {
    console.error(`Error inserting new records in ${tableName}:`, insertErr.message);
    console.log("To restore, run a script to insert from backup JSON.");
    return;
  }
  
  console.log(`Successfully shifted ${newRecords.length} records in ${tableName}.`);
}

async function run() {
  await shiftTableDates("shifts", "2026-08-02", "2026-08-08");
  await shiftTableDates("shift_registrations", "2026-08-02", "2026-08-08");
}

run();
