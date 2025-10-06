// Extract the human-friendly record number if JobNimbus returns one.
// Fallback to id if number is not present in your tenant.
export function extractRecordNumber(obj) {
    const candidates = ['number', 'recordNumber', 'displayNumber', 'contactNumber', 'jobNumber', 'idNumber'];
    for (const key of candidates) {
        if (obj && typeof obj[key] === 'string' && obj[key])
            return obj[key];
        if (obj && typeof obj[key] === 'number')
            return String(obj[key]);
    }
    return undefined;
}
