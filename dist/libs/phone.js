import { parsePhoneNumber } from 'libphonenumber-js';
export function normalizeE164(raw) {
    if (!raw)
        return undefined;
    try {
        const p = parsePhoneNumber(raw, 'US');
        return p.number;
    }
    catch {
        return undefined;
    }
}
