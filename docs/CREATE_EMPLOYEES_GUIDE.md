# Create Test Employee Accounts

## Quick Setup via Supabase Dashboard

### Step 1: Go to Authentication > Users

1. Open your Supabase project dashboard
2. Navigate to **Authentication** > **Users**
3. Click **"Add user"** button

### Step 2: Create Each User

For each employee below, create a user with:
- **Email:** `[username]@lunarflow.local` (e.g., `chithoa@lunarflow.local`)
- **Password:** `l@123456`
- **Auto Confirm Email:** ✅ Checked

### Step 3: Update Profile

After creating each user, go to **Table Editor** > **profiles** and update:
- `username` (e.g., `chithoa`)
- `full_name` (e.g., `Chị Thoa`)
- `shift_type` (`basic`, `overtime`, or `notice_only`)
- `base_salary` (in VND, e.g., `5000000`)
- `hourly_rate` (in VND, e.g., `25000`)
- `default_clock_in` (e.g., `17:00`)
- `default_clock_out` (e.g., `22:00`)
- `must_change_password` = `false`

---

## Kitchen Department (12 employees)

| Username | Full Name | Shift Type | Base Salary | Hourly Rate |
|----------|-----------|------------|-------------|-------------|
| chithoa | Chị Thoa | basic | 5,000,000 | 25,000 |
| chithu | Chị Thu | basic | 4,800,000 | 25,000 |
| chioanh | Chị Oanh | basic | 4,800,000 | 25,000 |
| chinuong | Chị Nương | overtime | 4,500,000 | 30,000 |
| chixuan | Chị Xuân | basic | 4,800,000 | 25,000 |
| coha | Cô Hà | basic | 5,000,000 | 25,000 |
| anhcuong | Anh Cường | overtime | 4,500,000 | 30,000 |
| chichi | Chị Chi | overtime | 4,500,000 | 30,000 |
| tphi | T. Phi | basic | 4,800,000 | 25,000 |
| ntruong | N. Trường | basic | 4,800,000 | 25,000 |
| chinu | Chị Nụ | basic | 4,800,000 | 25,000 |
| chilinh | Chị Linh | basic | 4,800,000 | 25,000 |

---

## Service Department (8 employees)

| Username | Full Name | Shift Type | Base Salary | Hourly Rate |
|----------|-----------|------------|-------------|-------------|
| ptuan | P. Tuấn | overtime | 4,500,000 | 30,000 |
| hthao | H. Thảo | basic | 4,800,000 | 25,000 |
| vtuan | V. Tuấn | basic | 4,800,000 | 25,000 |
| mhieu | M. Hiếu | basic | 4,800,000 | 25,000 |
| nhuyen | N. Huyền | basic | 4,800,000 | 25,000 |
| tphat | T. Phát | overtime | 4,500,000 | 30,000 |
| ghan | G. Hân | basic | 4,800,000 | 25,000 |
| nbinh | N. Bình | overtime | 4,500,000 | 30,000 |

---

## Other Department (2 employees)

| Username | Full Name | Shift Type | Base Salary | Hourly Rate |
|----------|-----------|------------|-------------|-------------|
| ttu | T. Tư | notice_only | 0 | 35,000 |
| qlam | Q. Lâm | notice_only | 0 | 35,000 |

---

## All Accounts Use

- **Password:** `l@123456`
- **Default Clock In:** `17:00`
- **Default Clock Out:** `22:00`

---

## Quick Seed via Edge Function (Recommended)

The easiest way to create all test employees is to invoke the seed function:

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Find `seed-employees` function
4. Click **Invoke** or use the following command:

```bash
curl -X POST 'https://[your-project-ref].supabase.co/functions/v1/seed-employees' \
  -H "Authorization: Bearer [your-anon-key]" \
  -H "Content-Type: application/json"
```

This will create all 22 employees with the correct departments, salaries, and password `l@123456`.

---

## Bulk Creation via SQL (Advanced)

If you have access to the SQL Editor, you can run:

```sql
-- First, create auth users (requires service role)
-- Then run this to update profiles:

UPDATE profiles SET
  full_name = 'Chị Thoa',
  shift_type = 'basic',
  base_salary = 5000000,
  hourly_rate = 25000,
  default_clock_in = '17:00',
  default_clock_out = '22:00',
  must_change_password = false
WHERE username = 'chithoa';

-- Repeat for each employee...
```

---

## Testing the UI

After creating accounts:

1. Login as admin at http://localhost:5199/login
2. Go to **Salary Admin**
3. You should see three department tabs:
   - **Bếp (12)** - Kitchen employees
   - **Phục vụ (8)** - Service employees
   - **Khác (2)** - Other employees

4. Click on tabs to switch between departments
5. Click on any employee to view/edit their salary

---

## Cleanup

To remove test accounts:

1. Go to **Authentication** > **Users**
2. Select all test users
3. Click **Delete**
4. Related data (profiles, shifts, salary) auto-deletes via CASCADE