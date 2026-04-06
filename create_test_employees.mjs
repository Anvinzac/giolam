#!/usr/bin/env node

/**
 * Create test employee accounts
 * Usage: node create_test_employees.mjs
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

const PASSWORD = 'l@123456';

// Kitchen employees
const kitchen = [
  { username: 'chithoa', full_name: 'Chị Thoa', shift_type: 'basic', base_salary: 5000000, hourly_rate: 25000 },
  { username: 'chithu', full_name: 'Chị Thu', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'chioanh', full_name: 'Chị Oanh', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'chiNuong', full_name: 'Chị Nương', shift_type: 'overtime', base_salary: 4500000, hourly_rate: 30000 },
  { username: 'chiXuan', full_name: 'Chị Xuân', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'coHa', full_name: 'Cô Hà', shift_type: 'basic', base_salary: 5000000, hourly_rate: 25000 },
  { username: 'anhCuong', full_name: 'Anh Cường', shift_type: 'overtime', base_salary: 4500000, hourly_rate: 30000 },
  { username: 'chichi', full_name: 'Chị Chi', shift_type: 'overtime', base_salary: 4500000, hourly_rate: 30000 },
  { username: 'tphi', full_name: 'T. Phi', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'ntruong', full_name: 'N. Trường', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'chinu', full_name: 'Chị Nụ', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'chiLinh', full_name: 'Chị Linh', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
];

// Service employees
const service = [
  { username: 'ptuan', full_name: 'P. Tuấn', shift_type: 'overtime', base_salary: 4500000, hourly_rate: 30000 },
  { username: 'hthao', full_name: 'H. Thảo', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'vtuan', full_name: 'V. Tuấn', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'mhieu', full_name: 'M. Hiếu', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'nhuyen', full_name: 'N. Huyền', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'tphat', full_name: 'T. Phát', shift_type: 'overtime', base_salary: 4500000, hourly_rate: 30000 },
  { username: 'ghan', full_name: 'G. Hân', shift_type: 'basic', base_salary: 4800000, hourly_rate: 25000 },
  { username: 'nbinh', full_name: 'N. Bình', shift_type: 'overtime', base_salary: 4500000, hourly_rate: 30000 },
];

// Other employees
const other = [
  { username: 'ttu', full_name: 'T. Tư', shift_type: 'notice_only', base_salary: 0, hourly_rate: 35000 },
  { username: 'qlam', full_name: 'Q. Lâm', shift_type: 'notice_only', base_salary: 0, hourly_rate: 35000 },
];

async function createEmployee(emp, department) {
  console.log(`👤 Creating ${emp.username} (${emp.full_name}) - ${department}...`);
  
  // Check if user already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('username', emp.username)
    .single();
  
  if (existing) {
    console.log(`   ⚠️  User already exists, updating profile...`);
    
    // Update existing profile
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: emp.full_name,
        shift_type: emp.shift_type,
        base_salary: emp.base_salary,
        hourly_rate: emp.hourly_rate,
        default_clock_in: '17:00',
        default_clock_out: '22:00',
        must_change_password: false,
      })
      .eq('user_id', existing.user_id);
    
    if (error) {
      console.log(`   ❌ Failed to update: ${error.message}`);
    } else {
      console.log(`   ✓ Updated successfully`);
    }
    return;
  }
  
  // For new users, we need to create via auth
  // Since we don't have service role key, we'll just update the profile
  console.log(`   ⚠️  Cannot create auth user without service role key`);
  console.log(`   ℹ️  Please create user manually in Supabase Dashboard:`);
  console.log(`   Email: ${emp.username}@lunarflow.local`);
  console.log(`   Password: ${PASSWORD}`);
}

async function main() {
  console.log('🌱 Creating test employee accounts...\n');
  
  console.log('=== KITCHEN DEPARTMENT ===');
  for (const emp of kitchen) {
    await createEmployee(emp, 'Kitchen');
  }
  
  console.log('\n=== SERVICE DEPARTMENT ===');
  for (const emp of service) {
    await createEmployee(emp, 'Service');
  }
  
  console.log('\n=== OTHER DEPARTMENT ===');
  for (const emp of other) {
    await createEmployee(emp, 'Other');
  }
  
  console.log('\n✅ Done!');
  console.log(`\n📱 All accounts use password: ${PASSWORD}`);
  console.log('🌐 Login at: http://localhost:5199/login');
}

main().catch(console.error);