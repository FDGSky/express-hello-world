import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { store } from '../db/store.js';
import { sseHub } from '../services/sse.js';
import { processIncomingCustomerMessage, resolveBossDecision } from '../services/pipeline.js';
import { getAiUsageStats } from '../services/openrouter.js';
import type { BootstrapPayload, SystemStatus } from '../../shared/types.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 3,
  },
});

export const apiRouter = Router();

function getSystemStatus(): SystemStatus {
  const ai = getAiUsageStats();
  return {
    database: store.isNeonConnected ? 'neon_connected' : 'memory_fallback',
    aiEngine: ai.liveOpenRouter ? 'openrouter_live' : 'smart_simulation',
    virusTotal: process.env.VIRUSTOTAL_API_KEY?.trim() ? 'connected' : 'local_and_urlhaus_only',
    twilioReady: Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim()),
    accessGateEnabled: Boolean(process.env.DEMO_ACCESS_CODE?.trim()),
    dailyAiCalls: ai.dailyAiCalls,
    dailyAiBudget: ai.dailyAiBudget,
    timezone: 'America/New_York (EST UTC-5)',
    currency: 'USD',
  };
}

// Optional Access Code Gate (only enforced if DEMO_ACCESS_CODE is set in env)
function isUnlocked(req: Request): boolean {
  const code = process.env.DEMO_ACCESS_CODE?.trim();
  if (!code) return true;
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/mini_office_gate=([^;]+)/);
  return match?.[1] === encodeURIComponent(code);
}

apiRouter.get('/auth/check', (req: Request, res: Response) => {
  res.json({
    gateEnabled: Boolean(process.env.DEMO_ACCESS_CODE?.trim()),
    unlocked: isUnlocked(req),
  });
});

apiRouter.post('/auth/unlock', (req: Request, res: Response) => {
  const expected = process.env.DEMO_ACCESS_CODE?.trim();
  if (!expected) {
    res.json({ unlocked: true });
    return;
  }
  const provided = String(req.body?.code || '').trim();
  if (provided !== expected) {
    res.status(401).json({ error: 'Invalid demo access code.' });
    return;
  }
  res.setHeader(
    'Set-Cookie',
    `mini_office_gate=${encodeURIComponent(expected)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );
  res.json({ unlocked: true });
});

// Gate middleware for all subsequent API endpoints
apiRouter.use((req, res, next) => {
  if (!isUnlocked(req)) {
    res.status(401).json({ error: 'Demo access code required.' });
    return;
  }
  next();
});

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ...getSystemStatus() });
});

apiRouter.get('/bootstrap', async (_req: Request, res: Response) => {
  const [organizations, messages, tickets, auditLogs] = await Promise.all([
    store.getOrganizations(),
    store.getMessages(),
    store.getTickets(),
    store.getAuditLogs(),
  ]);
  const payload: BootstrapPayload = {
    organizations,
    messages,
    tickets,
    auditLogs,
    status: getSystemStatus(),
  };
  res.json(payload);
});

apiRouter.get('/events', (_req: Request, res: Response) => {
  sseHub.addClient(res);
});

apiRouter.post('/messages/send', upload.array('files', 3), async (req: Request, res: Response) => {
  try {
    const orgSlug = req.body?.orgSlug === 'real_estate' ? 'real_estate' : 'cleaning';
    const messageText = String(req.body?.messageText || '').trim();
    const customerName = String(req.body?.customerName || 'SMS Client').trim();
    const customerPhone = String(req.body?.customerPhone || '+1 (305) 555-0199').trim();
    const uploadedFiles = ((req.files as Express.Multer.File[]) || []).map((f) => ({
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      buffer: f.buffer,
    }));

    if (!messageText && uploadedFiles.length === 0) {
      res.status(400).json({ error: 'Message text or at least one file is required.' });
      return;
    }

    const ticket = await processIncomingCustomerMessage({
      orgSlug,
      customerName,
      customerPhone,
      messageText: messageText || `[Sent ${uploadedFiles.length} attachment(s)]`,
      channel: 'sms_sim',
      files: uploadedFiles,
    });

    res.status(201).json({ ticket });
  } catch (err) {
    console.error('[API] /messages/send error:', err);
    res.status(500).json({ error: (err as Error).message || 'Failed to process message.' });
  }
});

const decisionSchema = z.object({
  action: z.enum(['approve', 'edit_send', 'rewrite', 'reject']),
  editedReply: z.string().max(2000).optional(),
  bossNote: z.string().max(500).optional(),
});

apiRouter.post('/tickets/:id/decision', async (req: Request, res: Response) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid decision payload', issues: parsed.error.issues });
    return;
  }
  try {
    const ticket = await resolveBossDecision({
      ticketId: String(req.params.id),
      ...parsed.data,
    });
    res.json({ ticket });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

const orgUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  brandGuidelines: z.string().max(2000).optional(),
  pricingCatalog: z.string().max(2000).optional(),
  calendarSlots: z.string().max(1000).optional(),
  forbiddenTopics: z.string().max(1000).optional(),
  approvalMode: z.enum(['auto_pilot', 'baa']).optional(),
  minJuryScore: z.number().int().min(50).max(100).optional(),
  sensitiveKeywords: z.array(z.string().min(1).max(40)).max(30).optional(),
});

apiRouter.patch('/organizations/:slug', async (req: Request, res: Response) => {
  const slug = req.params.slug === 'real_estate' ? 'real_estate' : req.params.slug === 'cleaning' ? 'cleaning' : null;
  if (!slug) {
    res.status(400).json({ error: 'Unknown organization slug.' });
    return;
  }
  const parsed = orgUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid organization settings', issues: parsed.error.issues });
    return;
  }
  const updated = await store.updateOrganization(slug, parsed.data);
  if (!updated) {
    res.status(404).json({ error: 'Organization not found.' });
    return;
  }
  await store.addAuditLog({
    id: `audit_${Date.now()}`,
    organizationId: updated.id,
    ticketCode: null,
    actor: 'Regional Boss',
    action: 'RULES_UPDATED',
    detail: `Updated ${updated.name}: mode=${updated.approvalMode.toUpperCase()}, minJuryScore=${updated.minJuryScore}.`,
    level: 'info',
    createdAt: new Date().toISOString(),
  });
  res.json({ organization: updated });
});

apiRouter.post('/demo/reset', async (_req: Request, res: Response) => {
  await store.resetDemo();
  res.json({ ok: true });
});
