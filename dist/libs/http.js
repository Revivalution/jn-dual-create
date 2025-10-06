import axios from 'axios';
import { cfg } from '../config.js';
// In serverless, prefer x-jn-api-key header per request (multi-tenant).
// cfg.jnKey remains a fallback for local dev.
export function jnClient(apiKey) {
    const key = apiKey || cfg.jnKey;
    return axios.create({
        baseURL: cfg.jnBase,
        timeout: 15000,
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        }
    });
}
