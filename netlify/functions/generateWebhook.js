// Netlify Function for generating webhook URLs
import { createClient } from 'npm:@supabase/supabase-js';
import { nanoid } from 'npm:nanoid@3.3.4';

export default async (req, context) => {
  console.log("generateWebhook function started");
  
  // Set CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling preflight request");
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    console.log(`Invalid request method: ${req.method}`);
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
  
  console.log(`Environment check: Supabase URL exists: ${!!supabaseUrl}, Service Key exists: ${!!supabaseServiceKey}`);

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
  console.log("Supabase client initialized");

  try {
    // Parse request body
    const body = await req.json();
    const { userId, botId, expirationDays = 30 } = body;
    
    console.log(`Request received - userId: ${userId}, botId: ${botId}, expirationDays: ${expirationDays}`);
    
    // Validate required fields
    if (!userId || !botId) {
      console.log("Missing required fields");
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
    console.log(`Generated webhook token: ${webhookToken.substring(0, 5)}...`);
    
    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expirationDays);
    console.log(`Expiration date set to: ${expirationDate.toISOString()}`);
    
    // Store webhook information in database
    console.log("Inserting webhook into database...");
    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        user_id: userId,
        bot_id: botId,
        webhook_token: webhookToken,
        expires_at: expirationDate.toISOString(),
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error("Database insertion error:", error);
      throw error;
    }
    
    console.log("Webhook successfully stored in database");
    
    // Construct webhook URL - support both Node.js and Deno environments
    const baseUrl = process.env.URL || Deno.env?.get?.("URL") || req.headers.get("host");
    console.log(`Using base URL: ${baseUrl}`);
    
    const webhookUrl = `${baseUrl}/.netlify/functions/processAlert/${webhookToken}`;
    console.log(`Generated webhook URL: ${webhookUrl}`);
    
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
