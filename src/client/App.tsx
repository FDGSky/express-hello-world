import React, { useCallback, useEffect, useState } from 'react';
import {
  Settings,
  ScrollText,
  RotateCcw,
  Lock,
  MessageSquare,
  Monitor,
  Smartphone,
} from 'lucide-react';
import type { BootstrapPayload, OfficeEvent } from '../shared/types.js';
import {
  checkAuthGate,
  fetchBootstrap,
  resetDemoData,
  sendBossDecision,
  sendCustomerSms,
  subscribeOfficeEvents,
  unlockAccessGate,
  updateOrganization,
} from './api.js';
import { PixelOfficeCanvas } from './components/PixelOfficeCanvas.js';
import { CustomerSmsPanel } from './components/CustomerSmsPanel.js';
import { BossApprovalPanel } from './components/BossApprovalPanel.js';
import { RulesConfigModal } from './components/RulesConfigModal.js';
import { TraceLogsModal } from './components/TraceLogsModal.js';

export const App: React.FC = () => {
  const [gateLocked, setGateLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [activeOrgSlug, setActiveOrgSlug] = useState<'cleaning' | 'real_estate'>('cleaning');
  const [eventQueue, setEventQueue] = useState<OfficeEvent[]>([]);
  const [sending, setSending] = useState(false);
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<'sms' | 'office' | 'boss'>('office');
  const [errorBanner, setErrorBanner] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const payload = await fetchBootstrap();
      setData(payload);
      setErrorBanner('');
    } catch (err) {
      setErrorBanner((err as Error).message);
    }
  }, []);

  useEffect(() => {
    let cleanupSse: (() => void) | undefined;

    (async () => {
      try {
        const auth = await checkAuthGate();
        if (auth.gateEnabled && !auth.unlocked) {
          setGateLocked(true);
          return;
        }
        await loadAll();
        cleanupSse = subscribeOfficeEvents((evt) => {
          setEventQueue((prev) => [...prev.slice(-24), evt]);
          if (
            evt.stage === 'boss_pending' ||
            evt.stage === 'auto_sent' ||
            evt.stage === 'boss_approved' ||
            evt.stage === 'boss_rejected' ||
            evt.stage === 'security_blocked'
          ) {
            void loadAll();
          }
        });
      } catch (err) {
        setErrorBanner((err as Error).message);
      }
    })();

    return () => cleanupSse?.();
  }, [loadAll]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await unlockAccessGate(pinInput);
    if (!ok) {
      setPinError('Invalid access code.');
      return;
    }
    setGateLocked(false);
    setPinError('');
    await loadAll();
  };

  if (gateLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b0f17]">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm rounded-2xl bg-[#131a26] border-2 border-indigo-500/50 p-6 space-y-4 shadow-2xl"
        >
          <div className="flex items-center gap-2.5 text-amber-400">
            <Lock className="w-5 h-5" />
            <h1 className="font-pixel font-extrabold text-sm">MINI OFFICE AI — ACCESS GATE</h1>
          </div>
          <p className="text-xs text-slate-400">
            Enter the demo access code to unlock the Multi-AI Pixel Office.
          </p>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Access code..."
            className="w-full px-3 py-2 rounded-lg bg-[#0b1019] border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {pinError && <div className="text-xs text-rose-400 font-bold">{pinError}</div>}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs"
          >
            Unlock Office
          </button>
        </form>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300 font-pixel text-xs">
        {errorBanner ? `Error: ${errorBanner}` : 'Booting Mini Office AI HQ...'}
      </div>
    );
  }

  const activeOrg =
    data.organizations.find((o) => o.slug === activeOrgSlug) || data.organizations[0];
  const pendingBossCount = data.tickets.filter((t) => t.status === 'pending_boss').length;
  const totalBlocked = data.tickets.filter((t) => t.status === 'quarantined').length;

  const handleSendSms = async (params: {
    orgSlug: 'real_estate' | 'cleaning';
    customerName: string;
    customerPhone: string;
    messageText: string;
    files: File[];
  }) => {
    setSending(true);
    setErrorBanner('');
    try {
      const { ticket } = await sendCustomerSms(params);
      // Guarantee full visual choreography even if SSE was buffered by a proxy
      setEventQueue((prev) => {
        const alreadyHas = prev.some((e) => e.ticketCode === ticket.ticketCode);
        if (alreadyHas) return prev;
        const synthetic: OfficeEvent[] = [
          {
            id: `syn_1_${ticket.id}`,
            stage: 'incoming_sms',
            ticketCode: ticket.ticketCode,
            orgSlug: ticket.orgSlug,
            speaker: 'INCOMING SMS GATEWAY',
            message: `New SMS for ${ticket.orgName} arrived at the door!`,
            statusPill: `${ticket.ticketCode} • INCOMING`,
            timestamp: new Date().toISOString(),
          },
          {
            id: `syn_2_${ticket.id}`,
            stage: 'security_scanning',
            ticketCode: ticket.ticketCode,
            orgSlug: ticket.orgSlug,
            speaker: 'SECURITY DESK (DWIGHT)',
            message: 'Scanning message, links, and files with Magic Bytes, URLhaus & VirusTotal...',
            statusPill: `${ticket.ticketCode} • SCANNING`,
            timestamp: new Date().toISOString(),
          },
        ];
        if (ticket.status === 'quarantined') {
          synthetic.push({
            id: `syn_3_${ticket.id}`,
            stage: 'security_blocked',
            ticketCode: ticket.ticketCode,
            orgSlug: ticket.orgSlug,
            speaker: 'SECURITY DESK — RED ALERT!',
            message: ticket.escalationReasons[0] || 'Threat quarantined before reaching AI agents!',
            statusPill: `${ticket.ticketCode} • BLOCKED`,
            timestamp: new Date().toISOString(),
          });
        } else {
          synthetic.push(
            {
              id: `syn_3_${ticket.id}`,
              stage: 'security_passed',
              ticketCode: ticket.ticketCode,
              orgSlug: ticket.orgSlug,
              speaker: 'SECURITY DESK (DWIGHT)',
              message: 'Scan cleared! Handing verified folder to Reception Pam.',
              statusPill: `${ticket.ticketCode} • SAFE`,
              timestamp: new Date().toISOString(),
            },
            {
              id: `syn_4_${ticket.id}`,
              stage: 'agent_drafting',
              ticketCode: ticket.ticketCode,
              orgSlug: ticket.orgSlug,
              speaker: 'RECEPTION (PAM) → QA DESKS',
              message: `Checking ${ticket.orgName} DB & EST Calendar, drafting reply and passing to Brand/Msg QA.`,
              statusPill: `${ticket.ticketCode} • DRAFT + QA`,
              timestamp: new Date().toISOString(),
            },
            {
              id: `syn_5_${ticket.id}`,
              stage: 'jury_deliberating',
              ticketCode: ticket.ticketCode,
              orgSlug: ticket.orgSlug,
              speaker: 'CONFERENCE ROOM — 4-AI JURY',
              message: 'Claude, Gemini, GPT & DeepSeek are deliberating on Brand & Context coherence...',
              statusPill: `${ticket.ticketCode} • 4-AI JURY`,
              jurorVotes: ticket.juryVerdicts,
              timestamp: new Date().toISOString(),
            },
            {
              id: `syn_6_${ticket.id}`,
              stage: ticket.status === 'auto_sent' ? 'auto_sent' : 'boss_pending',
              ticketCode: ticket.ticketCode,
              orgSlug: ticket.orgSlug,
              speaker: ticket.status === 'auto_sent' ? 'AUTO-PILOT → SMS TRUCK' : 'BOSS CORNER OFFICE',
              message:
                ticket.status === 'auto_sent'
                  ? `Unanimous Jury approval (${ticket.avgOverallScore}/100)! Loading papers into SMS Express Truck.`
                  : `Delivered to Boss desk for manual approval (${ticket.avgOverallScore}/100 Jury score).`,
              statusPill: ticket.status === 'auto_sent' ? `${ticket.ticketCode} • SHIPPED` : `${ticket.ticketCode} • BOSS QUEUE`,
              jurorVotes: ticket.juryVerdicts,
              timestamp: new Date().toISOString(),
            }
          );
        }
        return [...prev.slice(-16), ...synthetic];
      });
      await loadAll();
    } catch (err) {
      setErrorBanner((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleDecision = async (params: {
    ticketId: string;
    action: 'approve' | 'edit_send' | 'rewrite' | 'reject';
    editedReply?: string;
    bossNote?: string;
  }) => {
    setBusyTicketId(params.ticketId);
    try {
      const { ticket } = await sendBossDecision(params);
      setEventQueue((prev) => [
        ...prev.slice(-20),
        {
          id: `syn_dec_${Date.now()}`,
          stage:
            params.action === 'reject'
              ? 'boss_rejected'
              : params.action === 'rewrite'
                ? 'jury_rewrite'
                : 'boss_approved',
          ticketCode: ticket.ticketCode,
          orgSlug: ticket.orgSlug,
          speaker: 'BOSS CORNER OFFICE',
          message:
            params.action === 'reject'
              ? `Ticket ${ticket.ticketCode} rejected and saved to Rejected Log.`
              : params.action === 'rewrite'
                ? `Boss requested rewrite on ${ticket.ticketCode}.`
                : `Approved! Papers loaded into SMS Express Truck and dispatched!`,
          statusPill:
            params.action === 'reject'
              ? `${ticket.ticketCode} • REJECTED`
              : `${ticket.ticketCode} • SHIPPED`,
          timestamp: new Date().toISOString(),
        },
      ]);
      await loadAll();
    } catch (err) {
      setErrorBanner((err as Error).message);
    } finally {
      setBusyTicketId(null);
    }
  };

  const handleQuickToggleMode = async () => {
    const nextMode = activeOrg.approvalMode === 'baa' ? 'auto_pilot' : 'baa';
    await updateOrganization(activeOrg.slug, { approvalMode: nextMode });
    await loadAll();
  };

  const handleReset = async () => {
    await resetDemoData();
    setEventQueue([]);
    await loadAll();
  };

  return (
    <div className="min-h-screen lg:h-screen flex flex-col p-2.5 md:p-3.5 pb-20 lg:pb-3.5 max-w-[1680px] mx-auto space-y-2.5 lg:overflow-hidden">
      {/* Top HQ Control Bar */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#131924] border-2 border-[#263145] shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-pixel font-extrabold text-[11px]">
            MINI OFFICE AI
          </span>
          <h1 className="font-pixel font-extrabold text-xs md:text-sm tracking-tight text-slate-100">
            THE OFFICE HQ // 2 BUSINESSES • SECURITY • 4-AI JURY
          </h1>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              data.status.database === 'neon_connected'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-sky-500/15 text-sky-300 border-sky-500/40'
            }`}
          >
            {data.status.database === 'neon_connected' ? '🟢 Neon DB' : '⚡ Local Demo DB'}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              data.status.aiEngine === 'openrouter_live'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
            }`}
          >
            {data.status.aiEngine === 'openrouter_live'
              ? '🤖 OpenRouter Live'
              : '🧪 Smart Sim (Add OpenRouter Key)'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleQuickToggleMode}
            className={`pixel-btn px-2.5 py-1 rounded font-pixel font-bold text-[11px] ${
              activeOrg.approvalMode === 'baa'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-emerald-600 text-white'
            }`}
            title="Switch active company between Auto-Pilot and Boss Approves All (BAA)"
          >
            {activeOrg.approvalMode === 'baa' ? '👑 Mode: BAA (Approve All)' : '🚀 Mode: Auto-Pilot'}
          </button>
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="pixel-btn px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-pixel font-bold text-[11px] flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" /> Rules & Brands
          </button>
          <button
            type="button"
            onClick={() => setShowLogsModal(true)}
            className="pixel-btn px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white font-pixel font-bold text-[11px] flex items-center gap-1"
          >
            <ScrollText className="w-3.5 h-3.5" /> Scans & Logs ({data.auditLogs.length})
          </button>
          <button
            type="button"
            onClick={handleReset}
            title="Reset demo conversations and tickets"
            className="pixel-btn px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-pixel font-bold text-[11px] flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </header>

      {errorBanner && (
        <div className="rounded-lg bg-rose-950/70 border border-rose-500/50 px-3 py-2 text-xs text-rose-200 font-semibold shrink-0">
          {errorBanner}
        </div>
      )}

      {/* 3-Column Desktop Workstation (3 / 6 / 3) / Tabbed iPhone PWA Layout */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        <section className={`lg:col-span-3 min-h-0 ${mobileTab === 'sms' ? 'block' : 'hidden lg:block'}`}>
          <CustomerSmsPanel
            organizations={data.organizations}
            activeOrg={activeOrg}
            onSelectOrg={setActiveOrgSlug}
            messages={data.messages}
            sending={sending}
            onSend={handleSendSms}
          />
        </section>

        <section className={`lg:col-span-6 min-h-0 ${mobileTab === 'office' ? 'block' : 'hidden lg:block'}`}>
          <PixelOfficeCanvas
            activeOrg={activeOrg}
            eventQueue={eventQueue}
            pendingBossCount={pendingBossCount}
            totalProcessed={data.tickets.length}
            totalBlocked={totalBlocked}
          />
        </section>

        <section className={`lg:col-span-3 min-h-0 ${mobileTab === 'boss' ? 'block' : 'hidden lg:block'}`}>
          <BossApprovalPanel
            tickets={data.tickets}
            busyTicketId={busyTicketId}
            onDecision={handleDecision}
          />
        </section>
      </main>

      {/* Mobile / iPhone Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#131924]/95 backdrop-blur border-t border-slate-700 px-3 py-2 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setMobileTab('sms')}
          className={`py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 ${
            mobileTab === 'sms' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800/80 text-slate-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> SMS
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('office')}
          className={`py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 ${
            mobileTab === 'office' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800/80 text-slate-300'
          }`}
        >
          <Monitor className="w-4 h-4" /> Office
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('boss')}
          className={`py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 relative ${
            mobileTab === 'boss' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800/80 text-slate-300'
          }`}
        >
          <Smartphone className="w-4 h-4" /> Boss
          {pendingBossCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-extrabold">
              {pendingBossCount}
            </span>
          )}
        </button>
      </nav>

      {/* Modals */}
      {showRulesModal && (
        <RulesConfigModal
          organizations={data.organizations}
          status={data.status}
          onClose={() => setShowRulesModal(false)}
          onSaveOrg={async (slug, patch) => {
            await updateOrganization(slug, patch);
            await loadAll();
          }}
        />
      )}

      {showLogsModal && (
        <TraceLogsModal
          tickets={data.tickets}
          auditLogs={data.auditLogs}
          onClose={() => setShowLogsModal(false)}
        />
      )}
    </div>
  );
};
