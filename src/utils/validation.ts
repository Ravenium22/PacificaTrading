import bs58 from 'bs58';
import nacl from 'tweetnacl';

/**
 * Checks if a string is valid base58 encoding
 * @param str The string to validate
 * @returns true if valid base58, false otherwise
 */
export function isValidBase58(str: string): boolean {
  try {
    bs58.decode(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid Solana private key
 * Solana private keys are base58-encoded and decode to 64 bytes
 * @param str The string to validate
 * @returns true if valid Solana private key, false otherwise
 */
export function isValidSolanaPrivateKey(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  // Trim whitespace
  str = str.trim();

  // Check if valid base58
  if (!isValidBase58(str)) {
    return false;
  }

  try {
    const decoded = bs58.decode(str);
    // Solana private keys are 64 bytes
    return decoded.length === 64;
  } catch {
    return false;
  }
}

/**
 * Verify an Ed25519 signature for a UTF-8 message using a Solana public key.
 * @param message The exact message string that was signed (UTF-8)
 * @param signatureB58 The signature in base58
 * @param publicKeyB58 The signer public key in base58
 */
export function verifySolanaSignature(message: string, signatureB58: string, publicKeyB58: string): boolean {
  try {
    const signature = bs58.decode(signatureB58);
    const publicKey = bs58.decode(publicKeyB58);
    return nacl.sign.detached.verify(Buffer.from(message, 'utf8'), signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Checks if a timestamp is within an acceptable skew window (defaults 5 minutes)
 */
export function isRecentTimestamp(timestamp: number, skewMs = 5 * 60 * 1000): boolean {
  if (!timestamp || typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return false;
  const now = Date.now();
  return Math.abs(now - timestamp) <= skewMs;
}
