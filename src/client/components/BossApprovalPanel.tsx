import React, { useState } from 'react';
import { CheckCircle2, Edit3, RefreshCw, ShieldCheck, ShieldAlert, XCircle, Smartphone } from 'lucide-react';
import type { ApprovalTicket } from '../../shared/types.js';
import { formatEstDateTime } from '../api.js';

interface BossApprovalPanelProps {
  tickets: ApprovalTicket[];
  busyTicketId: string | null;
  onDecision: (params: {
    ticketId: string;
    action: 'approve' | 'edit_send' | 'rewrite' | 'reject';
    editedReply?: string;
    bossNote?: string;
  }) => Promise<void>;
}

const QUICK_REJECT_REASONS = [
  'Off-brand tone',
  'Unauthorized discount/price',
  'Cross-business info leak',
  'Incomplete answer',
  'Needs human phone call',
];

export const BossApprovalPanel: React.FC<BossApprovalPanelProps> = ({
  tickets,
  busyTicketId,
  onDecision,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [rewriteId, setRewriteId] = useState<string | null>(null);
  const [rewriteNote, setRewriteNote] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filter, setFilter] = useState<'pending' | 'rejected' | 'all'>('pending');

  const pendingCount = tickets.filter((t) => t.status === 'pending_boss').length;
  const rejectedCount = tickets.filter((t) => t.status === 'rejected' || t.status === 'quarantined').length;

  const visibleTickets =
    filter === 'pending'
      ? tickets.filter((t) => t.status === 'pending_boss')
      : filter === 'rejected'
        ? tickets.filter((t) => t.status === 'rejected' || t.status === 'quarantined')
        : tickets;

  return (
    <div className="phone-frame bg-[#0e1525] flex flex-col justify-between h-full min-h-[540px] lg:min-h-[620px]">
      {/* Boss iPhone Header */}
      <div className="bg-[#182235] px-3.5 py-3 border-b border-slate-700 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-extrabold shadow">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="font-pixel font-extrabold text-xs text-amber-400">
                3. BOSS iPHONE APPROVAL
              </div>
              <div className="text-[10px] text-slate-400">
                Regional Boss (Admin) • PWA Ready
              </div>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-xs">
            {pendingCount} Pending
          </span>
        </div>

        {/* 3 Tabs: Pending | Rejected Log | All */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`py-1.5 rounded font-bold border ${
              filter === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-800/70 text-slate-400 border-slate-700'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('rejected')}
            className={`py-1.5 rounded font-bold border ${
              filter === 'rejected'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                : 'bg-slate-800/70 text-slate-400 border-slate-700'
            }`}
          >
            Rejected Log ({rejectedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`py-1.5 rounded font-bold border ${
              filter === 'all'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                : 'bg-slate-800/70 text-slate-400 border-slate-700'
            }`}
          >
            All ({tickets.length})
          </button>
        </div>
      </div>

      {/* Tickets Feed */}
      <div className="flex-1 boss-bg p-3 space-y-3 overflow-y-auto text-xs">
        {visibleTickets.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-4 py-10 space-y-2">
            <ShieldCheck className="w-10 h-10 text-emerald-500/60" />
            <div className="font-bold text-slate-300">
              {filter === 'rejected'
                ? 'No rejected or quarantined chats yet'
                : filter === 'pending'
                  ? 'No drafts waiting for Boss sign-off'
                  : 'No tickets yet'}
            </div>
            <p className="text-[11px] leading-relaxed">
              {filter === 'rejected'
                ? 'Every chat rejected by the Boss or quarantined by Security Dwight is permanently logged here with its exact reason.'
                : 'Send an SMS on the left to watch it move through Security, Reception, Brand/Msg QA, and the 4-AI Jury.'}
            </p>
          </div>
        )}

        {visibleTickets.map((t) => {
          const isPending = t.status === 'pending_boss';
          const isBusy = busyTicketId === t.id;
          const isEditing = editingId === t.id;
          const isRewriting = rewriteId === t.id;
          const isRejecting = rejectingId === t.id;

          return (
            <div
              key={t.id}
              className={`rounded-xl border p-3 space-y-2.5 shadow-md ${
                isPending
                  ? 'bg-[#162033] border-amber-500/60'
                  : t.status === 'quarantined' || t.status === 'rejected'
                    ? 'bg-[#1f1420] border-rose-500/50'
                    : 'bg-[#121d2d] border-emerald-500/40'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-pixel font-extrabold text-amber-300">{t.ticketCode}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-200">
                      {t.orgSlug === 'cleaning' ? '🧹' : '🏢'} {t.orgName}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {t.customerName} • {formatEstDateTime(t.createdAt)}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                    t.status === 'pending_boss'
                      ? 'bg-amber-500 text-slate-950'
                      : t.status === 'auto_sent' || t.status === 'approved_sent'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {t.status.replace('_', ' ')}
                </span>
              </div>

              {/* Rejected / Quarantined Reason Banner */}
              {(t.status === 'rejected' || t.status === 'quarantined') && (
                <div className="rounded-lg bg-rose-950/70 border border-rose-500/50 p-2 text-[11px] text-rose-200 space-y-0.5">
                  <div className="font-extrabold text-rose-300">
                    {t.status === 'quarantined' ? '🛡️ SECURITY QUARANTINE REASON:' : '✕ BOSS REJECTION REASON:'}
                  </div>
                  <div>{t.bossNote || t.escalationReasons[0] || 'Rejected by Boss.'}</div>
                </div>
              )}

              {/* Customer Incoming Message */}
              <div className="rounded-lg bg-[#0b111c] p-2 border border-slate-700/80">
                <div className="text-[10px] font-bold text-slate-400 mb-0.5">CUSTOMER SMS:</div>
                <div className="text-slate-200 leading-snug">{t.incomingText}</div>
              </div>

              {/* Security Guard Summary */}
              <div className="flex items-center justify-between gap-2 text-[10px] px-2 py-1 rounded bg-slate-900/90 border border-slate-700">
                <span className="flex items-center gap-1 font-bold">
                  {t.securityVerdict === 'safe' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  Security Guard: {t.securityVerdict.toUpperCase()}
                </span>
                <span className="text-slate-400">
                  {t.securityScans.length} scan(s) • {t.attachments.length} file(s)
                </span>
              </div>

              {/* 4-AI Jury Panel Scores */}
              {t.juryVerdicts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-sky-300">⚖️ 4-AI JURY CONSENSUS</span>
                    <span className="text-amber-300">
                      Brand {t.avgBrandScore}% • Context {t.avgContextScore}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {t.juryVerdicts.map((v) => (
                      <div
                        key={v.jurorId}
                        title={v.reasoning}
                        className="rounded bg-[#0b111c] border border-slate-700/80 px-2 py-1 text-[10px]"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="uppercase text-slate-200">{v.jurorId}</span>
                          <span className={v.vote === 'approve' ? 'text-emerald-400' : 'text-amber-400'}>
                            {v.overallScore}% {v.vote === 'approve' ? '✓' : '⚠'}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 truncate mt-0.5">{v.reasoning}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proposed Draft Reply */}
              {t.draftReply && (
                <div className="rounded-lg bg-[#0d1829] p-2.5 border border-sky-500/30 space-y-1">
                  <div className="text-[10px] font-bold text-sky-400">
                    {t.finalReply ? 'SENT REPLY:' : 'PROPOSED AI DRAFT:'}
                  </div>
                  {isEditing ? (
                    <textarea
                      rows={4}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="w-full rounded bg-[#080e19] border border-sky-500 p-2 text-xs text-white focus:outline-none"
                    />
                  ) : (
                    <div className="text-slate-100 leading-snug whitespace-pre-wrap">
                      {t.finalReply || t.draftReply}
                    </div>
                  )}
                </div>
              )}

              {/* Boss Rewrite Form */}
              {isPending && isRewriting && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={rewriteNote}
                    onChange={(e) => setRewriteNote(e.target.value)}
                    placeholder="Boss instruction (e.g., Offer Saturday 9 AM EST instead)..."
                    className="w-full rounded bg-[#080e19] border border-indigo-500 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={async () => {
                        await onDecision({
                          ticketId: t.id,
                          action: 'rewrite',
                          bossNote: rewriteNote.trim() || 'Make tone warmer and shorter.',
                        });
                        setRewriteId(null);
                        setRewriteNote('');
                      }}
                      className="flex-1 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px]"
                    >
                      Send Back to AI
                    </button>
                    <button
                      type="button"
                      onClick={() => setRewriteId(null)}
                      className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 font-bold text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Boss Rejection Reason Form (logged permanently!) */}
              {isPending && isRejecting && (
                <div className="space-y-2 rounded-lg bg-rose-950/40 border border-rose-500/50 p-2.5">
                  <div className="text-[10px] font-extrabold text-rose-300">
                    WHY ARE YOU REJECTING THIS CHAT? (Saved to Rejected Log)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_REJECT_REASONS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setRejectReason(tag)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          rejectReason === tag
                            ? 'bg-rose-500 text-white border-rose-400'
                            : 'bg-slate-900 text-rose-200 border-rose-500/40'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Or type custom rejection reason..."
                    className="w-full rounded bg-[#080e19] border border-rose-500 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy || !rejectReason.trim()}
                      onClick={async () => {
                        await onDecision({
                          ticketId: t.id,
                          action: 'reject',
                          bossNote: rejectReason.trim(),
                        });
                        setRejectingId(null);
                        setRejectReason('');
                      }}
                      className="flex-1 py-1.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-[11px]"
                    >
                      Confirm Reject & Log
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(null)}
                      className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 font-bold text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Boss Action Buttons */}
              {isPending && !isRewriting && !isRejecting && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={async () => {
                          await onDecision({
                            ticketId: t.id,
                            action: 'edit_send',
                            editedReply: editDraft,
                          });
                          setEditingId(null);
                        }}
                        className="py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Save & Send SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="py-2 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs"
                      >
                        Cancel Edit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onDecision({ ticketId: t.id, action: 'approve' })}
                        className="col-span-2 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isBusy ? 'Dispatching...' : 'Approve & Load SMS Truck'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setEditingId(t.id);
                          setEditDraft(t.draftReply);
                        }}
                        className="py-1.5 rounded-lg bg-sky-600/25 hover:bg-sky-600/40 text-sky-300 border border-sky-500/40 font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRewriteId(t.id);
                          setRewriteNote('');
                        }}
                        className="py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Rewrite
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectingId(t.id);
                          setRejectReason('');
                        }}
                        className="col-span-2 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-500/40 font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject & Log Reason
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-[#182235] px-3 py-2 border-t border-slate-700 text-[10px] text-slate-400 flex items-center justify-between">
        <span>📱 Open on iPhone Safari → Share → Add to Home Screen</span>
      </div>
    </div>
  );
};
