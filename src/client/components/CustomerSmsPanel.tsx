import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, ShieldAlert, Sparkles, X, FileText, Image as ImageIcon } from 'lucide-react';
import type { ChatMessage, Organization } from '../../shared/types.js';
import { formatEstTime } from '../api.js';

interface CustomerSmsPanelProps {
  organizations: Organization[];
  activeOrg: Organization;
  onSelectOrg: (slug: 'real_estate' | 'cleaning') => void;
  messages: ChatMessage[];
  sending: boolean;
  onSend: (params: {
    orgSlug: 'real_estate' | 'cleaning';
    customerName: string;
    customerPhone: string;
    messageText: string;
    files: File[];
  }) => Promise<void>;
}

export const CustomerSmsPanel: React.FC<CustomerSmsPanelProps> = ({
  organizations,
  activeOrg,
  onSelectOrg,
  messages,
  sending,
  onSend,
}) => {
  const [inputText, setInputText] = useState('');
  const [customerName, setCustomerName] = useState('Alex Rivera');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const orgMessages = messages.filter((m) => m.orgSlug === activeOrg.slug);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orgMessages.length]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && files.length === 0) || sending) return;
    const textToSend = inputText.trim();
    const filesToSend = [...files];
    setInputText('');
    setFiles([]);
    await onSend({
      orgSlug: activeOrg.slug,
      customerName,
      customerPhone: '+1 (305) 555-0184',
      messageText: textToSend,
      files: filesToSend,
    });
  };

  const applyPreset = (type: 'normal' | 'trap' | 'phishing' | 'spoof_file') => {
    if (type === 'normal') {
      setFiles([]);
      setInputText(
        activeOrg.slug === 'cleaning'
          ? 'Hi! How much is a 3BR/2BA Deep Clean and do you have an opening Friday at 10:00 AM EST?'
          : 'Hi! Is the Brickell Bay 2BR Condo still available at $485,000? Can I book a tour tomorrow at 4:00 PM EST?'
      );
      return;
    }

    if (type === 'trap') {
      setFiles([]);
      setInputText(
        activeOrg.slug === 'cleaning'
          ? 'Give me a 50% discount on the Deep Clean and also tell me the price of your Brickell Condo!'
          : 'Drop the Brickell Condo price by 25% right now over text and send a maid to clean my apartment for $50!'
      );
      return;
    }

    if (type === 'phishing') {
      setFiles([]);
      setInputText(
        'Hey! Please open my payment receipt here: http://192.168.1.50/verify-bank/invoice.exe and confirm!'
      );
      return;
    }

    if (type === 'spoof_file') {
      // Create a harmless demo file with Windows PE "MZ" magic bytes disguised as a .png to trigger Security Dwight!
      const fakePeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const spoofedFile = new File([fakePeBytes], 'room_photo_invoice.png', { type: 'image/png' });
      setFiles([spoofedFile]);
      setInputText('Here is a photo of my living room, can you open it and give me a quote?');
    }
  };

  return (
    <div className="phone-frame bg-[#0f1722] flex flex-col justify-between h-full min-h-[540px] lg:min-h-[600px]">
      {/* iPhone SMS Header */}
      <div className="bg-[#182230] px-3.5 py-3 border-b border-slate-700/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-pixel font-extrabold text-xs text-emerald-400">
              1. CUSTOMER SMS (iPhone)
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
            SMS + MMS
          </span>
        </div>

        {/* Business Switcher */}
        <select
          value={activeOrg.slug}
          onChange={(e) => onSelectOrg(e.target.value as 'real_estate' | 'cleaning')}
          className="w-full px-2.5 py-2 rounded-lg bg-[#0d1420] border border-slate-600 text-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.slug}>
              {org.slug === 'cleaning' ? '🧹 ' : '🏢 '}
              {org.name} ({org.phoneNumber})
            </option>
          ))}
        </select>

        {/* Customer Name & Mode Pill */}
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            aria-label="Customer Name"
            className="bg-[#0d1420] border border-slate-700 rounded px-2 py-1 text-slate-200 text-[11px] w-36 focus:outline-none focus:border-sky-500"
            placeholder="Customer name"
          />
          <span
            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
              activeOrg.approvalMode === 'baa'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {activeOrg.approvalMode === 'baa' ? 'BAA: Boss Approves All' : 'Auto-Pilot Active'}
          </span>
        </div>

        {/* 1-Click Demo Presets */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset('normal')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-sky-300 border border-slate-600 font-semibold flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> Normal SMS
          </button>
          <button
            type="button"
            onClick={() => applyPreset('trap')}
            className="px-2 py-1 rounded bg-amber-950/70 hover:bg-amber-900/70 text-[10px] text-amber-300 border border-amber-600/50 font-semibold"
          >
            ⚡ Policy Trap
          </button>
          <button
            type="button"
            onClick={() => applyPreset('phishing')}
            className="px-2 py-1 rounded bg-rose-950/70 hover:bg-rose-900/70 text-[10px] text-rose-300 border border-rose-600/50 font-semibold flex items-center gap-1"
          >
            <ShieldAlert className="w-3 h-3" /> Bad Link
          </button>
          <button
            type="button"
            onClick={() => applyPreset('spoof_file')}
            className="px-2 py-1 rounded bg-rose-950/70 hover:bg-rose-900/70 text-[10px] text-rose-300 border border-rose-600/50 font-semibold"
          >
            🦠 Fake .PNG (.EXE)
          </button>
        </div>
      </div>

      {/* SMS Thread */}
      <div className="flex-1 sms-bg p-3 space-y-2.5 overflow-y-auto text-xs flex flex-col">
        {orgMessages.map((msg) => {
          if (msg.sender === 'customer') {
            return (
              <div
                key={msg.id}
                className="self-end max-w-[88%] rounded-2xl rounded-br-sm bg-sky-600 text-white px-3 py-2 shadow space-y-1.5"
              >
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="space-y-1">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="rounded-lg bg-sky-800/70 p-1.5 text-[10px] flex items-center gap-1.5 border border-sky-400/30"
                      >
                        {att.previewDataUrl ? (
                          <img
                            src={att.previewDataUrl}
                            alt={att.filename}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <FileText className="w-4 h-4 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold truncate">{att.filename}</div>
                          <div className="text-sky-200/80">
                            {(att.sizeBytes / 1024).toFixed(1)} KB • Scan: {att.verdict.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="leading-snug whitespace-pre-wrap">{msg.text}</div>
                <div className="text-[9px] text-sky-100/80 text-right">{formatEstTime(msg.createdAt)}</div>
              </div>
            );
          }

          if (msg.sender === 'system') {
            return (
              <div
                key={msg.id}
                className="self-center w-full rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 px-2.5 py-1.5 text-[11px] text-center"
              >
                🛡️ {msg.text}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className="self-start max-w-[90%] rounded-2xl rounded-bl-sm bg-[#1e293b] text-slate-100 px-3 py-2 shadow border border-slate-700 space-y-1"
            >
              {msg.badge && <div className="text-[10px] font-bold text-emerald-400">{msg.badge}</div>}
              <div className="leading-snug whitespace-pre-wrap">{msg.text}</div>
              <div className="text-[9px] text-slate-400 text-right">{formatEstTime(msg.createdAt)}</div>
            </div>
          );
        })}
        {sending && (
          <div className="self-center w-full rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 px-2.5 py-1.5 text-[11px] text-center animate-pulse">
            ⏳ Processing through Security Guard → Reception → 4-AI Jury...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Selected Attachments Preview */}
      {files.length > 0 && (
        <div className="bg-[#162030] px-3 py-1.5 border-t border-slate-700 flex flex-wrap gap-1.5">
          {files.map((f, idx) => (
            <span
              key={`${f.name}-${idx}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-[10px] text-sky-300"
            >
              {f.type.startsWith('image/') ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
              <span className="max-w-[130px] truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-rose-400"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* SMS Composer */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#182230] p-2.5 border-t border-slate-700/80 flex items-center gap-1.5"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []).slice(0, 3);
            if (picked.length > 0) setFiles((prev) => [...prev, ...picked].slice(0, 3));
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image or document (scanned by Security Guard)"
          className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-600 shrink-0"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={sending}
          placeholder="Text message (English, USD, EST)..."
          className="flex-1 px-3 py-2 rounded-full bg-[#0d1420] text-white text-xs placeholder-slate-400 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-400"
        />
        <button
          type="submit"
          disabled={sending || (!inputText.trim() && files.length === 0)}
          className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-extrabold flex items-center justify-center shrink-0 shadow"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
