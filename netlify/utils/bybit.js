// Bybit API utility functions
import axios from 'npm:axios@1.6.0';
import crypto from 'node:crypto';

// Base URLs
const MAINNET_URL = 'https://api.bybit.com';
const TESTNET_URL = 'https://api-testnet.bybit.com';

// Function to generate signature for API requests
function generateSignature(apiSecret, params) {
  // Add timestamp to the params object
  const timestamp = Date.now().toString();
  params.timestamp = timestamp;
  
  // Sort the keys alphabetically and create the query string
  const queryString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  // Generate the HMAC SHA256 signature
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');
  
  return signature;
}

// Function to execute order on Bybit
export async function executeBybitOrder({
  apiKey,
  apiSecret,
  symbol,
  side,
  orderType,
  quantity,
  price,
  stopLoss,
  takeProfit,
  testnet = false
}) {
  const baseUrl = testnet ? TESTNET_URL : MAINNET_URL;
  const endpoint = '/v2/private/order/create';
  
  const params = {
    api_key: apiKey,
    symbol: symbol,
    side: side,
    order_type: orderType,
    qty: quantity,
    time_in_force: 'GoodTillCancel'
  };
  
  // Add price for limit orders
  if (orderType === 'Limit') {
    params.price = price;
  }
  
  // Add take profit and stop loss if provided
  if (stopLoss) params.stop_loss = stopLoss;
  if (takeProfit) params.take_profit = takeProfit;
  
  // Generate signature and add it to params
  const timestamp = Date.now().toString();
  params.timestamp = timestamp;
  
  const signature = generateSignature(apiSecret, {...params});
  params.sign = signature;
  
  try {
    // Convert params to URL-encoded format
    const encodedParams = new URLSearchParams(params).toString();
    
    // Make the request with proper content-type
    const response = await axios.post(`${baseUrl}${endpoint}`, encodedParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.data.ret_code === 0) {
      return {
        orderId: response.data.result.order_id,
        symbol: symbol,
        side: side,
        orderType: orderType,
        qty: quantity,
        price: price,
        status: response.data.result.order_status
      };
    } else {
      throw new Error(`Bybit API error: ${response.data.ret_msg}`);
    }
  } catch (error) {
    // Enhanced error logging for debugging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Bybit API response error: Status ${error.response.status}`);
      console.error('Response data:', JSON.stringify(error.response.data));
      throw new Error(`Failed to execute order: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from Bybit API');
      throw new Error('Failed to execute order: No response received from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
      throw new Error(`Failed to execute order: ${error.message}`);
    }
  }
}

// Function to get account positions
export async function getBybitPositions({
  apiKey,
  apiSecret,
  symbol,
  testnet = false
}) {
  const baseUrl = testnet ? TESTNET_URL : MAINNET_URL;
  const endpoint = '/v2/private/position/list';
  
  const params = {
    api_key: apiKey,
    symbol: symbol
  };
  
  // Add timestamp and generate signature
  const timestamp = Date.now().toString();
  params.timestamp = timestamp;
  
  const signature = generateSignature(apiSecret, {...params});
  params.sign = signature;
  
  try {
    // Create URL with query parameters
    const url = new URL(`${baseUrl}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    const response = await axios.get(url.toString());
    
    if (response.data.ret_code === 0) {
      return response.data.result;
    } else {
      throw new Error(`Bybit API error: ${response.data.ret_msg}`);
    }
  } catch (error) {
    // Enhanced error logging for debugging
    if (error.response) {
      console.error(`Bybit API response error: Status ${error.response.status}`);
      console.error('Response data:', JSON.stringify(error.response.data));
      throw new Error(`Failed to get positions: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('No response received from Bybit API');
      throw new Error('Failed to get positions: No response received from server');
    } else {
      console.error('Error setting up request:', error.message);
      throw new Error(`Failed to get positions: ${error.message}`);
    }
  }
}
