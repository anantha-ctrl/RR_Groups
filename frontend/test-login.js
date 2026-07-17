import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://smljzqewjquzslptixye.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtbGp6cWV3anF1enNscHRpeHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDg2MTMsImV4cCI6MjA5NzY4NDYxM30.v85aJIVYaMcTTOyKKBjs0mZ-U4Q_WzapsZFm0Tw1-xE'
);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'owner@fincollect.in',
    password: 'owner123'
  });
  if (error) {
    console.error('Login failed:', error.message);
    process.exit(1);
  }
  console.log('Login success for user:', data.user?.email);
  console.log('User ID:', data.user?.id);
  console.log('User metadata:', data.user?.user_metadata);
  
  // Check profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  console.log('Profile:', JSON.stringify(profile, null, 2));
  
  await supabase.auth.signOut();
  console.log('Done');
}

test().catch(console.error);
