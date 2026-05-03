-- Allow custom allowance keys (e.g. 'custom_<timestamp>') beyond the original
-- whitelist of 'chuyen_can'/'nang_luc'/'gui_xe'. The CHECK constraint was
-- silently rejecting inserts from the "Thêm phụ cấp" UI, so newly added
-- allowance rows never saved, never displayed, and never contributed to the
-- total salary.

ALTER TABLE public.employee_allowances
  DROP CONSTRAINT IF EXISTS employee_allowances_allowance_key_check;
