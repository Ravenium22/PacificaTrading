import bs58 from 'bs58';

/**
 * Validates if a string is a valid Solana private key (base58 encoded, 64 bytes)
 * @param key The API key string to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateApiKey(key: string): { isValid: boolean; error?: string } {
  // Check if key is empty
  if (!key || key.trim().length === 0) {
    return { isValid: false, error: 'API key cannot be empty' };
  }

  // Remove any whitespace
  const trimmedKey = key.trim();

  // Check basic length (base58 encoded 64 bytes is typically 87-88 characters)
  if (trimmedKey.length < 80 || trimmedKey.length > 90) {
    return { isValid: false, error: 'API key should be 87-88 characters' };
  }

  // Try to decode as base58
  try {
    const decoded = bs58.decode(trimmedKey);

    // Solana private keys should be exactly 64 bytes
    if (decoded.length !== 64) {
      return {
        isValid: false,
        error: `Invalid key length: ${decoded.length} bytes (expected 64 bytes)`,
      };
    }

    // All checks passed
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid base58 encoding',
    };
  }
}

/**
 * Get validation status with color indicator
 * @param key The API key to check
 * @returns Object with status ('valid' | 'invalid' | 'empty') and color class
 */
export function getValidationStatus(key: string): {
  status: 'valid' | 'invalid' | 'empty';
  colorClass: string;
  message?: string;
} {
  if (!key || key.trim().length === 0) {
    return {
      status: 'empty',
      colorClass: 'border-slate-700',
    };
  }

  const validation = validateApiKey(key);

  if (validation.isValid) {
    return {
      status: 'valid',
      colorClass: 'border-green-500 focus:border-green-500',
      message: 'Valid API key format',
    };
  } else {
    return {
      status: 'invalid',
      colorClass: 'border-red-500 focus:border-red-500',
      message: validation.error,
    };
  }
}
