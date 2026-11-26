import crypto from 'node:crypto';
import type {
  ApprovalTicket,
  ChatMessage,
  OfficeEvent,
  OfficeStage,
} from '../../shared/types.js';
import { store } from '../db/store.js';
import { sseHub } from './sse.js';
import { runSecurityGuard, type UploadedFileInput } from './securityGuard.js';
import { generateSupportDraft, runFourModelJury } from './openrouter.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function emitOfficeEvent(
  stage: OfficeStage,
  ticketCode: string,
  orgSlug: 'real_estate' | 'cleaning',
  speaker: string,
  message: string,
  statusPill: string,
  jurorVotes?: OfficeEvent['jurorVotes']
) {
  sseHub.broadcast({
    id: `evt_${crypto.randomUUID().slice(0, 8)}`,
    stage,
    ticketCode,
    orgSlug,
    speaker,
    message,
    statusPill,
    jurorVotes,
    timestamp: new Date().toISOString(),
  });
}

async function logAudit(
  organizationId: string,
  ticketCode: string,
  actor: string,
  action: string,
  detail: string,
  level: 'info' | 'warn' | 'error' | 'success' = 'info'
) {
  await store.addAuditLog({
    id: `audit_${crypto.randomUUID().slice(0, 10)}`,
    organizationId,
    ticketCode,
    actor,
    action,
    detail,
    level,
    createdAt: new Date().toISOString(),
  });
}

