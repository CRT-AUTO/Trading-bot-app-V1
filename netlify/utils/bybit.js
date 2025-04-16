// Bybit API utility functions

import axios from 'axios';
import crypto from 'crypto';

// Base URLs
const MAINNET_URL = 'https://api.bybit.com';
const TESTNET_URL = 'https://api-testnet.bybit.com';

/**
 * Generate signature for API requests.
 *
 * NOTE: This function assumes that the params object already contains a timestamp.
 */
function generateSignature(apiSecret, params) {
  // Create the query string from the provided params
  const queryString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // Generate the HMAC SHA256 signature
  return crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');
}

/**
 * Execute an order on Bybit.
 */
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

  // Set up order parameters
  const params = {
    api_key: apiKey,
    symbol: symbol,
    side: side,
    order_type: orderType,
    qty: quantity,
    time_in_force: 'GoodTillCancel'
  };

  // Add price for Limit orders only
  if (orderType === 'Limit') {
    params.price = price;
  }

  // Add optional stop loss and take profit if provided
  if (stopLoss) params.stop_loss = stopLoss;
  if (takeProfit) params.take_profit = takeProfit;

  // Set the timestamp once on the params object
  const timestamp = Date.now().toString();
  params.timestamp = timestamp;

  // Generate signature using the params (which already include the timestamp)
  const signature = generateSignature(apiSecret, { ...params });
  params.sign = signature;

  try {
    // Convert params to URL-encoded format required by Bybit
    const encodedParams = new URLSearchParams(params).toString();

    // Execute the POST request with proper headers
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
      console.error(`Bybit API response error: Status ${error.response.status}`);
      console.error('Response data:', JSON.stringify(error.response.data));
      throw new Error(`Failed to execute order: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('No response received from Bybit API');
      throw new Error('Failed to execute order: No response received from server');
    } else {
      console.error('Error setting up request:', error.message);
      throw new Error(`Failed to execute order: ${error.message}`);
    }
  }
}

/**
 * Get account positions from Bybit.
 */
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

  // Set the timestamp on the params object
  const timestamp = Date.now().toString();
  params.timestamp = timestamp;

  // Generate signature using the params (which already include the timestamp)
  const signature = generateSignature(apiSecret, { ...params });
  params.sign = signature;

  try {
    // Build URL with query parameters
    const url = new URL(`${baseUrl}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    // Execute GET request
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
