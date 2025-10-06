import type { VercelRequest, VercelResponse } from '@vercel/node';
import { JobNimbus } from '../src/libs/jobnimbus.js';
import { normalizeE164 } from '../src/libs/phone.js';
import { extractRecordNumber } from '../src/libs/numbers.js';

const cfg = {
  defaults: {
    contactType: process.env.JN_DEFAULT_CONTACT_TYPE ?? 'Residential',
    contactStatus: process.env.JN_DEFAULT_CONTACT_STATUS ?? 'New Lead',
    jobType: process.env.JN_DEFAULT_JOB_TYPE ?? 'General',
    jobStatus: process.env.JN_DEFAULT_JOB_STATUS ?? 'New'
  },
  displayNameMode: (process.env.JN_CONTACT_DISPLAY_NAME_MODE ?? 'displayName') as 'displayName'|'name'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Multi-tenant auth
    const appToken = req.headers['x-app-token'] as string;
    const jnKey = req.headers['x-jn-api-key'] as string;
    
    if (!appToken || appToken !== process.env.APP_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    
    if (!jnKey) {
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
  } catch (err: any) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