export async function processIncomingCustomerMessage(params: {
  orgSlug: 'real_estate' | 'cleaning';
  customerName: string;
  customerPhone: string;
  messageText: string;
  channel: 'sms_sim' | 'twilio_sms';
  files: UploadedFileInput[];
}): Promise<ApprovalTicket> {
  const org = await store.getOrganizationBySlug(params.orgSlug);
  const otherSlug = params.orgSlug === 'cleaning' ? 'real_estate' : 'cleaning';
  const otherOrg = await store.getOrganizationBySlug(otherSlug);

  if (!org || !otherOrg) {
    throw new Error(`Organization not found: ${params.orgSlug}`);
  }

  const ticketId = `tkt_${crypto.randomUUID().slice(0, 10)}`;
  const ticketCode = await store.nextTicketCode();
  const now = new Date().toISOString();

  // Save initial ticket
  const ticket: ApprovalTicket = {
    id: ticketId,
    ticketCode,
    organizationId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    customerName: params.customerName || 'SMS Client',
    customerPhone: params.customerPhone || '+1 (305) 555-0199',
    channel: params.channel,
    incomingText: params.messageText,
    attachments: [],
    securityScans: [],
    securityVerdict: 'safe',
    extractedFacts: '',
    draftReply: '',
    finalReply: null,
    juryVerdicts: [],
    avgBrandScore: 0,
    avgContextScore: 0,
    avgOverallScore: 0,
    escalationReasons: [],
    status: 'processing',
    bossNote: null,
    attempts: 1,
    createdAt: now,
    resolvedAt: null,
  };
  await store.upsertTicket(ticket);

  // Stage 0: Incoming SMS
  emitOfficeEvent(
    'incoming_sms',
    ticketCode,
    org.slug,
    'INCOMING SMS GATEWAY',
    `New SMS for ${org.name} from ${ticket.customerName}${params.files.length > 0 ? ` (+${params.files.length} attachment)` : ''}. Routing to Security Desk...`,
    `${ticketCode} • INCOMING`
  );
  await logAudit(org.id, ticketCode, 'SMS Gateway', 'INCOMING_SMS', params.messageText.slice(0, 160), 'info');
  await sleep(450);

  // Stage 1: Security Guard ("El Segurata")
  emitOfficeEvent(
    'security_scanning',
    ticketCode,
    org.slug,
    'SECURITY DESK (DWIGHT)',
    `Scanning message, URLs, and ${params.files.length} file(s) with Magic-Byte Inspector, URLhaus, and VirusTotal v3...`,
    `${ticketCode} • SECURITY SCAN`
  );

  const security = await runSecurityGuard(ticketId, params.messageText, params.files);
  ticket.attachments = security.attachments;
  ticket.securityScans = security.scans;
  ticket.securityVerdict = security.overallVerdict;

  // Store customer chat message (with attachment metadata)
  const customerMsg: ChatMessage = {
    id: `msg_${crypto.randomUUID().slice(0, 10)}`,
    organizationId: org.id,
    orgSlug: org.slug,
    ticketId,
    sender: 'customer',
    text: params.messageText,
    attachments: security.attachments,
    createdAt: now,
  };
  await store.addMessage(customerMsg);

  await sleep(500);

  if (security.overallVerdict === 'blocked') {
    ticket.status = 'quarantined';
    ticket.escalationReasons = ['Blocked by Security Guard: malicious file, spoofed header, or dangerous link detected.'];
    ticket.resolvedAt = new Date().toISOString();
    await store.upsertTicket(ticket);

    const blockReason =
      security.scans
        .flatMap((s) => s.checks)
        .find((c) => c.status === 'fail')?.detail || 'Malicious payload quarantined.';

    emitOfficeEvent(
      'security_blocked',
      ticketCode,
      org.slug,
      'SECURITY DESK — RED ALERT!',
      `QUARANTINED! ${blockReason} Blocked before reaching AI agents.`,
      `${ticketCode} • BLOCKED`
    );

    await store.addMessage({
      id: `msg_${crypto.randomUUID().slice(0, 10)}`,
      organizationId: org.id,
      orgSlug: org.slug,
      ticketId,
      sender: 'system',
      text: `Security Shield Blocked Attachment/Link: ${blockReason}`,
      createdAt: new Date().toISOString(),
    });

    await logAudit(org.id, ticketCode, 'Security Guard', 'THREAT_QUARANTINED', blockReason, 'error');
    return ticket;
  }

  emitOfficeEvent(
    'security_passed',
    ticketCode,
    org.slug,
    'SECURITY DESK (DWIGHT)',
    security.overallVerdict === 'warning'
      ? 'Scan finished with MEDIUM warning (suspicious domain/TLD). Flagging for Boss review and passing to Reception.'
      : 'All files, magic bytes, and URLs cleared! Passing verified folder to Reception Desk.',
    `${ticketCode} • SCAN ${security.overallVerdict.toUpperCase()}`
  );
  await logAudit(
    org.id,
    ticketCode,
    'Security Guard',
    'SECURITY_SCAN_OK',
    `Verdict: ${security.overallVerdict.toUpperCase()} (${security.scans.length} target(s) verified).`,
    security.overallVerdict === 'warning' ? 'warn' : 'success'
  );
  await sleep(450);

  // Stage 2: Reception / Customer Support Agent
  emitOfficeEvent(
    'agent_drafting',
    ticketCode,
    org.slug,
    'RECEPTION AGENT (PAM)',
    `Reading ${org.name} isolated catalog${security.attachments.length > 0 ? ' + verified attachments' : ''} and drafting customer reply...`,
    `${ticketCode} • DRAFTING`
  );

  const supportResult = await generateSupportDraft({
    org,
    otherOrg,
    customerMessage: params.messageText,
    attachments: security.attachments,
    extractedFileNotes: security.extractedFileNotes,
  });

  ticket.extractedFacts = supportResult.extractedFacts;
  ticket.draftReply = supportResult.draft;
  await store.upsertTicket(ticket);
  await logAudit(org.id, ticketCode, 'Reception Agent', 'DRAFT_CREATED', ticket.draftReply.slice(0, 160), 'info');
  await sleep(450);

  // Stage 3: 4-Model AI Jury in Conference Room
  emitOfficeEvent(
    'jury_deliberating',
    ticketCode,
    org.slug,
    'CONFERENCE ROOM — 4-AI JURY',
    'Claude, Gemini, GPT & DeepSeek are deliberating on Brand Coherence and Message Context...',
    `${ticketCode} • JURY PANEL`
  );

  const verdicts = await runFourModelJury({
    org,
    otherOrg,
    customerMessage: params.messageText,
    draftReply: ticket.draftReply,
    hasAttachments: security.attachments.length > 0,
  });

  const avgBrand = Math.round(verdicts.reduce((s, v) => s + v.brandScore, 0) / verdicts.length);
  const avgContext = Math.round(verdicts.reduce((s, v) => s + v.contextScore, 0) / verdicts.length);
  const avgOverall = Math.round(verdicts.reduce((s, v) => s + v.overallScore, 0) / verdicts.length);

  ticket.juryVerdicts = verdicts;
  ticket.avgBrandScore = avgBrand;
  ticket.avgContextScore = avgContext;
  ticket.avgOverallScore = avgOverall;

  // Determine Escalation Reasons
  const reasons: string[] = [];
  if (org.approvalMode === 'baa') {
    reasons.push('BAA Mode (Boss Approves All) is active for this business.');
  }
  if (security.overallVerdict === 'warning') {
    reasons.push('Security Guard raised a medium-risk URL/file warning.');
  }
  if (avgOverall < org.minJuryScore) {
    reasons.push(`Jury consensus (${avgOverall}/100) is below minimum threshold (${org.minJuryScore}/100).`);
  }
  const escalateVotes = verdicts.filter((v) => v.vote === 'escalate' || v.vote === 'revise');
  if (escalateVotes.length > 0) {
    reasons.push(`${escalateVotes.length}/4 AI Jurors requested review (${escalateVotes.map((v) => v.jurorId.toUpperCase()).join(', ')}).`);
  }
  const lowerMsg = params.messageText.toLowerCase();
  const matchedKeywords = org.sensitiveKeywords.filter((kw) => lowerMsg.includes(kw.toLowerCase()));
  if (matchedKeywords.length > 0) {
    reasons.push(`Sensitive keyword(s) triggered: ${matchedKeywords.join(', ')}.`);
  }

  ticket.escalationReasons = reasons;

  await logAudit(
    org.id,
    ticketCode,
    '4-AI Jury',
    'JURY_VERDICT',
    `Brand: ${avgBrand}/100 | Context: ${avgContext}/100 | Overall: ${avgOverall}/100 | Escalations: ${reasons.length}`,
    reasons.length > 0 ? 'warn' : 'success'
  );

  await sleep(550);

  // Stage 4: Auto-Pilot vs Boss Corner Office (HITL)
  const shouldAutoSend = org.approvalMode === 'auto_pilot' && reasons.length === 0;

  if (shouldAutoSend) {
    ticket.status = 'auto_sent';
    ticket.finalReply = ticket.draftReply;
    ticket.resolvedAt = new Date().toISOString();
    await store.upsertTicket(ticket);

    await store.addMessage({
      id: `msg_${crypto.randomUUID().slice(0, 10)}`,
      organizationId: org.id,
      orgSlug: org.slug,
      ticketId,
      sender: 'agent',
      text: ticket.finalReply,
      badge: `${org.name} • Auto-Pilot Sent (Jury ${avgOverall}/100)`,
      createdAt: new Date().toISOString(),
    });

    emitOfficeEvent(
      'auto_sent',
      ticketCode,
      org.slug,
      'AUTO-PILOT DISPATCH',
      `Unanimous Jury approval (${avgOverall}/100) + Clean Security Scan! Reply sent directly to customer SMS.`,
      `${ticketCode} • AUTO-SENT`,
      verdicts
    );

    await logAudit(org.id, ticketCode, 'Auto-Pilot', 'SMS_AUTO_SENT', `Delivered automatically with ${avgOverall}/100 jury score.`, 'success');
  } else {
    ticket.status = 'pending_boss';
    await store.upsertTicket(ticket);

    emitOfficeEvent(
      'boss_pending',
      ticketCode,
      org.slug,
      'BOSS CORNER OFFICE — APPROVAL NEEDED',
      `Folder delivered to Boss desk! ${reasons[0] || 'Awaiting manual sign-off on PC or iPhone.'}`,
      `${ticketCode} • BOSS QUEUE`,
      verdicts
    );

    await logAudit(
      org.id,
      ticketCode,
      'Boss Office',
      'QUEUED_FOR_BOSS',
      reasons.join(' '),
      'warn'
    );
  }

  return ticket;
}

