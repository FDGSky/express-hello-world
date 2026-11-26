import React, { useState } from 'react';
import { X, ShieldAlert, ShieldCheck, ScrollText } from 'lucide-react';
import type { ApprovalTicket, AuditLogEntry } from '../../shared/types.js';
import { formatEstDateTime } from '../api.js';

interface TraceLogsModalProps {
  tickets: ApprovalTicket[];
  auditLogs: AuditLogEntry[];
  onClose: () => void;
}

export const TraceLogsModal: React.FC<TraceLogsModalProps> = ({
  tickets,
  auditLogs,
  onClose,
}) => {
  const [tab, setTab] = useState<'security' | 'audit'>('security');
  const allScans = tickets.flatMap((t) =>
    t.securityScans.map((s) => ({ ...s, ticketCode: t.ticketCode, orgName: t.orgName }))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[#131a26] border-2 border-slate-600 shadow-2xl p-5 space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <h2 className="font-pixel font-extrabold text-sm text-amber-400 flex items-center gap-2">
            <ScrollText className="w-4 h-4" /> SECURITY GUARD SCANS & OFFICE AUDIT LOG
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('security')}
            className={`px-4 py-1.5 rounded-lg font-bold border ${
              tab === 'security'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            🛡️ Security Scans ({allScans.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`px-4 py-1.5 rounded-lg font-bold border ${
              tab === 'audit'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            📡 Audit Trail ({auditLogs.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {tab === 'security' ? (
            allScans.length === 0 ? (
              <div className="text-center text-slate-400 py-10">
                No security scans recorded yet. Send an SMS with a link or file to test the Security Guard.
              </div>
            ) : (
              allScans.map((scan) => (
                <div
                  key={scan.id}
                  className="rounded-xl bg-[#0c111b] border border-slate-700 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold">
                      {scan.verdict === 'blocked' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className="text-amber-300 font-pixel">{scan.ticketCode}</span>
                      <span className="uppercase px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                        {scan.targetType}
                      </span>
                      <span className="text-slate-300 truncate max-w-[260px]">{scan.targetValue}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        scan.verdict === 'blocked'
                          ? 'bg-rose-500/20 text-rose-300'
                          : scan.verdict === 'warning'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {scan.verdict} (Risk {scan.riskScore}%)
                    </span>
                  </div>
                  <div className="space-y-1 pl-1">
                    {scan.checks.map((c, idx) => (
                      <div key={idx} className="text-[11px] flex items-start gap-2">
                        <span
                          className={`font-mono font-bold uppercase shrink-0 ${
                            c.status === 'fail'
                              ? 'text-rose-400'
                              : c.status === 'warn'
                                ? 'text-amber-400'
                                : c.status === 'pass'
                                  ? 'text-emerald-400'
                                  : 'text-slate-500'
                          }`}
                        >
                          [{c.status}]
                        </span>
                        <span className="text-slate-300">
                          <strong>{c.engine}:</strong> {c.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg bg-[#0c111b] border border-slate-800 px-3 py-2 flex items-start justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-pixel font-bold text-[10px] ${
                        log.level === 'error'
                          ? 'text-rose-400'
                          : log.level === 'warn'
                            ? 'text-amber-400'
                            : log.level === 'success'
                              ? 'text-emerald-400'
                              : 'text-sky-400'
                      }`}
                    >
                      [{log.action}]
                    </span>
                    <span className="font-bold text-slate-200">{log.actor}</span>
                    {log.ticketCode && (
                      <span className="text-[10px] text-amber-300 font-pixel">{log.ticketCode}</span>
                    )}
                  </div>
                  <div className="text-slate-300 text-[11px]">{log.detail}</div>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {formatEstDateTime(log.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
