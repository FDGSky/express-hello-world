export type ApprovalMode = 'auto_pilot' | 'baa';
export type IndustryType = 'real_estate' | 'cleaning';
export type SecurityVerdict = 'safe' | 'warning' | 'blocked';
export type TicketStatus =
  | 'processing'
  | 'quarantined'
  | 'pending_boss'
  | 'auto_sent'
  | 'approved_sent'
  | 'rejected';

export type JurorId = 'claude' | 'gemini' | 'gpt' | 'deepseek';
export type JurorVote = 'approve' | 'revise' | 'escalate';

export interface Organization {
  id: string;
  slug: 'real_estate' | 'cleaning';
  name: string;
  industry: IndustryType;
  tagline: string;
  phoneNumber: string;
  accentColor: string;
  brandGuidelines: string;
  pricingCatalog: string;
  calendarSlots: string;
  forbiddenTopics: string;
  approvalMode: ApprovalMode;
  minJuryScore: number;
  sensitiveKeywords: string[];
  createdAt: string;
}

export interface AttachmentRecord {
  id: string;
  filename: string;
  mimeType: string;
  detectedType: string;
  sizeBytes: number;
  sha256: string;
  previewDataUrl?: string;
  verdict: SecurityVerdict;
  summary: string;
}

export interface SecurityCheckDetail {
  engine: string;
  status: 'pass' | 'warn' | 'fail' | 'skipped';
  detail: string;
}

export interface SecurityScanRecord {
  id: string;
  ticketId: string;
  targetType: 'file' | 'url' | 'message';
  targetValue: string;
  verdict: SecurityVerdict;
  riskScore: number;
  checks: SecurityCheckDetail[];
  scannedAt: string;
}

export interface JurorVerdict {
  jurorId: JurorId;
  jurorName: string;
  modelId: string;
  brandScore: number;
  contextScore: number;
  overallScore: number;
  vote: JurorVote;
  reasoning: string;
  suggestedFix?: string;
  simulated: boolean;
}

export interface ApprovalTicket {
  id: string;
  ticketCode: string;
  organizationId: string;
  orgSlug: 'real_estate' | 'cleaning';
  orgName: string;
  customerName: string;
  customerPhone: string;
  channel: 'sms_sim' | 'twilio_sms';
  incomingText: string;
  attachments: AttachmentRecord[];
  securityScans: SecurityScanRecord[];
  securityVerdict: SecurityVerdict;
  extractedFacts: string;
  draftReply: string;
  finalReply: string | null;
  juryVerdicts: JurorVerdict[];
  avgBrandScore: number;
  avgContextScore: number;
  avgOverallScore: number;
  escalationReasons: string[];
  status: TicketStatus;
  bossNote: string | null;
  attempts: number;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ChatMessage {
  id: string;
  organizationId: string;
  orgSlug: 'real_estate' | 'cleaning';
  ticketId?: string;
  sender: 'customer' | 'agent' | 'system';
  text: string;
  attachments?: AttachmentRecord[];
  badge?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string | null;
  ticketCode: string | null;
  actor: string;
  action: string;
  detail: string;
  level: 'info' | 'warn' | 'error' | 'success';
  createdAt: string;
}

export type OfficeStage =
  | 'idle'
  | 'incoming_sms'
  | 'security_scanning'
  | 'security_blocked'
  | 'security_passed'
  | 'agent_drafting'
  | 'jury_deliberating'
  | 'jury_rewrite'
  | 'boss_pending'
  | 'auto_sent'
  | 'boss_approved'
  | 'boss_rejected';

export interface OfficeEvent {
  id: string;
  stage: OfficeStage;
  ticketCode: string;
  orgSlug: 'real_estate' | 'cleaning';
  speaker: string;
  message: string;
  statusPill: string;
  jurorVotes?: JurorVerdict[];
  timestamp: string;
}

export interface SystemStatus {
  database: 'neon_connected' | 'memory_fallback';
  aiEngine: 'openrouter_live' | 'smart_simulation';
  virusTotal: 'connected' | 'local_and_urlhaus_only';
  twilioReady: boolean;
  accessGateEnabled: boolean;
  dailyAiCalls: number;
  dailyAiBudget: number;
  timezone: 'America/New_York (EST UTC-5)';
  currency: 'USD';
}

export interface BootstrapPayload {
  organizations: Organization[];
  messages: ChatMessage[];
  tickets: ApprovalTicket[];
  auditLogs: AuditLogEntry[];
  status: SystemStatus;
}
