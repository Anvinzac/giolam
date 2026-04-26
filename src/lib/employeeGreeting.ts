/**
 * Build a personalised title like "Chấm công chị Thu" or "Chấm công bạn Phát".
 *
 * Rules:
 * - If full_name starts with a Vietnamese honorific (Chị, Anh, Cô, …),
 *   use the whole name: "Chấm công chị Thu"
 * - Otherwise take the last word (given name) and prefix with "bạn":
 *   "Chấm công bạn Phát"
 */
export function buildEmployeeTitle(fullName: string, prefix = 'Chấm công'): string {
  const name = fullName.trim();
  if (!name) return prefix;

  // Honorifics we recognise (case-insensitive first word).
  // "chi" (without diacritics) is normalised to "chị".
  const honorificMap: Record<string, string> = {
    'chị': 'chị', 'chi': 'chị',
    'anh': 'anh',
    'cô': 'cô', 'co': 'cô',
    'chú': 'chú', 'chu': 'chú',
    'bác': 'bác', 'bac': 'bác',
    'em': 'em',
  };
  const firstWord = name.split(/\s+/)[0].toLowerCase();
  const mapped = honorificMap[firstWord];

  if (mapped) {
    const rest = name.slice(firstWord.length).trim();
    return `${prefix} ${mapped} ${rest}`;
  }

  // No honorific → use last word (given name) with "bạn"
  const parts = name.split(/[\s.]+/).filter(Boolean);
  const givenName = parts[parts.length - 1];
  return `${prefix} bạn ${givenName}`;
}
