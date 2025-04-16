/// <reference types="vite/client" />

// Add global declarations for our runtime placeholders
interface Window {
  __SUPABASE_URL__?: string;
  __SUPABASE_ANON_KEY__?: string;
}
