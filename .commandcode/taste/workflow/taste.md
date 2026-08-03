# workflow
- After completing a batch of changes, offer to commit and push. Confidence: 0.85
- When the user issues a terse workflow command like "commit push", handle the full git workflow in one shot — status check, selective staging of all changed files, writing a descriptive conventional-commit message, and pushing — without asking for confirmation at each step. Confidence: 0.70
- Run TypeScript type-check (`npx tsc --noEmit`) before committing code changes. Confidence: 0.70
- Use conventional commit prefixes (`fix:`, `feat:`, etc.) with descriptive, lowercase summaries. Confidence: 0.70
- Include `Co-authored-by: CommandCodeBot <noreply@commandcode.ai>` as a trailer in every commit message. Confidence: 0.70
- When running the app locally, provide the LAN address for mobile testing. Confidence: 0.85
