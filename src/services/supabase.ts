import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Clean up URL: remove trailing /rest/v1/ if present
const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

export const supabase = createClient(cleanUrl, supabaseAnonKey);
