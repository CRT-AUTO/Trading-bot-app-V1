// Netlify Function for processing TradingView alerts
import { createClient } from 'npm:@supabase/supabase-js';
import { executeBybitOrder } from '../utils/bybit.js';

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

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_KEY")
  );

  try {
    // Get webhook token from URL path
    const webhookToken = req.url.split('/').pop();
    
    // Verify webhook token exists and is not expired
    const { data: webhook, error: webhookError } = await supabase
      .from('webhooks')
      .select('*, bots(*)')
      .eq('webhook_token', webhookToken)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (webhookError || !webhook) {
      return new Response(JSON.stringify({ error: 'Invalid or expired webhook' }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // Parse TradingView alert data
    const alertData = await req.json();
    
    // Get bot configuration
    const bot = webhook.bots;
    
    // Get API credentials for the user
    const { data: apiKey, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', webhook.user_id)
      .eq('exchange', 'bybit')
      .single();
    
    if (apiKeyError || !apiKey) {
      return new Response(JSON.stringify({ error: 'API credentials not found' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    
    // Prepare order parameters
    const orderParams = {
      apiKey: apiKey.api_key,
      apiSecret: apiKey.api_secret,
      symbol: alertData.symbol || bot.symbol,
      side: alertData.side || bot.default_side,
      orderType: alertData.orderType || bot.default_order_type,
      quantity: alertData.quantity || bot.default_quantity,
      price: alertData.price,
      stopLoss: alertData.stopLoss || bot.default_stop_loss,
      takeProfit: alertData.takeProfit || bot.default_take_profit,
      testnet: apiKey.test_mode || bot.test_mode
    };
    
    let orderResult;
    
    // Check if in test mode
    if (bot.test_mode) {
      // Simulate order execution
      orderResult = {
        orderId: `test-${Date.now()}`,
        symbol: orderParams.symbol,
        side: orderParams.side,
        orderType: orderParams.orderType,
        qty: orderParams.quantity,
        price: orderParams.price || 0,
        status: 'TEST_ORDER'
      };
    } else {
      // Execute actual order
      orderResult = await executeBybitOrder(orderParams);
    }
    
    // Log the trade
    await supabase
      .from('trades')
      .insert({
        user_id: webhook.user_id,
        bot_id: webhook.bot_id,
        symbol: orderResult.symbol,
        side: orderResult.side,
        order_type: orderResult.orderType,
        quantity: orderResult.qty,
        price: orderResult.price,
        order_id: orderResult.orderId,
        status: orderResult.status,
        created_at: new Date().toISOString()
      });
    
    // Update bot's last trade timestamp
    await supabase
      .from('bots')
      .update({
        last_trade_at: new Date().toISOString(),
        trade_count: bot.trade_count ? bot.trade_count + 1 : 1
      })
      .eq('id', webhook.bot_id);
    
    return new Response(JSON.stringify({
      success: true,
      orderId: orderResult.orderId,
      status: orderResult.status,
      testMode: bot.test_mode
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error('Error processing alert:', error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
};