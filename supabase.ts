import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ewfnxfylqdovmjjdishu.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Zm54ZnlscWRvdm1qamRpc2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NTczODQsImV4cCI6MjEwNTAzMzM4NH0.LwM-gidROWGmvAVzyfkY9lumGEBjzbFYknn6v36EDvA';

// Clean URL: strip any trailing /rest/v1 or trailing slashes
function sanitizeSupabaseUrl(url: string | undefined): string {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export const supabaseUrl: string = sanitizeSupabaseUrl(rawUrl);
export const supabaseAnonKey: string = typeof rawKey === 'string' ? rawKey.trim() : '';

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder')
);

/**
 * Explicit assertion helper.
 * Throws a loud, descriptive error if called when credentials are not configured.
 */
export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    const errorMsg =
      '[Supabase Error] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured.\n' +
      'Please add them to your Netlify Environment Variables or local .env file.\n' +
      `Current VITE_SUPABASE_URL: ${supabaseUrl ? `"${supabaseUrl.slice(0, 15)}..."` : 'undefined'}\n` +
      `Current VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Present' : 'undefined'}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

// Log a prominent warning in dev console if missing
if (!isSupabaseConfigured) {
  console.warn(
    '%c[Supabase Warning] Database environment variables missing!',
    'background: #fee2e2; color: #991b1b; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
    '\nVITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set in import.meta.env.\n' +
    'The app will display an unconfigured database notice instead of silently failing.'
  );
}

/**
 * Underlying client or guarded proxy.
 * If configured, returns standard SupabaseClient.
 * If NOT configured, wraps the client in a Proxy that throws on any API invocation.
 */
const realClient: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!isSupabaseConfigured || !realClient) {
      assertSupabaseConfigured();
    }
    const val = (realClient as any)[prop];
    return typeof val === 'function' ? val.bind(realClient) : val;
  },
});

export default supabase;
