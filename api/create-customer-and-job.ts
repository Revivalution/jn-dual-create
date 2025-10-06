import type { VercelRequest, VercelResponse } from '@vercel/node';
import { JobNimbus } from '../src/libs/jobnimbus.js';
import { normalizeE164 } from '../src/libs/phone.js';
import { extractRecordNumber } from '../src/libs/numbers.js';
import { log } from '../src/libs/logger.js';

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
    const userEmail = req.headers['x-user-email'] as string;
    const userName = req.headers['x-user-name'] as string;
    
    if (!appToken || appToken !== process.env.APP_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    
    if (!jnKey) {
      return res.status(400).json({ error: 'missing JobNimbus API key' });
    }

    const body: any = req.body || {};
    const c: any = body.contact || {};
    const j: any = body.job || {};

    console.log('👤 Creating for user:', userName, '(', userEmail, ')');
    console.log('📦 Request:', { contact: c, job: j });

    // 1) Normalize and search (phone > email > name)
    const phone = normalizeE164(c.phone);
    const email = typeof c.email === 'string' ? c.email : undefined;
    let found: any | undefined;

    const JN = JobNimbus(jnKey); // Initialize JobNimbus client with the key

    if (phone) {
      const r = await JN.searchContacts({ phone });
      if (Array.isArray(r) && r.length === 1) found = r[0];
    }
    if (!found && email) {
      const r = await JN.searchContacts({ email });
      if (Array.isArray(r) && r.length === 1) found = r[0];
    }
    if (!found && (c.displayName || c.firstName || c.lastName)) {
      const name = c.displayName || [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      if (name) {
        const r = await JN.searchContacts({ name });
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
      // displayName is required by JobNimbus
      const displayName = c.displayName ?? [c.firstName, c.lastName].filter(Boolean).join(' ').trim();

      const created = await JN.createContact({
        firstName: c.firstName,
        lastName: c.lastName,
        display_name: displayName, // Use snake_case as JobNimbus expects
        // Don't set type or status - let JobNimbus use defaults
        phone: phone,
        email: email,
        address: c.address,
        // Assign to current user
        sales_rep: userEmail,
        sales_rep_name: userName
      });

      log.info({ created }, 'Contact created response');
      
      // Extract ID - try multiple field names
      contactId = String(created.jnid ?? created.id ?? created.contactId ?? created.ID ?? created._id);
      contactNumber = extractRecordNumber(created);
      
      log.info({ contactId, contactNumber }, 'Extracted contact identifiers');
      
      if (!contactNumber && contactId && contactId !== 'undefined') {
        const fresh = await JN.getContact(contactId);
        log.info({ fresh }, 'Fetched fresh contact');
        contactNumber = extractRecordNumber(fresh);
      }
      
      // Wait a moment for JobNimbus to fully process the contact
      console.log('⏳ Waiting for JobNimbus to process contact...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }

    // 3) Create job tied to contact
    // Auto-generate unique job name if not provided or make it unique
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log('🔍 Job name from request:', j.name, 'Type:', typeof j.name, 'Length:', j.name?.length);
    const hasJobName = j.name && typeof j.name === 'string' && j.name.trim().length > 0;
    console.log('🔍 hasJobName:', hasJobName);
    const jobName = hasJobName
      ? `${j.name.trim()} - ${timestamp}` 
      : `Job for ${c.firstName || ''} ${c.lastName || ''} - ${timestamp}`.trim();
    
    console.log('📝 Final job name:', jobName);
    console.log('📝 Creating job for contact ID:', contactId);
    
    let jobCreated;
    try {
      jobCreated = await JN.createJob({
        contactId: contactId,
        name: jobName,
        // Don't set type or status - let JobNimbus use defaults
        address: j.address,
        // Assign to current user
        sales_rep: userEmail,
        sales_rep_name: userName
      });
    } catch (jobError: any) {
      console.error('❌ Job creation failed:', jobError.message);
      console.error('❌ Job error details:', jobError.response?.data);
      
      // If it's a Couchbase error, the contact might not be ready yet
      if (jobError.response?.data?.includes?.('CouchbaseError')) {
        console.log('⏳ Retrying job creation after delay...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        
        // Retry once
        jobCreated = await JN.createJob({
          contactId: contactId,
          name: jobName,
          address: j.address,
          sales_rep: userEmail,
          sales_rep_name: userName
        });
      } else {
        throw jobError; // Re-throw if it's a different error
      }
    }

    log.info({ jobCreated }, 'Job created response');
    
    // Extract ID - try multiple field names
    const jobId = String(jobCreated.jnid ?? jobCreated.id ?? jobCreated.jobId ?? jobCreated.ID ?? jobCreated._id);
    let jobNumber = extractRecordNumber(jobCreated);
    
    log.info({ jobId, jobNumber }, 'Extracted job identifiers');
    
    if (!jobNumber && jobId && jobId !== 'undefined') {
      const freshJob = await JN.getJob(jobId);
      log.info({ freshJob }, 'Fetched fresh job');
      jobNumber = extractRecordNumber(freshJob);
    }

    return res.json({
      ok: true,
      customer: { id: contactId, number: contactNumber },
      job: { id: jobId, number: jobNumber }
    });
  } catch (err: any) {
    console.error('Error:', err);
    console.error('Error response:', err.response?.data);
    console.error('Error status:', err.response?.status);
    return res.status(500).json({ 
      error: err.message || 'Server error',
      details: err.response?.data,
      status: err.response?.status
    });
  }
}
