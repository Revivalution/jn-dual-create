import { jnClient } from './http.js';

// NOTE: Field names can vary by tenant/version. These are safe defaults.
// Verify against the official Postman docs in your org.
export type ContactCreate = {
  // Minimal fields—adapt to your schema:
  firstName?: string;
  lastName?: string;
  displayName?: string; // often unique in JN
  name?: string;        // some tenants expose 'name' instead
  type?: string;
  status?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string; city?: string; state?: string; postalCode?: string;
  };
};

export type JobCreate = {
  contactId: string;      // AKA primary contact/customer id
  name?: string;
  type?: string;
  status?: string;
  address?: {
    street?: string; city?: string; state?: string; postalCode?: string;
  };
};

export const JobNimbus = (apiKey?: string) => ({
  async searchContacts(q: { phone?: string; email?: string; name?: string }) {
    // Replace params to match your tenant's search semantics.
    return (await jnClient(apiKey).get('/contacts', { params: q })).data;
  },
  async getContact(id: string) {
    return (await jnClient(apiKey).get(`/contacts/${id}`)).data;
  },
  async createContact(body: ContactCreate) {
    return (await jnClient(apiKey).post('/contacts', body)).data;
  },
  async getJob(id: string) {
    return (await jnClient(apiKey).get(`/jobs/${id}`)).data;
  },
  async createJob(body: JobCreate) {
    return (await jnClient(apiKey).post('/jobs', body)).data;
  }
});

