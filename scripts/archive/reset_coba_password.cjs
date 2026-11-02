// Reset the password for the `coba` account using the default-password rule.
// Run: SUPABASE_SERVICE_ROLE_KEY=... node reset_coba_password.cjs

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

const USERNAME = 'coba';

async function run() {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_id, username, full_name')
    .ilike('username', USERNAME)
    .maybeSingle();

  if (error || !profile) {
    console.log(`FAIL ${USERNAME}: not found`);
    process.exit(1);
  }

  const password = generateDefaultPassword();
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    profile.user_id,
    { password }
  );

  if (updateError) {
    console.log(`FAIL ${profile.username}: ${updateError.message}`);
    process.exit(1);
  }

  // Let the reset password stick; no forced change on next login.
  await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('user_id', profile.user_id);

  console.log(`OK ${profile.username} (${profile.full_name}): ${password}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
