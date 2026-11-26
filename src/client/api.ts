import type {
  ApprovalMode,
  ApprovalTicket,
  BootstrapPayload,
  OfficeEvent,
  Organization,
} from '../shared/types.js';

export function formatEstTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso)) + ' EST';
  } catch {
    return iso;
  }
}

export function formatEstDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso)) + ' EST';
  } catch {
    return iso;
  }
}

export async function checkAuthGate(): Promise<{ gateEnabled: boolean; unlocked: boolean }> {
  const res = await fetch('/api/auth/check');
  if (!res.ok) throw new Error('Failed to check access gate');
  return res.json();
}

export async function unlockAccessGate(code: string): Promise<boolean> {
  const res = await fetch('/api/auth/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.ok;
}

export async function fetchBootstrap(): Promise<BootstrapPayload> {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) throw new Error(`Bootstrap failed (${res.status})`);
  return res.json();
}

export async function sendCustomerSms(params: {
  orgSlug: 'real_estate' | 'cleaning';
  customerName: string;
  customerPhone: string;
  messageText: string;
  files: File[];
}): Promise<{ ticket: ApprovalTicket }> {
  const form = new FormData();
  form.append('orgSlug', params.orgSlug);
  form.append('customerName', params.customerName);
  form.append('customerPhone', params.customerPhone);
  form.append('messageText', params.messageText);
  for (const file of params.files) {
    form.append('files', file);
  }
  const res = await fetch('/api/messages/send', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Send failed' }));
    throw new Error(err.error || 'Failed to send SMS');
  }
  return res.json();
}

export async function sendBossDecision(params: {
  ticketId: string;
  action: 'approve' | 'edit_send' | 'rewrite' | 'reject';
  editedReply?: string;
  bossNote?: string;
}): Promise<{ ticket: ApprovalTicket }> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(params.ticketId)}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: params.action,
      editedReply: params.editedReply,
      bossNote: params.bossNote,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Decision failed' }));
    throw new Error(err.error || 'Failed to submit decision');
  }
  return res.json();
}

export async function updateOrganization(
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
): Promise<{ organization: Organization }> {
  const res = await fetch(`/api/organizations/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Update failed' }));
    throw new Error(err.error || 'Failed to update business settings');
  }
  return res.json();
}

export async function resetDemoData(): Promise<void> {
  const res = await fetch('/api/demo/reset', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset demo');
}

export function subscribeOfficeEvents(onEvent: (evt: OfficeEvent) => void): () => void {
  const es = new EventSource('/api/events');
  es.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data) as OfficeEvent;
      onEvent(parsed);
    } catch {
      // ignore malformed pings
    }
  };
  return () => es.close();
}
