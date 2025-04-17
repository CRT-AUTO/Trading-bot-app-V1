// utils/bybit.js

import axios from 'axios';
import crypto from 'crypto';

// Alternate mainnet domain to avoid geo‑blocks, plus testnet
const MAINNET_URL     = 'https://api.byhkbit.com';
const TESTNET_URL     = 'https://api-testnet.bybit.com';
const DEFAULT_RECV_WINDOW = '15000';

/**
 * Fetch Bybit server time for precise signature timestamps.
 * Returns a string of milliseconds since epoch.
 */
async function getServerTimestamp(testnet = false) {
  const url = `${testnet ? TESTNET_URL : MAINNET_URL}/v5/market/time`;
  const { data } = await axios.get(url);
  if (data.retCode !== 0) {
    throw new Error(`Failed to fetch server time: ${data.retMsg}`);
  }
  return String(data.time);
}

/**
 * Sign a POST request per V5 spec:
 *   signStr = timestamp + apiKey + recvWindow + bodyString
 */
function signPost({ apiSecret, apiKey, recvWindow, timestamp, body }) {
  const plain = timestamp + apiKey + recvWindow + body;
  return crypto.createHmac('sha256', apiSecret).update(plain).digest('hex');
}

/**
 * Sign a GET request per V5 spec:
 *   signStr = timestamp + apiKey + recvWindow + queryString
 */
function signGet({ apiSecret, apiKey, recvWindow, timestamp, queryString }) {
  const plain = timestamp + apiKey + recvWindow + queryString;
  return crypto.createHmac('sha256', apiSecret).update(plain).digest('hex');
}

/**
 * Execute an order on Bybit using V5 API.
 * Returns an object { orderId, symbol, side, orderType, qty, price, status }.
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
  testnet = false,
  category = 'linear',             // USDT perpetual
  recvWindow = DEFAULT_RECV_WINDOW
}) {
  const baseUrl = testnet ? TESTNET_URL : MAINNET_URL;
  const endpoint = '/v5/order/create';

  // 1) Build the JSON payload
  const payload = {
    category,
    symbol,
    side,
    orderType,
    qty: String(quantity),
    timeInForce: orderType === 'Market' ? 'IOC' : 'PostOnly'
  };
  if (orderType === 'Limit' && price != null)     payload.price     = String(price);
  if (stopLoss != null)  payload.stopLoss  = String(stopLoss);
  if (takeProfit != null) payload.takeProfit = String(takeProfit);

  const bodyStr   = JSON.stringify(payload);
  const timestamp = await getServerTimestamp(testnet);
  const signature = signPost({ apiSecret, apiKey, recvWindow, timestamp, body: bodyStr });

  const headers = {
    'Content-Type':     'application/json',
    'X-BAPI-API-KEY':     apiKey,
    'X-BAPI-TIMESTAMP':   timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'X-BAPI-SIGN':        signature
  };

  const url = `${baseUrl}${endpoint}`;
  const { data } = await axios.post(url, bodyStr, { headers });

  if (data.retCode !== 0) {
    throw new Error(`Bybit API error ${data.retCode}: ${data.retMsg}`);
  }

  return {
    orderId: data.result.orderId,
    symbol,
    side,
    orderType,
    qty:       quantity,
    price:     price || null,
    status:    data.result.orderStatus
  };
}

/**
 * Get account positions from Bybit using V5 API.
 * Returns data.result (array of position objects).
 */
export async function getBybitPositions({
  apiKey,
  apiSecret,
  symbol,
  testnet = false,
  category = 'linear',
  recvWindow = DEFAULT_RECV_WINDOW
}) {
  const baseUrl = testnet ? TESTNET_URL : MAINNET_URL;
  const endpoint = '/v5/position/list';

  // 1) Build sorted query string
  const params = { category, symbol };
  const queryString = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');

  const timestamp = await getServerTimestamp(testnet);
  const signature = signGet({ apiSecret, apiKey, recvWindow, timestamp, queryString });

  const headers = {
    'X-BAPI-API-KEY':     apiKey,
    'X-BAPI-TIMESTAMP':   timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'X-BAPI-SIGN':        signature
  };

  const url = `${baseUrl}${endpoint}?${queryString}`;
  const { data } = await axios.get(url, { headers });

  if (data.retCode !== 0) {
    throw new Error(`Bybit API error ${data.retCode}: ${data.retMsg}`);
  }
  return data.result;
}
