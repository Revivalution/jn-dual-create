import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * Normalize phone number to national format (without country code)
 * Prevents "1" prefix being added to US phone numbers
 * @param raw - Raw phone number input
 * @returns Formatted phone number like "(334) 414-3569" or undefined
 */
export function normalizeE164(raw?: string | null) {
  if (!raw) return undefined;
  try {
    const p = parsePhoneNumber(raw, 'US');
    // Return national format without country code to prevent "1" prefix
    // formatNational() returns format like "(334) 414-3569"
    return p.formatNational();
  } catch {
    // If parsing fails, return the raw input (may already be formatted)
    return raw;
  }
}

