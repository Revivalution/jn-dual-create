// Local dev entrypoint only. Vercel uses api/index.ts (serverless)
import { app } from './server.js';
import { cfg } from './config.js';
import { log } from './libs/logger.js';

app.listen(cfg.port, () => log.info(`jn-dual-create listening on :${cfg.port}`));

