/**
 * Encryption utilities for HubRise tokens
 * Uses Web Crypto API available in Cloudflare Workers
 */

/**
 * Encrypt text using AES-GCM
 * @param {string} text - Plain text to encrypt
 * @param {string} secret - Encryption secret key
 * @returns {Promise<string>} Base64 encoded encrypted text with IV
 */
export async function encrypt(text, secret) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Derive key from secret
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret.padEnd(32, '0').substring(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt text using AES-GCM
 * @param {string} encryptedText - Base64 encoded encrypted text with IV
 * @param {string} secret - Encryption secret key
 * @returns {Promise<string>} Decrypted plain text
 */
export async function decrypt(encryptedText, secret) {
  try {
    const encoder = new TextEncoder();
    
    // Decode base64
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Derive key from secret
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret.padEnd(32, '0').substring(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Decrypt data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      encrypted
    );
    
    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Validate HMAC signature for webhooks
 * @param {string} body - Raw request body
 * @param {string} signature - HMAC signature from header
 * @param {string} secret - HMAC secret key
 * @returns {Promise<boolean>} True if signature is valid
 */
export async function validateHMAC(body, signature, secret) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );
    
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return computedSignature === signature;
  } catch (error) {
    console.error('HMAC validation error:', error);
    return false;
  }
}

/**
 * Generate a random UUID v4
 * @returns {string} UUID string
 */
export function generateUUID() {
  return crypto.randomUUID();
}
