// Netlify Function for generating webhook URLs
import { createClient } from 'npm:@supabase/supabase-js';
import { nanoid } from 'npm:nanoid@3.3.4';

export default async (req, context) => {
  // Set CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  // Get environment variables - support both Node.js and Deno environments
  const supabaseUrl = process.env.SUPABASE_URL || Deno.env?.get?.("SUPABASE_URL");
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || Deno.env?.get?.("SUPABASE_SERVICE_KEY");

  // Check if environment variables are set
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse request body
    const { userId, botId, expirationDays = 30 } = await req.json();
    
    // Validate required fields
    if (!userId || !botId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // Generate unique webhook token
    const webhookToken = nanoid(32);
    
    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expirationDays);
    
    // Store webhook information in database
    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        user_id: userId,
        bot_id: botId,
        webhook_token: webhookToken,
        expires_at: expirationDate.toISOString(),
        created_at: new Date().toISOString()
      });
    
    if (error) throw error;
    
    // Construct webhook URL - support both Node.js and Deno environments
    const baseUrl = process.env.URL || Deno.env?.get?.("URL") || req.headers.get("host");
    const webhookUrl = `${baseUrl}/.netlify/functions/processAlert/${webhookToken}`;
    
    return new Response(JSON.stringify({
      webhookUrl,
      expiresAt: expirationDate.toISOString()
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error('Error generating webhook:', error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
};
