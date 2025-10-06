# jn-dual-create

Create a JobNimbus **Contact + Job** in one API call (sequential under the hood).

## Quick start

1. `pnpm i`
2. Copy `.env.example` → `.env`, set `JOBNIMBUS_API_BASE` and `JOBNIMBUS_API_KEY`.
3. `pnpm dev`

## Endpoint

`POST /jn/create-customer-and-job`

Body example:
```json
{
  "contact": {
    "firstName": "Dawn",
    "lastName": "Cobb",
    "phone": "205-555-0175",
    "email": "dawn@example.com",
    "address": { "street": "123 Brookview Dr", "city": "Hoover", "state": "AL", "postalCode": "35226" },
    "type": "Residential",
    "status": "New Lead"
  },
  "job": {
    "name": "Hail Inspection",
    "type": "Roof Replacement",
    "status": "New"
  }
}
```
Response:
```json
{
  "ok": true,
  "customer": { "id": "c_12345", "number": "C-002341" },
  "job": { "id": "j_67890", "number": "J-009812" }
}
```

Notes:
- We first create or reuse the Contact (searching by phone/email/name), then create the Job linked to that contact. This mirrors JobNimbus’ own UI flow for Jobs V2.
- Record ID numbers are auto-assigned by JobNimbus. We return them when present; otherwise, we fall back to the record ID.
