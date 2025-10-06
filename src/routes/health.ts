import { Router, Request, Response } from 'express';
export const health = Router();
health.get('/health', (_req: Request, res: Response) => res.json({ ok: true, ts: Date.now() }));

