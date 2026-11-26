import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import type {
  Organization,
  ChatMessage,
  ApprovalTicket,
  AuditLogEntry,
  ApprovalMode,
} from '../../shared/types.js';
import { SEED_ORGANIZATIONS, SEED_MESSAGES, SEED_AUDIT_LOGS } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataStore {
  private pool: Pool | null = null;
  private useNeon = false;

  // In-memory fallback collections (used only if DATABASE_URL is not configured)
  private memOrgs: Organization[] = structuredClone(SEED_ORGANIZATIONS);
  private memMessages: ChatMessage[] = structuredClone(SEED_MESSAGES);
  private memTickets: ApprovalTicket[] = [];
  private memAuditLogs: AuditLogEntry[] = structuredClone(SEED_AUDIT_LOGS);
  private ticketCounter = 1001;

  public get isNeonConnected(): boolean {
    return this.useNeon;
  }

  public async init(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL?.trim();
    if (!dbUrl) {
      console.log('[DB] DATABASE_URL not set — running in Memory Fallback mode (add Neon DATABASE_URL in .env to persist).');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') ? undefined : { rejectUnauthorized: false },
        max: 8,
        idleTimeoutMillis: 30000,
      });

      await this.pool.query('SELECT 1');

      // Locate schema.sql (works in both tsx dev and compiled dist-server)
      const candidates = [
        path.resolve(__dirname, 'schema.sql'),
        path.resolve(process.cwd(), 'src/server/db/schema.sql'),
      ];
      const schemaPath = candidates.find((p) => fs.existsSync(p));
      if (!schemaPath) {
        throw new Error('schema.sql not found');
      }
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await this.pool.query(sql);

      this.useNeon = true;
      await this.seedNeonIfEmpty();
      console.log('[DB] Connected to Neon PostgreSQL and verified schema.');
    } catch (err) {
      console.error('[DB] Failed to connect to Neon PostgreSQL, falling back to memory:', err);
      this.useNeon = false;
      this.pool = null;
    }
  }

  private async seedNeonIfEmpty(): Promise<void> {
    if (!this.pool) return;
    const { rows } = await this.pool.query('SELECT COUNT(*)::int AS count FROM organizations');
    if (rows[0].count > 0) return;

    for (const org of SEED_ORGANIZATIONS) {
      await this.pool.query(
        `INSERT INTO organizations (
          id, slug, name, industry, tagline, phone_number, accent_color,
          brand_guidelines, pricing_catalog, calendar_slots, forbidden_topics,
          approval_mode, min_jury_score, sensitive_keywords
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
        ON CONFLICT (id) DO NOTHING`,
        [
          org.id,
          org.slug,
          org.name,
          org.industry,
          org.tagline,
          org.phoneNumber,
          org.accentColor,
          org.brandGuidelines,
          org.pricingCatalog,
          org.calendarSlots,
          org.forbiddenTopics,
          org.approvalMode,
          org.minJuryScore,
          JSON.stringify(org.sensitiveKeywords),
        ]
      );
    }

    // Default boss user ready for future staff/delegators
    await this.pool.query(
      `INSERT INTO users (id, organization_id, name, email, role)
       VALUES ('user_boss_01', 'org_cleaning_01', 'Regional Boss (Admin)', 'boss@minioffice.demo', 'boss')
       ON CONFLICT (id) DO NOTHING`
    );

    for (const msg of SEED_MESSAGES) {
      await this.addMessage(msg);
    }
    for (const log of SEED_AUDIT_LOGS) {
      await this.addAuditLog(log);
    }
  }

  public async nextTicketCode(): Promise<string> {
    if (this.useNeon && this.pool) {
      const { rows } = await this.pool.query('SELECT COUNT(*)::int AS count FROM approval_tickets');
      return `T-${1001 + rows[0].count}`;
    }
    return `T-${this.ticketCounter++}`;
  }

  public async getOrganizations(): Promise<Organization[]> {
    if (this.useNeon && this.pool) {
      const { rows } = await this.pool.query('SELECT * FROM organizations ORDER BY slug ASC');
      return rows.map(mapOrgRow);
    }
    return this.memOrgs;
  }

  public async getOrganizationBySlug(slug: 'real_estate' | 'cleaning'): Promise<Organization | null> {
    const orgs = await this.getOrganizations();
    return orgs.find((o) => o.slug === slug) ?? null;
  }

  public async updateOrganization(
    slug: 'real_estate' | 'cleaning',
    patch: Partial<{
      name: string;
      brandGuidelines: string;
      pricingCatalog: string;
      calendarSlots: string;
      forbiddenTopics: string;
      approvalMode: ApprovalMode;
      minJuryScore: number;
      sensitiveKeywords: string[];
    }>
  ): Promise<Organization | null> {
    const existing = await this.getOrganizationBySlug(slug);
    if (!existing) return null;

    const updated: Organization = {
      ...existing,
      ...patch,
    };

    if (this.useNeon && this.pool) {
      await this.pool.query(
        `UPDATE organizations SET
          name = $1,
          brand_guidelines = $2,
          pricing_catalog = $3,
          calendar_slots = $4,
          forbidden_topics = $5,
          approval_mode = $6,
          min_jury_score = $7,
          sensitive_keywords = $8::jsonb
         WHERE slug = $9`,
        [
          updated.name,
          updated.brandGuidelines,
          updated.pricingCatalog,
          updated.calendarSlots,
          updated.forbiddenTopics,
          updated.approvalMode,
          updated.minJuryScore,
          JSON.stringify(updated.sensitiveKeywords),
          slug,
        ]
      );
      return updated;
    }

    this.memOrgs = this.memOrgs.map((o) => (o.slug === slug ? updated : o));
    return updated;
  }

  public async getMessages(orgSlug?: string): Promise<ChatMessage[]> {
    if (this.useNeon && this.pool) {
      const res = orgSlug
        ? await this.pool.query(
            'SELECT * FROM chat_messages WHERE org_slug = $1 ORDER BY created_at ASC LIMIT 200',
            [orgSlug]
          )
        : await this.pool.query('SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT 300');
      return res.rows.map(mapMessageRow);
    }
    return orgSlug ? this.memMessages.filter((m) => m.orgSlug === orgSlug) : this.memMessages;
  }

  public async addMessage(msg: ChatMessage): Promise<ChatMessage> {
    if (this.useNeon && this.pool) {
      await this.pool.query(
        `INSERT INTO chat_messages (id, organization_id, org_slug, ticket_id, sender, text, attachments, badge, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
        [
          msg.id,
          msg.organizationId,
          msg.orgSlug,
          msg.ticketId ?? null,
          msg.sender,
          msg.text,
          JSON.stringify(msg.attachments ?? []),
          msg.badge ?? null,
          msg.createdAt,
        ]
      );
      return msg;
    }
    this.memMessages.push(msg);
    return msg;
  }

  public async getTickets(): Promise<ApprovalTicket[]> {
    if (this.useNeon && this.pool) {
      const { rows } = await this.pool.query(
        'SELECT * FROM approval_tickets ORDER BY created_at DESC LIMIT 100'
      );
      return rows.map(mapTicketRow);
    }
    return [...this.memTickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async getTicketById(id: string): Promise<ApprovalTicket | null> {
    if (this.useNeon && this.pool) {
      const { rows } = await this.pool.query('SELECT * FROM approval_tickets WHERE id = $1', [id]);
      return rows[0] ? mapTicketRow(rows[0]) : null;
    }
    return this.memTickets.find((t) => t.id === id) ?? null;
  }

  public async upsertTicket(ticket: ApprovalTicket): Promise<ApprovalTicket> {
    if (this.useNeon && this.pool) {
      await this.pool.query(
        `INSERT INTO approval_tickets (
          id, ticket_code, organization_id, org_slug, org_name, customer_name, customer_phone,
          channel, incoming_text, attachments, security_scans, security_verdict,
          extracted_facts, draft_reply, final_reply, jury_verdicts,
          avg_brand_score, avg_context_score, avg_overall_score,
          escalation_reasons, status, boss_note, attempts, created_at, resolved_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16::jsonb,
          $17,$18,$19,$20::jsonb,$21,$22,$23,$24,$25
        )
        ON CONFLICT (id) DO UPDATE SET
          attachments = EXCLUDED.attachments,
          security_scans = EXCLUDED.security_scans,
          security_verdict = EXCLUDED.security_verdict,
          extracted_facts = EXCLUDED.extracted_facts,
          draft_reply = EXCLUDED.draft_reply,
          final_reply = EXCLUDED.final_reply,
          jury_verdicts = EXCLUDED.jury_verdicts,
          avg_brand_score = EXCLUDED.avg_brand_score,
          avg_context_score = EXCLUDED.avg_context_score,
          avg_overall_score = EXCLUDED.avg_overall_score,
          escalation_reasons = EXCLUDED.escalation_reasons,
          status = EXCLUDED.status,
          boss_note = EXCLUDED.boss_note,
          attempts = EXCLUDED.attempts,
          resolved_at = EXCLUDED.resolved_at`,
        [
          ticket.id,
          ticket.ticketCode,
          ticket.organizationId,
          ticket.orgSlug,
          ticket.orgName,
          ticket.customerName,
          ticket.customerPhone,
          ticket.channel,
          ticket.incomingText,
          JSON.stringify(ticket.attachments),
          JSON.stringify(ticket.securityScans),
          ticket.securityVerdict,
          ticket.extractedFacts,
          ticket.draftReply,
          ticket.finalReply,
          JSON.stringify(ticket.juryVerdicts),
          ticket.avgBrandScore,
          ticket.avgContextScore,
          ticket.avgOverallScore,
          JSON.stringify(ticket.escalationReasons),
          ticket.status,
          ticket.bossNote,
          ticket.attempts,
          ticket.createdAt,
          ticket.resolvedAt,
        ]
      );
      return ticket;
    }

    const idx = this.memTickets.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) this.memTickets[idx] = ticket;
    else this.memTickets.unshift(ticket);
    return ticket;
  }

  public async getAuditLogs(): Promise<AuditLogEntry[]> {
    if (this.useNeon && this.pool) {
      const { rows } = await this.pool.query(
        'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 150'
      );
      return rows.map(mapAuditRow);
    }
    return [...this.memAuditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 150);
  }

  public async addAuditLog(entry: AuditLogEntry): Promise<AuditLogEntry> {
    if (this.useNeon && this.pool) {
      await this.pool.query(
        `INSERT INTO audit_logs (id, organization_id, ticket_code, actor, action, detail, level, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          entry.id,
          entry.organizationId,
          entry.ticketCode,
          entry.actor,
          entry.action,
          entry.detail,
          entry.level,
          entry.createdAt,
        ]
      );
      return entry;
    }
    this.memAuditLogs.unshift(entry);
    return entry;
  }

  public async resetDemo(): Promise<void> {
    if (this.useNeon && this.pool) {
      await this.pool.query('TRUNCATE chat_messages, approval_tickets, audit_logs RESTART IDENTITY CASCADE');
      await this.pool.query('DELETE FROM organizations');
      await this.seedNeonIfEmpty();
      return;
    }
    this.memOrgs = structuredClone(SEED_ORGANIZATIONS);
    this.memMessages = structuredClone(SEED_MESSAGES);
    this.memTickets = [];
    this.memAuditLogs = structuredClone(SEED_AUDIT_LOGS);
    this.ticketCounter = 1001;
  }
}

