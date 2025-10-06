import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverlessHttp from 'serverless-http';
import { app } from '../src/server.js';

const handler = serverlessHttp(app);

export default async function (req: VercelRequest, res: VercelResponse) {
  // @ts-ignore serverless-http accepts (req,res)
  return handler(req, res);
}

