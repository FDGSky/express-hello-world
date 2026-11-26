import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { store } from './db/store.js';
import { apiRouter } from './routes/api.js';
import { twilioRouter } from './routes/twilio.js';

const PORT = Number(process.env.PORT || 3001);

async function startServer() {
  await store.init();

  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      frameguard: false,
    })
  );
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Rate limit API endpoints to protect AI & VirusTotal quotas
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use('/api/webhooks/twilio', twilioRouter);
  app.use('/api', apiRouter);

  // Serve built React frontend in production
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Mini Office AI] Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Mini Office AI] Fatal startup error:', err);
  process.exit(1);
});
