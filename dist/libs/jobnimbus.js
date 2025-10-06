import { jnClient } from './http.js';
export const JobNimbus = {
    async searchContacts(q, apiKey) {
        // Replace params to match your tenant’s search semantics.
        return (await jnClient(apiKey).get('/contacts', { params: q })).data;
    },
    async getContact(id, apiKey) {
        return (await jnClient(apiKey).get(`/contacts/${id}`)).data;
    },
    async createContact(body, apiKey) {
        return (await jnClient(apiKey).post('/contacts', body)).data;
    },
    async getJob(id, apiKey) {
        return (await jnClient(apiKey).get(`/jobs/${id}`)).data;
    },
    async createJob(body, apiKey) {
        return (await jnClient(apiKey).post('/jobs', body)).data;
    }
};
