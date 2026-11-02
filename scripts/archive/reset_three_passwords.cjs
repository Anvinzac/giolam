// Reset passwords for hkhang, minhvu (mvu), hngan using the default-password rule.
// Run: SUPABASE_SERVICE_ROLE_KEY=... node reset_three_passwords.cjs

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rrjmkqpexcjsqkxenpet.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, KEY);

const LETTERS = 'abcdef';
const DIGITS = '1234567';

function generateDefaultPassword() {
  const letterCount = 1 + Math.floor(Math.random() * 6);
  const digitCount = 8 - letterCount;
  const letters = LETTERS.slice(0, letterCount).split('');
  const digits = DIGITS.slice(0, digitCount).split('');
  const out = [letters.shift()];
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

const USED = new Set([
  'ab123456', 'abcd1234', 'abcde123', 'a1234567', 'abc12345',
  'ab1234cd', 'abcdef12', 'a12345bc', 'ab12cd34', 'abc1de23',
  'abcd12ef', 'a1b2c3d4', 'ab12345c', 'abc123de', 'abcde1f2',
  'a12bc345', 'ab1c2d34', 'abcd1e2f', 'a1bcde23', 'ab123cd4',
  'abc12de3', 'a1b23c45',
]);

function uniquePassword() {
  for (let i = 0; i < 50; i++) {
    const pw = generateDefaultPassword();
    if (!USED.has(pw)) {
      USED.add(pw);
      return pw;
    }
  }
  throw new Error('Could not generate a unique password');
}

const TARGETS = [
  { username: 'hkhang' },
  { username: 'minhvu', requestedAs: 'mvu' },
  { username: 'hngan' },
];

async function run() {
  for (const t of TARGETS) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id, username, full_name')
      .ilike('username', t.username)
      .maybeSingle();

    if (error || !profile) {
      console.log(`FAIL ${t.username}: not found`);
      continue;
    }

    const password = uniquePassword();
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password }
    );

    if (updateError) {
      console.log(`FAIL ${profile.username}: ${updateError.message}`);
      continue;
    }

    await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('user_id', profile.user_id);

    const alias = t.requestedAs ? ` (requested as ${t.requestedAs})` : '';
    console.log(`OK ${profile.username}${alias} (${profile.full_name}): ${password}`);
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
