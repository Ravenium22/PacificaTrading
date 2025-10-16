import crypto from 'crypto';

// Get encryption key from environment or use default (CHANGE IN PRODUCTION!)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-change-this-in-prod';

// Validate encryption key
const isHex = /^[0-9a-fA-F]+$/;
if (process.env.NODE_ENV === 'production') {
  if (!process.env.ENCRYPTION_KEY || !isHex.test(ENCRYPTION_KEY) || ENCRYPTION_KEY.length !== 64) {
    throw new Error('[Encryption] ENCRYPTION_KEY must be a 64-character hex string in production');
  }
} else {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('[Encryption] Using default ENCRYPTION_KEY (development only). Set a 64-char hex key in production.');
  } else if (!isHex.test(ENCRYPTION_KEY) || ENCRYPTION_KEY.length !== 64) {
    console.warn('[Encryption] ENCRYPTION_KEY is not a 64-character hex string. Encryption may fail.');
  }
}

// Ensure key is exactly 32 bytes for AES-256
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex');

const algorithm = 'aes-256-gcm';

/**
 * Encrypts an API key using AES-256-GCM
 * @param text The plaintext API key to encrypt
 * @returns Encrypted string in format: iv:authTag:encrypted
 */
export function encryptApiKey(text: string): string {
  try {
    // Generate random initialization vector
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, KEY_BUFFER, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encrypted
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('[Encryption] Error encrypting API key:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypts an API key encrypted with encryptApiKey()
 * @param text Encrypted string in format: iv:authTag:encrypted
 * @returns Decrypted API key
 */
export function decryptApiKey(text: string): string {
  try {
    // Split the encrypted text into its components
    const parts = text.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, KEY_BUFFER, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[Encryption] Error decrypting API key:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Generates a random 32-character encryption key
 * Use this to generate a secure key for production
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
