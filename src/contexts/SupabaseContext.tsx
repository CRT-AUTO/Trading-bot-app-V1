import React, { createContext, useContext } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client with runtime values
// This ensures the actual values aren't bundled in the client code
// and instead are loaded dynamically at runtime
const getSupabaseConfig = () => {
  // For local development, Vite will inject these from .env
  // For production, they will be injected by Netlify environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                      // Fallback to the placeholder that will be replaced at runtime
                      window.__SUPABASE_URL__ || 
                      '';
                      
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                          // Fallback to the placeholder that will be replaced at runtime
                          window.__SUPABASE_ANON_KEY__ || 
                          '';

  return { supabaseUrl, supabaseAnonKey };
};

// Get the config at runtime
const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create context
type SupabaseContextType = {
  supabase: SupabaseClient;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

// Provider component
export const SupabaseProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
};

// Hook for using Supabase
export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