function mapOrgRow(r: Record<string, unknown>): Organization {
  return {
    id: String(r.id),
    slug: r.slug as 'real_estate' | 'cleaning',
    name: String(r.name),
    industry: r.industry as 'real_estate' | 'cleaning',
    tagline: String(r.tagline),
    phoneNumber: String(r.phone_number),
    accentColor: String(r.accent_color),
    brandGuidelines: String(r.brand_guidelines),
    pricingCatalog: String(r.pricing_catalog),
    calendarSlots: String(r.calendar_slots),
    forbiddenTopics: String(r.forbidden_topics),
    approvalMode: r.approval_mode as ApprovalMode,
    minJuryScore: Number(r.min_jury_score),
    sensitiveKeywords: Array.isArray(r.sensitive_keywords) ? (r.sensitive_keywords as string[]) : [],
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

function mapMessageRow(r: Record<string, unknown>): ChatMessage {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    orgSlug: r.org_slug as 'real_estate' | 'cleaning',
    ticketId: r.ticket_id ? String(r.ticket_id) : undefined,
    sender: r.sender as 'customer' | 'agent' | 'system',
    text: String(r.text),
    attachments: Array.isArray(r.attachments) ? (r.attachments as ChatMessage['attachments']) : [],
    badge: r.badge ? String(r.badge) : undefined,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

function mapTicketRow(r: Record<string, unknown>): ApprovalTicket {
  return {
    id: String(r.id),
    ticketCode: String(r.ticket_code),
    organizationId: String(r.organization_id),
    orgSlug: r.org_slug as 'real_estate' | 'cleaning',
    orgName: String(r.org_name),
    customerName: String(r.customer_name),
    customerPhone: String(r.customer_phone),
    channel: r.channel as 'sms_sim' | 'twilio_sms',
    incomingText: String(r.incoming_text),
    attachments: Array.isArray(r.attachments) ? (r.attachments as ApprovalTicket['attachments']) : [],
    securityScans: Array.isArray(r.security_scans) ? (r.security_scans as ApprovalTicket['securityScans']) : [],
    securityVerdict: r.security_verdict as ApprovalTicket['securityVerdict'],
    extractedFacts: String(r.extracted_facts ?? ''),
    draftReply: String(r.draft_reply ?? ''),
    finalReply: r.final_reply ? String(r.final_reply) : null,
    juryVerdicts: Array.isArray(r.jury_verdicts) ? (r.jury_verdicts as ApprovalTicket['juryVerdicts']) : [],
    avgBrandScore: Number(r.avg_brand_score ?? 0),
    avgContextScore: Number(r.avg_context_score ?? 0),
    avgOverallScore: Number(r.avg_overall_score ?? 0),
    escalationReasons: Array.isArray(r.escalation_reasons) ? (r.escalation_reasons as string[]) : [],
    status: r.status as ApprovalTicket['status'],
    bossNote: r.boss_note ? String(r.boss_note) : null,
    attempts: Number(r.attempts ?? 1),
    createdAt: new Date(String(r.created_at)).toISOString(),
    resolvedAt: r.resolved_at ? new Date(String(r.resolved_at)).toISOString() : null,
  };
}

function mapAuditRow(r: Record<string, unknown>): AuditLogEntry {
  return {
    id: String(r.id),
    organizationId: r.organization_id ? String(r.organization_id) : null,
    ticketCode: r.ticket_code ? String(r.ticket_code) : null,
    actor: String(r.actor),
    action: String(r.action),
    detail: String(r.detail),
    level: r.level as AuditLogEntry['level'],
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

export const store = new DataStore();
