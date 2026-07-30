import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    console.info('[WA-CRM] Inicializando instancia única (Singleton) de Supabase Client para Content Script.');
    supabaseInstance = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseInstance;
}