export async function resolveBossDecision(params: {
  ticketId: string;
  action: 'approve' | 'edit_send' | 'rewrite' | 'reject';
  editedReply?: string;
  bossNote?: string;
}): Promise<ApprovalTicket> {
  const ticket = await store.getTicketById(params.ticketId);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const org = await store.getOrganizationBySlug(ticket.orgSlug);
  const otherOrg = await store.getOrganizationBySlug(ticket.orgSlug === 'cleaning' ? 'real_estate' : 'cleaning');
  if (!org || !otherOrg) {
    throw new Error('Organization not found');
  }

  if (params.action === 'rewrite') {
    ticket.attempts += 1;
    ticket.bossNote = params.bossNote || 'Please refine tone and verify pricing.';
    ticket.status = 'processing';
    await store.upsertTicket(ticket);

    emitOfficeEvent(
      'jury_rewrite',
      ticket.ticketCode,
      ticket.orgSlug,
      'BOSS → RECEPTION REWRITE',
      `Boss requested rewrite: "${ticket.bossNote}". Reception & 4-AI Jury are regenerating the reply...`,
      `${ticket.ticketCode} • REWRITING`
    );

    const newDraft = await generateSupportDraft({
      org,
      otherOrg,
      customerMessage: ticket.incomingText,
      attachments: ticket.attachments,
      extractedFileNotes: [],
      bossInstruction: ticket.bossNote,
    });
    const newVerdicts = await runFourModelJury({
      org,
      otherOrg,
      customerMessage: ticket.incomingText,
      draftReply: newDraft.draft,
      hasAttachments: ticket.attachments.length > 0,
    });

    ticket.draftReply = newDraft.draft;
    ticket.juryVerdicts = newVerdicts;
    ticket.avgBrandScore = Math.round(newVerdicts.reduce((s, v) => s + v.brandScore, 0) / newVerdicts.length);
    ticket.avgContextScore = Math.round(newVerdicts.reduce((s, v) => s + v.contextScore, 0) / newVerdicts.length);
    ticket.avgOverallScore = Math.round(newVerdicts.reduce((s, v) => s + v.overallScore, 0) / newVerdicts.length);
    ticket.status = 'pending_boss';
    await store.upsertTicket(ticket);

    emitOfficeEvent(
      'boss_pending',
      ticket.ticketCode,
      ticket.orgSlug,
      'BOSS CORNER OFFICE — REVISED DRAFT READY',
      `Attempt #${ticket.attempts} re-audited by Jury (${ticket.avgOverallScore}/100). Ready for Boss sign-off!`,
      `${ticket.ticketCode} • BOSS QUEUE`,
      newVerdicts
    );

    await logAudit(org.id, ticket.ticketCode, 'Regional Boss', 'REQUESTED_REWRITE', ticket.bossNote, 'info');
    return ticket;
  }

  if (params.action === 'reject') {
    ticket.status = 'rejected';
    ticket.bossNote = params.bossNote || 'Rejected by Boss — not sent to customer.';
    ticket.resolvedAt = new Date().toISOString();
    await store.upsertTicket(ticket);

    await store.addMessage({
      id: `msg_${crypto.randomUUID().slice(0, 10)}`,
      organizationId: org.id,
      orgSlug: org.slug,
      ticketId: ticket.id,
      sender: 'system',
      text: `Ticket ${ticket.ticketCode} was held/rejected by the Regional Boss.`,
      createdAt: new Date().toISOString(),
    });

    emitOfficeEvent(
      'boss_rejected',
      ticket.ticketCode,
      ticket.orgSlug,
      'BOSS CORNER OFFICE',
      `Ticket ${ticket.ticketCode} rejected by Boss. Outgoing SMS cancelled.`,
      `${ticket.ticketCode} • REJECTED`
    );

    await logAudit(org.id, ticket.ticketCode, 'Regional Boss', 'TICKET_REJECTED', ticket.bossNote, 'error');
    return ticket;
  }

  // Approve or Edit & Send
  const finalText =
    params.action === 'edit_send' && params.editedReply?.trim()
      ? params.editedReply.trim()
      : ticket.draftReply;

  ticket.finalReply = finalText;
  ticket.bossNote = params.bossNote || null;
  ticket.status = 'approved_sent';
  ticket.resolvedAt = new Date().toISOString();
  await store.upsertTicket(ticket);

  await store.addMessage({
    id: `msg_${crypto.randomUUID().slice(0, 10)}`,
    organizationId: org.id,
    orgSlug: org.slug,
    ticketId: ticket.id,
    sender: 'agent',
    text: finalText,
    badge: `${org.name} • Approved by Boss ✓`,
    createdAt: new Date().toISOString(),
  });

  emitOfficeEvent(
    'boss_approved',
    ticket.ticketCode,
    ticket.orgSlug,
    'BOSS CORNER OFFICE — APPROVED!',
    `Stamp approved! Official SMS dispatched to ${ticket.customerName}.`,
    `${ticket.ticketCode} • SENT`
  );

  await logAudit(
    org.id,
    ticket.ticketCode,
    'Regional Boss',
    params.action === 'edit_send' ? 'EDITED_AND_APPROVED' : 'APPROVED_AND_SENT',
    finalText.slice(0, 160),
    'success'
  );

  return ticket;
}
