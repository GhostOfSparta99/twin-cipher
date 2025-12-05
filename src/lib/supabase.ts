import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type StegoImage = {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  storage_path: string;
  file_size: number;
  real_salt: string;
  real_iv: string;
  duress_salt: string;
  duress_iv: string;
  allowed_emails: string[]; // New field for access control
  created_at: string;
  updated_at: string;
};
