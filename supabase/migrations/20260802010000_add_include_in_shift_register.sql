-- Per-employee setting: whether the employee appears in the shift
-- registration table (AdminShiftRegister roster + related views).
alter table public.profiles
  add column if not exists include_in_shift_register boolean not null default true;