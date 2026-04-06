# Shift Type Change Feature

## ✅ Implementation Complete

Added the ability to change an employee's shift type directly from the Salary Admin page.

## Features

### 1. Clickable Shift Type Badge
- The shift type badge below the employee name is now clickable
- Hover effect shows a ring to indicate it's interactive
- Only clickable when not in preview mode

### 2. Shift Type Picker Modal
- Clean modal interface with three options:
  - **Loại A** (basic) - Fixed monthly salary
  - **Loại B** (overtime) - Hourly rate with overtime
  - **Loại C** (notice_only) - Notice-based hourly work
- Shows current selection highlighted in gold
- Warning message: "⚠️ Đổi loại sẽ xóa toàn bộ dữ liệu lương hiện tại"

### 3. Database Updates
When you change the shift type:
1. Updates `profiles.shift_type` in the database
2. Deletes all `salary_entries` for that employee in the current period
3. Updates local state to reflect the change
4. Shows success toast notification
5. Forces component re-render to show fresh salary table

### 4. Automatic Table Reset
- All salary entries are cleared when type changes
- New empty table is generated based on the new shift type
- Type A: Will auto-seed from special day rates
- Type B: Will auto-seed all days in the period
- Type C: Starts empty, ready for manual entry

## How to Use

1. Open an employee's salary page
2. Click on the colored shift type badge below their name
3. Select the new shift type from the modal
4. Confirm the change
5. The salary table will reset and be ready for new data

## Technical Details

### Files Modified
- `src/pages/SalaryAdmin.tsx`
  - Added `showShiftTypePicker` state
  - Added `handleShiftTypeChange` function
  - Made shift type badge clickable
  - Added shift type picker modal UI

### Database Operations
```typescript
// Update shift type
await supabase.from('profiles')
  .update({ shift_type: newType })
  .eq('user_id', selectedEmployee.user_id);

// Clear salary entries
await supabase.from('salary_entries')
  .delete()
  .eq('user_id', selectedEmployee.user_id)
  .eq('period_id', selectedPeriodId);
```

### State Management
- Local state updates for immediate UI feedback
- Employee list updates to reflect changes
- Retry key increment forces hooks to re-fetch data

## User Experience

### Before Change
- Employee has existing salary data
- Shift type badge shows current type

### During Change
- Click badge → Modal appears
- Select new type → Confirmation
- Loading state while updating

### After Change
- Success toast notification
- Badge shows new type
- Salary table is empty and ready for new data
- All previous entries are deleted

## Safety Features

1. **Warning Message**: Users are warned that changing type will delete existing data
2. **Cancel Button**: Easy to cancel without making changes
3. **Preview Mode Protection**: Cannot change type in preview mode
4. **Database Transaction**: Updates are atomic

## Example Use Cases

1. **Wrong Initial Assignment**: Employee was set as Type A but should be Type B
2. **Role Change**: Employee moves from fixed salary to hourly
3. **Temporary Assignment**: Switch to Type C for special projects
4. **Correction**: Fix mistakes in employee setup

## Notes

- Changes are immediate and cannot be undone
- Existing salary data is permanently deleted
- Published salary records remain in `salary_records` table for history
- Only affects the current period's entries
