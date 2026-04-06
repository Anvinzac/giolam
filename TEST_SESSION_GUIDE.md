# Test Session Guide

This guide helps you create test employee accounts to preview how employees will use the app on their phones.

## Quick Start

### 1. Access the App

- **Local (your computer):** http://localhost:5199/
- **Mobile (same WiFi):** http://192.168.1.3:5199/

### 2. Create Test Accounts

You need to be logged in as an admin to create employee accounts.

#### Option A: Use the Admin Dashboard

1. Login as admin at http://localhost:5199/login
2. Go to Admin Dashboard
3. Click "Manage Employees" or similar option
4. Create new employees with these details:

**Test Employee A (Type A - Basic - Kitchen)**
- Username: `nhanvien_a`
- Full Name: `Nguyễn Văn A`
- Password: `test123`
- Shift Type: `basic`
- Department: `Kitchen` or `Bếp`
- Base Salary: `5,000,000`
- Hourly Rate: `25,000`
- Default Clock In: `17:00`
- Default Clock Out: `22:00`

**Test Employee B (Type B - Overtime - Kitchen)**
- Username: `nhanvien_b`
- Full Name: `Trần Thị B`
- Password: `test123`
- Shift Type: `overtime`
- Department: `Kitchen` or `Bếp`
- Base Salary: `4,500,000`
- Hourly Rate: `30,000`
- Default Clock In: `17:00`
- Default Clock Out: `22:00`

**Test Employee C (Type C - Notice Only - Service)**
- Username: `nhanvien_c`
- Full Name: `Lê Văn C`
- Password: `test123`
- Shift Type: `notice_only`
- Department: `Service` or `Phục vụ`
- Base Salary: `0`
- Hourly Rate: `35,000`
- Default Clock In: `08:00`
- Default Clock Out: `17:30`

**Test Employee D (Type A - Basic - Service)**
- Username: `nhanvien_d`
- Full Name: `Phạm Thị D`
- Password: `test123`
- Shift Type: `basic`
- Department: `Service` or `Reception`
- Base Salary: `4,800,000`
- Hourly Rate: `25,000`
- Default Clock In: `17:00`
- Default Clock Out: `22:00`

**Test Employee E (Type B - Overtime - Other)**
- Username: `nhanvien_e`
- Full Name: `Hoàng Văn E`
- Password: `test123`
- Shift Type: `overtime`
- Department: `Other` or leave blank
- Base Salary: `4,200,000`
- Hourly Rate: `28,000`
- Default Clock In: `17:00`
- Default Clock Out: `22:00`

#### Option B: Use Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication > Users**
3. Click "Add user" and create users with:
   - Email: `nhanvien_a@lunarflow.local` (or similar)
   - Password: `test123`
   - Auto Confirm Email: Yes

4. Then go to **Table Editor > profiles** and update the user profiles with:
   - `username`, `full_name`, `shift_type`, `base_salary`, `hourly_rate`, etc.

5. Make sure `must_change_password` is set to `false` for testing

### 3. Create a Working Period

Employees need an active working period to register shifts and view salary.

1. Login as admin
2. Go to Admin Dashboard
3. Create a working period for the current month:
   - Start Date: First day of current month
   - End Date: Last day of current month
   - Off Days: (optional) Add any holidays

### 4. Test Employee Login

1. Open the app on your phone: http://192.168.1.3:5199/login
2. Login with test credentials:
   - Username: `nhanvien_a`
   - Password: `test123`

3. You should see:
   - Week view for shift registration
   - Ability to clock in/out
   - "Bảng lương tháng này" button to view salary

### 5. Add Salary Data (Admin)

To test the salary view:

1. Login as admin
2. Go to Salary Admin
3. Select an employee
4. Either:
   - Manually add salary entries
   - Use "Nhập từ CSV" to import test data
5. Click "Publish" to make it visible to the employee

### 6. View Salary (Employee)

1. Login as the test employee
2. Click "Bảng lương tháng này"
3. View the salary breakdown

## Cleanup

To remove test accounts:

### Via Supabase Dashboard

1. Go to **Authentication > Users**
2. Find and delete test users (nhanvien_a, nhanvien_b, nhanvien_c)
3. The related data (profiles, shifts, salary) will be automatically deleted due to CASCADE rules

### Via SQL (Advanced)

Run this in Supabase SQL Editor:

```sql
-- Get test user IDs
SELECT user_id, username FROM profiles 
WHERE username IN ('nhanvien_a', 'nhanvien_b', 'nhanvien_c');

-- Delete from auth.users (replace with actual UUIDs)
DELETE FROM auth.users 
WHERE id IN ('uuid1', 'uuid2', 'uuid3');
```

## Tips

- **Same WiFi Required:** Your phone must be on the same WiFi network as your computer
- **Firewall:** Make sure your firewall allows connections on port 5199
- **HTTPS:** For production, use HTTPS. The dev server uses HTTP which is fine for local testing
- **Mobile Testing:** Use Chrome DevTools device emulation if you don't have a physical phone
- **Data Persistence:** Test data persists in Supabase until you delete it

## Troubleshooting

**Can't access from phone:**
- Check both devices are on same WiFi
- Try `http://192.168.1.3:5199` (replace with your computer's IP)
- Check firewall settings

**Login fails:**
- Verify user exists in Supabase Authentication
- Check `must_change_password` is `false` in profiles table
- Verify username matches exactly (case-sensitive)

**No salary data:**
- Create a working period first
- Add salary entries as admin
- Publish the salary record

**Blank page:**
- Check browser console for errors
- Verify Supabase credentials in `.env`
- Check dev server is running
