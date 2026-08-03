# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# workflow
See [workflow/taste.md](workflow/taste.md)
# communication
- Prefer direct action over excessive clarification questions. Confidence: 0.70
- Be honest about limitations rather than guessing at solutions. Confidence: 0.75
- Make only the specific changes requested — do not over-engineer, rewrite unrelated code, or add unrequested features. When corrected, revert to original behavior and apply only the minimal change needed. Confidence: 0.95
- Do not deflect blame to external factors (e.g., RLS, database defaults, library limitations) when a fix is requested — just fix it without excuses. Confidence: 0.75
- Fix root causes directly rather than building workaround ecosystems. When a bug exists (e.g., a one-day date offset), fix the actual date handling — do not create compensating utility functions, shifted lookup logic, or seed scripts that encode the offset. The user will reject workaround layers and demand they be removed entirely. Confidence: 0.85

# timezone
- Handle dates in Vietnamese local time (UTC+7), not UTC. Avoid timezone workarounds like appending 'Z' to date strings. Confidence: 0.90

# ui
See [ui/taste.md](ui/taste.md)
# data-modeling
- Store shift type (morning/afternoon/evening) as an explicit field on the shift record rather than inferring it from clock_in time. The shift type is an independent data field — do not derive it from clock_in defaults, employee profiles, or time-based heuristics. Confidence: 0.85

# ui-performance
- For instant tap responsiveness, pre-render UI elements (e.g., chips, checkmarks) and toggle visibility via state rather than mounting/unmounting them on interaction. Do not make pre-rendered elements fully transparent or invisible — they should remain visible to the user. Confidence: 0.70

# supabase
- Avoid Supabase JS join syntax (e.g., `profiles!inner(full_name)`) for fetching related table data. Instead, use two separate queries: fetch main table first, collect foreign keys, then batch-fetch the related table with `.in()`. This is more reliable and avoids silent failures. Confidence: 0.75
- After pushing DB migrations or making schema changes, regenerate TypeScript types with `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`. Confidence: 0.80

# auth
- Allow login with short username (e.g., "nvienc") without requiring full email domain suffix. Confidence: 0.70
