import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Clean up URL: remove trailing /rest/v1/ if present
const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

let client: any = null;

if (cleanUrl && supabaseAnonKey) {
  try {
    client = createClient(cleanUrl, supabaseAnonKey, {
      global: {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    });
  } catch (e) {
    console.error("Failed to initialize Supabase client:", e);
  }
}

export const supabase = client;
