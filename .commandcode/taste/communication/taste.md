# communication
- Prefer direct action over excessive clarification questions. Confidence: 0.70
- Be honest about limitations rather than guessing at solutions. Confidence: 0.75
- Make only the specific changes requested — do not over-engineer, rewrite unrelated code, or add unrequested features. When corrected, revert to original behavior and apply only the minimal change needed. Confidence: 0.95
- Before proposing a new layout, proactively search the codebase for existing implementations of the same pattern and follow them. The user expects the assistant to find and reference prior art rather than inventing from scratch. Confidence: 0.70
- Do not deflect blame to external factors (e.g., RLS, database defaults, library limitations) when a fix is requested — just fix it without excuses. Confidence: 0.75
- Fix root causes directly rather than building workaround ecosystems. When a bug exists (e.g., a one-day date offset), fix the actual date handling — do not create compensating utility functions, shifted lookup logic, or seed scripts that encode the offset. The user will reject workaround layers and demand they be removed entirely. Confidence: 0.85
- When the user reports that a claimed fix is not working, trust their report and re-examine the code thoroughly rather than suggesting browser cache or hard-refresh as a first response. The user expects fixes to address the full scope of the issue before being declared done. Confidence: 0.65
- Proactively think through the full UX flow when making changes — anticipate what the user sees when navigating between views or switching modes, and handle empty/invalid states up front. The user should not need to point out obvious UX gaps (like an empty table on tab switch) after a change is made. Confidence: 0.75
