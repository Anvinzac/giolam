# Quick Test Reference

## 🌐 URLs

- **Desktop:** http://localhost:5199/
- **Mobile:** http://192.168.1.3:5199/

## 👤 Test Accounts

| Username | Password | Type | Description |
|----------|----------|------|-------------|
| `nhanvien_a` | `test123` | Type A | Basic salary + allowances |
| `nhanvien_b` | `test123` | Type B | Base + overtime hours |
| `nhanvien_c` | `test123` | Type C | Hourly rate only |

## 🚀 Quick Setup

1. **Start dev server** (if not running):
   ```bash
   npm run dev
   ```

2. **Create test accounts** via Supabase Dashboard:
   - Go to Authentication > Users > Add user
   - Email: `nhanvien_a@lunarflow.local`
   - Password: `test123`
   - Auto confirm: Yes
   
3. **Update profile** in Table Editor > profiles:
   - Set `username`, `shift_type`, `base_salary`, etc.
   - Set `must_change_password` to `false`

4. **Create working period** (as admin):
   - Start: First day of month
   - End: Last day of month

5. **Test on phone**:
   - Connect to same WiFi
   - Open http://192.168.1.3:5199/login
   - Login with test credentials

## 🧹 Cleanup

Delete users from Supabase Dashboard > Authentication > Users

All related data (profiles, shifts, salary) auto-deletes via CASCADE.

## 📱 Mobile Testing Checklist

- [ ] Login works
- [ ] Week view displays
- [ ] Can register shifts
- [ ] Clock in/out works
- [ ] Salary button visible
- [ ] Salary breakdown displays
- [ ] UI is mobile-friendly
- [ ] Touch interactions work
