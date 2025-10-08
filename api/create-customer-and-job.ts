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
    log.info({ contact: c, job: j, userEmail, userName }, 'Starting customer/job creation');

    // 1) Normalize and search (phone > email > name)
    const phone = normalizeE164(c.phone);
    const email = typeof c.email === 'string' ? c.email : undefined;
    let found: any | undefined;

    const JN = JobNimbus(jnKey, userEmail); // Initialize JobNimbus client with the key and actor email

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
      console.log('✅ Found existing contact:', found.id);
      log.info({ found }, 'Using existing contact');
      contactId = String(found.id);
      contactNumber = extractRecordNumber(found);
    } else {
      console.log('📝 Creating new contact...');
      // displayName is required by JobNimbus
      const displayName = c.displayName ?? [c.firstName, c.lastName].filter(Boolean).join(' ').trim();

      const contactData: any = {
        first_name: c.firstName,  // Use snake_case as JobNimbus expects
        last_name: c.lastName,    // Use snake_case as JobNimbus expects
        // Don't set type or status - let JobNimbus use defaults
        home_phone: phone,        // Use home_phone field (snake_case)
        email: email,
        address_line1: c.address?.street,
        city: c.address?.city,
        state_text: c.address?.state,
        zip: c.address?.postalCode
      };
      
      // NOTE: We use the 'actor' query parameter to set the creator/owner
      // Don't manually set sales_rep or sales_rep_name - JobNimbus handles this
      
      console.log('📝 Contact data:', JSON.stringify(contactData, null, 2));
      
      let created;
      try {
        created = await JN.createContact(contactData);
      } catch (createError: any) {
        console.error('❌ Contact creation failed:', createError.message);
        console.error('❌ Error response:', createError.response?.data);
        console.error('❌ Error status:', createError.response?.status);
        throw createError;
      }

      console.log('✅ Contact created successfully');
      log.info({ created }, 'Contact created response');
      
      // Extract ID - try multiple field names
      contactId = String(created.jnid ?? created.id ?? created.contactId ?? created.ID ?? created._id);
      contactNumber = extractRecordNumber(created);
      
      console.log('🔑 Contact ID:', contactId, 'Number:', contactNumber);
      log.info({ contactId, contactNumber }, 'Extracted contact identifiers');
      
      if (!contactId || contactId === 'undefined') {
        console.error('❌ Failed to extract contact ID from response');
        log.error({ created }, 'Contact ID extraction failed');
        throw new Error('Failed to extract contact ID from JobNimbus response');
      }
      
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
    // ALWAYS use customer's first and last name for the job name
    const customerName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
    const jobName = customerName || 'Unnamed Customer';
    
    console.log('📝 Job name (using customer name):', jobName);
    console.log('📝 Creating job for contact ID:', contactId);
    
    let jobCreated;
    try {
      jobCreated = await JN.createJob({
        name: jobName,
        display_name: jobName,  // Set display_name explicitly to prevent auto-formatting
        displayName: jobName,   // Also set camelCase version for compatibility
        // Don't set type or status - let JobNimbus use defaults
        address_line1: j.address?.street,
        city: j.address?.city,
        state_text: j.address?.state,
        zip: j.address?.postalCode,
        // Link job to contact using the 'primary' field (per JobNimbus docs)
        primary: {
          id: contactId
        }
        // NOTE: We use the 'actor' query parameter to set the creator/owner
        // Don't manually set sales_rep or sales_rep_name - JobNimbus handles this
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
          name: jobName,
          address_line1: j.address?.street,
          city: j.address?.city,
          state_text: j.address?.state,
          zip: j.address?.postalCode,
          primary: {
            id: contactId
          }
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
