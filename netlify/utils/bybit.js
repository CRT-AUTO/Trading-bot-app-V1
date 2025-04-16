// Bybit API utility functions
import axios from 'npm:axios@1.6.0';
import crypto from 'node:crypto';

// Base URLs
const MAINNET_URL = 'https://api.bybit.com';
const TESTNET_URL = 'https://api-testnet.bybit.com';

// Function to generate signature for API requests
function generateSignature(apiSecret, params) {
  const timestamp = Date.now().toString();
  const queryString = Object.keys(params)
    .sort()
    .reduce((a, b) => {
      return a + b + '=' + params[b] + '&';
    }, `timestamp=${timestamp}&`);
  
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(queryString.slice(0, -1))
    .digest('hex');
  
  return { timestamp, signature };
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
  
  // Generate signature
  const { timestamp, signature } = generateSignature(apiSecret, params);
  params.timestamp = timestamp;
  params.sign = signature;
  
  try {
    const response = await axios.post(`${baseUrl}${endpoint}`, params);
    
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
    throw new Error(`Failed to execute order: ${error.message}`);
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
  
  // Generate signature
  const { timestamp, signature } = generateSignature(apiSecret, params);
  params.timestamp = timestamp;
  params.sign = signature;
  
  try {
    const response = await axios.get(`${baseUrl}${endpoint}`, { params });
    
    if (response.data.ret_code === 0) {
      return response.data.result;
    } else {
      throw new Error(`Bybit API error: ${response.data.ret_msg}`);
    }
  } catch (error) {
    throw new Error(`Failed to get positions: ${error.message}`);
  }
}