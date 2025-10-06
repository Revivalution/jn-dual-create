import express from 'express';
import cors from 'cors';
import { health } from './routes/health.js';
import { dualCreate } from './routes/dualCreate.js';
import { log } from './libs/logger.js';
export const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
// Multi-tenant headers (validated in route):
// - x-jn-api-key: per-company JobNimbus key
// - x-app-token: shared app secret (set in env on Vercel)
app.use((req, _res, next) => {
    // minimal request logging without sensitive data
    log.info({ path: req.path, method: req.method }, 'req');
    next();
});
app.use(health);
app.use(dualCreate);
// Basic error handler
app.use((err, _req, res, _next) => {
    log.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
});
