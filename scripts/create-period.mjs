// Seed script: working period June 24 – July 25, 2026
// Global off-days: July 1, July 6, July 7, July 16
// Run: ADMIN_USER=xxx ADMIN_PASS=xxx node scripts/create-period.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rrjmkqpexcjsqkxenpet.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyam1rcXBleGNqc3FreGVucGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjEyMTUsImV4cCI6MjA5MDMzNzIxNX0.UQRi9s3MQt-Gpj3uYzW6ghoKZo608d6r0KEnPcKIgeo";

const ADMIN_USERNAME = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASS;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_USER and ADMIN_PASS environment variables.");
  console.error("Example: ADMIN_USER=admin ADMIN_PASS=yourpass node scripts/create-period.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const period = {
  start_date: "2026-06-24",
  end_date: "2026-07-25",
  off_days: ["2026-07-01", "2026-07-06", "2026-07-07", "2026-07-16"],
  is_archived: false,
};

// Sign in as admin
const res = await fetch(`${SUPABASE_URL}/functions/v1/login-by-username`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
  },
  body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
});

const authData = await res.json();
if (!res.ok || !authData.session) {
  console.error("Failed to sign in:", authData.error || authData);
  process.exit(1);
}

await supabase.auth.setSession({
  access_token: authData.session.access_token,
  refresh_token: authData.session.refresh_token,
});

console.log(`Signed in as ${ADMIN_USERNAME}, inserting period...`);

const { data, error } = await supabase.from("working_periods").insert(period).select();

if (error) {
  console.error("Error inserting period:", error.message);
  process.exit(1);
}

console.log("Period created:", JSON.stringify(data, null, 2));
