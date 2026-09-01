# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# workflow
See [workflow/taste.md](workflow/taste.md)
# communication
See [communication/taste.md](communication/taste.md)
# timezone
- Handle dates in Vietnamese local time (UTC+7), not UTC. Avoid timezone workarounds like appending 'Z' to date strings. Confidence: 0.90

# ui
See [ui/taste.md](ui/taste.md)
# data-modeling
- Store shift type (morning/afternoon/evening) as an explicit field on the shift record rather than inferring it from clock_in time. The shift type is an independent data field — do not derive it from clock_in defaults, employee profiles, or time-based heuristics. Confidence: 0.85
- Decouple features that serve different business purposes. Do not hard-gate one feature's queries on the existence of data from an unrelated domain (e.g., shift registration should work even when salary working_periods is empty). Foreign keys that are conceptually optional should be treated as optional query filters — apply the filter when the FK is present, skip it when absent — rather than blocking the entire query. The user will push back on coupling that causes one feature to break because of another feature's data state. Confidence: 0.85
- For Type B (overtime) seeded days, store clock_out as a non-null sentinel equal to clock_in (total_hours: 0) rather than null; the display layer renders the sentinel as '-' while keeping the cell fully tappable to edit. Confidence: 0.90

# ui-performance
- For instant tap responsiveness, pre-render UI elements (e.g., chips, checkmarks) and toggle visibility via state rather than mounting/unmounting them on interaction. Do not make pre-rendered elements fully transparent or invisible — they should remain visible to the user. Confidence: 0.70

# supabase
- Avoid Supabase JS join syntax (e.g., `profiles!inner(full_name)`) for fetching related table data. Instead, use two separate queries: fetch main table first, collect foreign keys, then batch-fetch the related table with `.in()`. This is more reliable and avoids silent failures. Confidence: 0.75
- After pushing DB migrations or making schema changes, regenerate TypeScript types with `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`. Confidence: 0.80

# auth
- Allow login with short username (e.g., "nvienc") without requiring full email domain suffix. Confidence: 0.70
