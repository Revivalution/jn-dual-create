import { jnClient } from './http.js';

// NOTE: Field names can vary by tenant/version. These are safe defaults.
// Verify against the official Postman docs in your org.
export type ContactCreate = {
  // Minimal fields—adapt to your schema:
  firstName?: string;
  lastName?: string;
  displayName?: string; // often unique in JN
  display_name?: string; // snake_case version
  name?: string;        // some tenants expose 'name' instead
  type?: string;
  status?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string; city?: string; state?: string; postalCode?: string;
  };
  sales_rep?: string;      // Salesperson email
  sales_rep_name?: string; // Salesperson name
};

export type JobCreate = {
  name?: string;
  display_name?: string;   // Some tenants use display_name as the visible name
  displayName?: string;    // CamelCase version
  type?: string;
  status?: string;
  address?: {
    street?: string; city?: string; state?: string; postalCode?: string;
  };
  primary?: {
    id: string;           // The contact/customer JNID this job is linked to
  };
  sales_rep?: string;      // Salesperson email (read-only, set via actor)
  sales_rep_name?: string; // Salesperson name (read-only, set via actor)
};

export const JobNimbus = (apiKey?: string, actorEmail?: string) => ({
  async searchContacts(q: { phone?: string; email?: string; name?: string }) {
    // Replace params to match your tenant's search semantics.
    const params = actorEmail ? { ...q, actor: actorEmail } : q;
    return (await jnClient(apiKey).get('/contacts', { params })).data;
  },
  async getContact(id: string) {
    const params = actorEmail ? { actor: actorEmail } : {};
    return (await jnClient(apiKey).get(`/contacts/${id}`, { params })).data;
  },
  async createContact(body: ContactCreate) {
    const params = actorEmail ? { actor: actorEmail } : {};
    return (await jnClient(apiKey).post('/contacts', body, { params })).data;
  },
  async getJob(id: string) {
    const params = actorEmail ? { actor: actorEmail } : {};
    return (await jnClient(apiKey).get(`/jobs/${id}`, { params })).data;
  },
  async createJob(body: JobCreate) {
    const params = actorEmail ? { actor: actorEmail } : {};
    return (await jnClient(apiKey).post('/jobs', body, { params })).data;
  }
});

