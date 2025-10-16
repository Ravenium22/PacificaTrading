import bs58 from 'bs58';

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
