/**
 * Default account-password shape (from the existing per-employee map):
 *
 *   8 chars = random interleave of
 *     • a prefix of "abcdef"   (length k ∈ 1..6)
 *     • a prefix of "1234567"  (length 8 − k)
 *
 *   preserving relative order inside each prefix, and always starting
 *   with "a" (so the first placed letter leads).
 *
 * Examples: ab123456, abcd1234, a1b2c3d4, ab12cd34, abcde12f
 *
 * Loose regex (charset + length only):
 *   /^[a-f][a-f1-7]{7}$/
 *
 * Structural check (preferred): see `isDefaultPasswordShape`.
 */

const LETTERS = 'abcdef';
const DIGITS = '1234567';

export function generateDefaultPassword(): string {
  const letterCount = 1 + Math.floor(Math.random() * 6); // 1..6
  const digitCount = 8 - letterCount; // 2..7
  const letters = LETTERS.slice(0, letterCount).split('');
  const digits = DIGITS.slice(0, digitCount).split('');

  // Always lead with 'a'
  const out: string[] = [letters.shift()!];

  let li = 0;
  let di = 0;
  while (li < letters.length || di < digits.length) {
    const canL = li < letters.length;
    const canD = di < digits.length;
    if (canL && canD) {
      if (Math.random() < 0.5) out.push(letters[li++]);
      else out.push(digits[di++]);
    } else if (canL) {
      out.push(letters[li++]);
    } else {
      out.push(digits[di++]);
    }
  }
  return out.join('');
}

/** True when `pw` matches the interleave-of-prefixes rule above. */
export function isDefaultPasswordShape(pw: string): boolean {
  if (!/^[a-f][a-f1-7]{7}$/.test(pw)) return false;
  const letterPart = pw.replace(/[^a-f]/g, '');
  const digitPart = pw.replace(/[^1-7]/g, '');
  if (letterPart.length + digitPart.length !== 8) return false;
  if (letterPart.length < 1 || digitPart.length < 1) return false;
  return (
    LETTERS.startsWith(letterPart) &&
    DIGITS.startsWith(digitPart)
  );
}
