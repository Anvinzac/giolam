UPDATE public.profiles
SET department_id = NULL
WHERE username ILIKE 'cloan' OR username ILIKE 'chiloan';
