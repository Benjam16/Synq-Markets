/**
 * Kalshi API Authentication Utility
 * Implements RSA-PSS signing for Kalshi API requests
 */

import crypto from 'crypto';

export interface KalshiAuthHeaders {
  'KALSHI-ACCESS-KEY': string;
  'KALSHI-ACCESS-SIGNATURE': string;
  'KALSHI-ACCESS-TIMESTAMP': string;
}

/**
 * Generate Kalshi authentication headers using RSA-PSS signing
 * @param method HTTP method (GET, POST, etc.)
 * @param path API path (e.g., '/trade-api/v2/portfolio/balance')
 * @param accessKey Kalshi access key (UUID)
 * @param privateKey RSA private key in PEM format
 */
export function generateKalshiHeaders(
  method: string,
  path: string,
  accessKey: string,
  privateKey: string
): KalshiAuthHeaders {
  // Generate timestamp (milliseconds since epoch)
  const timestamp = Date.now().toString();

  // Create message to sign: timestamp + method + path
  const message = `${timestamp}${method.toUpperCase()}${path}`;

  // Load private key
  const key = crypto.createPrivateKey({
    key: privateKey,
    format: 'pem',
  });

  // Sign with RSA-PSS
  const signature = crypto.sign('RSA-SHA256', Buffer.from(message), {
    key,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
  });

  // Base64 encode signature
  const signatureB64 = signature.toString('base64');

  return {
    'KALSHI-ACCESS-KEY': accessKey,
    'KALSHI-ACCESS-SIGNATURE': signatureB64,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
  };
}

