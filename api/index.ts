import serverlessHttp from 'serverless-http';
import { app } from '../src/server.js';

// Wrap Express app for Vercel serverless
export default serverlessHttp(app);

