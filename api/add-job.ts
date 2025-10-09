import type { VercelRequest, VercelResponse } from '@vercel/node';
import { JobNimbus } from '../src/libs/jobnimbus.js';
import { extractRecordNumber } from '../src/libs/numbers.js';
import { log } from '../src/libs/logger.js';

/**
 * Add a new job to an existing customer in JobNimbus
 * 
 * Request headers:
 * - x-app-token: App authentication token
 * - x-jn-api-key: JobNimbus API key
 * - x-user-email: User's email (for actor tracking)
 * - x-user-name: User's name (for logging)
 * 
 * Request body:
 * {
 *   contactId: string,     // JobNimbus contact JNID (required)
 *   jobName: string,       // User-provided job name (required - e.g., "Roof Replacement", "Insurance Job")
 *   job: {
 *     address?: {
 *       street?: string,
 *       city?: string,
 *       state?: string,
 *       postalCode?: string
 *     },
 *     description?: string
 *   }
 * }
 */
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
    const { contactId, jobName, job: j = {} } = body;

    if (!contactId) {
      return res.status(400).json({ error: 'missing contactId' });
    }

    if (!jobName) {
      return res.status(400).json({ error: 'missing jobName - job name is required' });
    }

    console.log('👤 Adding job for user:', userName, '(', userEmail, ')');
    console.log('📦 Contact ID:', contactId);
    console.log('📦 Job Name:', jobName);
    console.log('📦 Job data:', j);
    log.info({ contactId, jobName, job: j, userEmail, userName }, 'Adding job to existing customer');

    const JN = JobNimbus(jnKey, userEmail); // Initialize JobNimbus client

    // Verify contact exists
    console.log('🔍 Verifying contact exists...');
    let contact;
    try {
      contact = await JN.getContact(contactId);
      console.log('✅ Contact verified:', contact.display_name || contact.displayName);
    } catch (error: any) {
      console.error('❌ Contact not found:', contactId);
      return res.status(404).json({ error: 'Contact not found', contactId });
    }

    // Use the user-provided job name directly
    console.log('📝 Job name (user-provided):', jobName);
    console.log('📝 Creating job for contact ID:', contactId);
    
    let jobCreated;
    try {
      jobCreated = await JN.createJob({
        name: jobName,
        display_name: jobName,  // Set display_name explicitly to prevent auto-formatting
        displayName: jobName,   // Also set camelCase version for compatibility
        description: j.description,
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
      
      // If it's a Couchbase error, retry after delay
      if (jobError.response?.data?.includes?.('CouchbaseError')) {
        console.log('⏳ Retrying job creation after delay...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        
        // Retry once
        jobCreated = await JN.createJob({
          name: jobName,
          display_name: jobName,
          displayName: jobName,
          description: j.description,
          address_line1: j.address?.street,
          city: j.address?.city,
          state_text: j.address?.state,
          zip: j.address?.postalCode,
          primary: {
            id: contactId
          }
        });
      } else {
        throw jobError; // Re-throw - will be caught and returned as 500 with details
      }
    }

    log.info({ jobCreated }, 'Job created response');
    
    // Extract ID and number
    const jobId = String(jobCreated.jnid ?? jobCreated.id ?? jobCreated.jobId ?? jobCreated.ID ?? jobCreated._id);
    let jobNumber = extractRecordNumber(jobCreated);
    
    log.info({ jobId, jobNumber }, 'Extracted job identifiers');
    
    // If number not immediately available, fetch fresh job
    if (!jobNumber && jobId && jobId !== 'undefined') {
      const freshJob = await JN.getJob(jobId);
      log.info({ freshJob }, 'Fetched fresh job');
      jobNumber = extractRecordNumber(freshJob);
    }

    console.log('✅ Job created successfully!');
    console.log('   Job ID:', jobId);
    console.log('   Job Number:', jobNumber);

    return res.json({
      ok: true,
      job: { 
        id: jobId, 
        number: jobNumber,
        name: jobName
      }
    });
  } catch (err: any) {
    console.error('Error:', err);
    console.error('Error response:', err.response?.data);
    console.error('Error status:', err.response?.status);
    log.error({ err }, 'Add job failed');
    return res.status(500).json({ 
      error: err.message || 'Server error',
      details: err.response?.data,
      status: err.response?.status
    });
  }
}

