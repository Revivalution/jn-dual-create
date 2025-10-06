import { Router, Request, Response, NextFunction } from 'express';
import { JobNimbus } from '../libs/jobnimbus.js';
import { normalizeE164 } from '../libs/phone.js';
import { cfg } from '../config.js';
import { extractRecordNumber } from '../libs/numbers.js';

export const dualCreate = Router();

/**
 * POST /jn/create-customer-and-job
 * Body:
 * {
 *   contact: { firstName?, lastName?, displayName?, email?, phone?, address? { street, city, state, postalCode }, type?, status? },
 *   job: { name?, type?, status?, address? { street, city, state, postalCode } }
 * }
 * Strategy:
 *  - Normalize phone; try to find an existing contact by phone/email.
 *  - If found, use it; else create contact with defaults for type/status.
 *  - Create job tied to contact.
 *  - Return ids + human-friendly numbers when available.
 */
dualCreate.post('/jn/create-customer-and-job', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Multi-tenant auth
    const appToken = req.header('x-app-token');
    const jnKey = req.header('x-jn-api-key');
    if (!appToken || appToken !== process.env.APP_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!jnKey && !process.env.JOBNIMBUS_API_KEY) {
      return res.status(400).json({ error: 'missing JobNimbus API key' });
    }
    const body: any = req.body || {};
    const c: any = body.contact || {};
    const j: any = body.job || {};

    // 1) Normalize and search (phone > email > name)
    const phone = normalizeE164(c.phone);
    const email = typeof c.email === 'string' ? c.email : undefined;
    let found: any | undefined;

    if (phone) {
      const r = await JobNimbus.searchContacts({ phone }, jnKey);
      if (Array.isArray(r) && r.length === 1) found = r[0];
    }
    if (!found && email) {
      const r = await JobNimbus.searchContacts({ email }, jnKey);
      if (Array.isArray(r) && r.length === 1) found = r[0];
    }
    if (!found && (c.displayName || c.firstName || c.lastName)) {
      const name = c.displayName || [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      if (name) {
        const r = await JobNimbus.searchContacts({ name }, jnKey);
        if (Array.isArray(r) && r.length === 1) found = r[0];
      }
    }

    // 2) Create or reuse contact
    let contactId: string;
    let contactNumber: string | undefined;
    if (found?.id) {
      contactId = String(found.id);
      contactNumber = extractRecordNumber(found);
    } else {
      const displayName =
        cfg.displayNameMode === 'displayName'
          ? (c.displayName ?? [c.firstName, c.lastName].filter(Boolean).join(' ').trim())
          : undefined;

      const name =
        cfg.displayNameMode === 'name'
          ? (c.displayName ?? [c.firstName, c.lastName].filter(Boolean).join(' ').trim())
          : undefined;

      const created = await JobNimbus.createContact({
        firstName: c.firstName,
        lastName: c.lastName,
        displayName,
        name,
        type: c.type ?? cfg.defaults.contactType,
        status: c.status ?? cfg.defaults.contactStatus,
        phone: phone,
        email: email,
        address: c.address
      }, jnKey);

      // Many tenants return id immediately; number may require a follow-up GET.
      contactId = String(created.id ?? created.contactId ?? created.ID);
      contactNumber = extractRecordNumber(created);
      if (!contactNumber && contactId) {
        const fresh = await JobNimbus.getContact(contactId, jnKey);
        contactNumber = extractRecordNumber(fresh);
      }
    }

    // 3) Create job tied to contact
    const jobCreated = await JobNimbus.createJob({
      contactId: contactId,
      name: j.name ?? 'New Job',
      type: j.type ?? cfg.defaults.jobType,
      status: j.status ?? cfg.defaults.jobStatus,
      address: j.address
    }, jnKey);

    const jobId = String(jobCreated.id ?? jobCreated.jobId ?? jobCreated.ID);
    let jobNumber = extractRecordNumber(jobCreated);
    if (!jobNumber && jobId) {
      const freshJob = await JobNimbus.getJob(jobId, jnKey);
      jobNumber = extractRecordNumber(freshJob);
    }

    return res.json({
      ok: true,
      customer: { id: contactId, number: contactNumber },
      job: { id: jobId, number: jobNumber }
    });
  } catch (err) {
    next(err);
  }
});

