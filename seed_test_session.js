#!/usr/bin/env node

/**
 * Test Session Seeder
 * Creates test employees with salary data for demo/testing
 * Usage:
 *   node seed_test_session.js seed    - Create test data
 *   node seed_test_session.js clear   - Remove test data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test accounts
const TEST_ACCOUNTS = [
  {
    username: 'nhanvien_a',
    password: 'test123',
    full_name: 'Nguyễn Văn A',
    shift_type: 'basic',
    base_salary: 5000000,
    hourly_rate: 25000,
    default_clock_in: '17:00',
    default_clock_out: '22:00',
  },
  {
    username: 'nhanvien_b',
    password: 'test123',
    full_name: 'Trần Thị B',
    shift_type: 'overtime',
    base_salary: 4500000,
    hourly_rate: 30000,
    default_clock_in: '17:00',
    default_clock_out: '22:00',
  },
  {
    username: 'nhanvien_c',
    password: 'test123',
    full_name: 'Lê Văn C',
    shift_type: 'notice_only',
    base_salary: 0,
    hourly_rate: 35000,
    default_clock_in: '08:00',
    default_clock_out: '17:30',
  },
];

async function clearTestData() {
  console.log('🧹 Clearing test data...\n');

  // Get test user IDs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username')
    .in('username', TEST_ACCOUNTS.map(a => a.username));

  if (!profiles || profiles.length === 0) {
    console.log('✅ No test data found to clear');
    return;
  }

  const userIds = profiles.map(p => p.user_id);
  console.log(`Found ${profiles.length} test accounts:`);
  profiles.forEach(p => console.log(`  - ${p.username}`));
  console.log();

  // Delete in order (respecting foreign keys)
  const tables = [
    'salary_records',
    'salary_entries',
    'employee_allowances',
    'shift_registrations',
    'shifts',
    'user_roles',
    'profiles',
  ];

  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .delete()
      .in('user_id', userIds);
    
    if (error) {
      console.log(`⚠️  ${table}: ${error.message}`);
    } else {
      console.log(`✓ Cleared ${table}`);
    }
  }

  // Delete auth users (requires service role key in production)
  console.log('\n⚠️  Note: Auth users must be deleted manually from Supabase dashboard');
  console.log('   Go to Authentication > Users and delete:');
  profiles.forEach(p => console.log(`   - ${p.username}`));

  console.log('\n✅ Test data cleared successfully');
}

async function seedTestData() {
  console.log('🌱 Seeding test data...\n');

  // Check if working period exists
  const today = new Date().toISOString().split('T')[0];
  let { data: periods } = await supabase
    .from('working_periods')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today)
    .limit(1);

  let period = periods?.[0];

  if (!period) {
    console.log('📅 Creating working period for current month...');
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const { data: newPeriod, error } = await supabase
      .from('working_periods')
      .insert({
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        off_days: [],
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create period:', error.message);
      process.exit(1);
    }
    period = newPeriod;
    console.log(`✓ Created period: ${period.start_date} to ${period.end_date}\n`);
  } else {
    console.log(`✓ Using existing period: ${period.start_date} to ${period.end_date}\n`);
  }

  // Create test accounts
  for (const account of TEST_ACCOUNTS) {
    console.log(`👤 Creating ${account.username} (${account.full_name})...`);

    // Check if user exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id, username')
      .eq('username', account.username)
      .single();

    if (existing) {
      console.log(`   ⚠️  User already exists, skipping`);
      continue;
    }

    // Create auth user via edge function
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/manage-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          action: 'create',
          username: account.username,
          password: account.password,
          full_name: account.full_name,
          shift_type: account.shift_type,
          base_salary: account.base_salary,
          hourly_rate: account.hourly_rate,
          default_clock_in: account.default_clock_in,
          default_clock_out: account.default_clock_out,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`);
        continue;
      }

      console.log(`   ✓ Created successfully`);
      console.log(`   📝 Username: ${account.username}`);
      console.log(`   🔑 Password: ${account.password}`);
      console.log(`   💼 Type: ${account.shift_type}`);
      console.log();

    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  console.log('✅ Test data seeded successfully\n');
  console.log('📱 Test accounts:');
  TEST_ACCOUNTS.forEach(a => {
    console.log(`   ${a.username} / ${a.password} (${a.full_name})`);
  });
  console.log('\n🌐 Login at: http://localhost:5199/login');
}

// Main
const action = process.argv[2];

if (action === 'seed') {
  seedTestData().catch(console.error);
} else if (action === 'clear') {
  clearTestData().catch(console.error);
} else {
  console.log('Usage:');
  console.log('  node seed_test_session.js seed    - Create test data');
  console.log('  node seed_test_session.js clear   - Remove test data');
  process.exit(1);
}
