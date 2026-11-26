import React, { useState } from 'react';
import { X, Save, Shield, Database, Cpu, Phone } from 'lucide-react';
import type { ApprovalMode, Organization, SystemStatus } from '../../shared/types.js';

interface RulesConfigModalProps {
  organizations: Organization[];
  status: SystemStatus;
  onClose: () => void;
  onSaveOrg: (
    slug: 'real_estate' | 'cleaning',
    patch: {
      name: string;
      brandGuidelines: string;
      pricingCatalog: string;
      calendarSlots: string;
      forbiddenTopics: string;
      approvalMode: ApprovalMode;
      minJuryScore: number;
      sensitiveKeywords: string[];
    }
  ) => Promise<void>;
}

export const RulesConfigModal: React.FC<RulesConfigModalProps> = ({
  organizations,
  status,
  onClose,
  onSaveOrg,
}) => {
  const [selectedSlug, setSelectedSlug] = useState<'cleaning' | 'real_estate'>('cleaning');
  const current = organizations.find((o) => o.slug === selectedSlug) || organizations[0];

  const [name, setName] = useState(current.name);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(current.approvalMode);
  const [minJuryScore, setMinJuryScore] = useState(current.minJuryScore);
  const [brandGuidelines, setBrandGuidelines] = useState(current.brandGuidelines);
  const [pricingCatalog, setPricingCatalog] = useState(current.pricingCatalog);
  const [calendarSlots, setCalendarSlots] = useState(current.calendarSlots);
  const [forbiddenTopics, setForbiddenTopics] = useState(current.forbiddenTopics);
  const [keywordsText, setKeywordsText] = useState(current.sensitiveKeywords.join(', '));
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  const handleSwitch = (slug: 'cleaning' | 'real_estate') => {
    const org = organizations.find((o) => o.slug === slug);
    if (!org) return;
    setSelectedSlug(slug);
    setName(org.name);
    setApprovalMode(org.approvalMode);
    setMinJuryScore(org.minJuryScore);
    setBrandGuidelines(org.brandGuidelines);
    setPricingCatalog(org.pricingCatalog);
    setCalendarSlots(org.calendarSlots);
    setForbiddenTopics(org.forbiddenTopics);
    setKeywordsText(org.sensitiveKeywords.join(', '));
    setSavedNotice('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedNotice('');
    try {
      await onSaveOrg(selectedSlug, {
        name: name.trim(),
        brandGuidelines: brandGuidelines.trim(),
        pricingCatalog: pricingCatalog.trim(),
        calendarSlots: calendarSlots.trim(),
        forbiddenTopics: forbiddenTopics.trim(),
        approvalMode,
        minJuryScore,
        sensitiveKeywords: keywordsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setSavedNotice('Saved to database!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#131a26] border-2 border-indigo-500/50 shadow-2xl p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div>
            <h2 className="font-pixel font-extrabold text-sm text-indigo-300">
              BUSINESS RULES, BRAND GUIDELINES & CLOUD STATUS
            </h2>
            <p className="text-[11px] text-slate-400">
              Configure Auto-Pilot vs BAA (Boss Approves All) and Jury rules live during the demo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cloud & API Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg bg-[#0c111b] border border-slate-700 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px]">
              <Database className="w-3.5 h-3.5 text-sky-400" /> NEON POSTGRES
            </div>
            <div className={`font-bold text-[11px] ${status.database === 'neon_connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {status.database === 'neon_connected' ? 'Connected (Live)' : 'Memory Fallback'}
            </div>
          </div>
          <div className="rounded-lg bg-[#0c111b] border border-slate-700 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px]">
              <Cpu className="w-3.5 h-3.5 text-purple-400" /> OPENROUTER 4-AI
            </div>
            <div className={`font-bold text-[11px] ${status.aiEngine === 'openrouter_live' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {status.aiEngine === 'openrouter_live'
                ? `Live (${status.dailyAiCalls}/${status.dailyAiBudget})`
                : 'Smart Simulation'}
            </div>
          </div>
          <div className="rounded-lg bg-[#0c111b] border border-slate-700 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px]">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> VIRUSTOTAL + URLHAUS
            </div>
            <div className={`font-bold text-[11px] ${status.virusTotal === 'connected' ? 'text-emerald-400' : 'text-sky-300'}`}>
              {status.virusTotal === 'connected' ? 'VT v3 + URLhaus' : 'Local + URLhaus'}
            </div>
          </div>
          <div className="rounded-lg bg-[#0c111b] border border-slate-700 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px]">
              <Phone className="w-3.5 h-3.5 text-amber-400" /> TWILIO US SMS
            </div>
            <div className={`font-bold text-[11px] ${status.twilioReady ? 'text-emerald-400' : 'text-slate-300'}`}>
              {status.twilioReady ? 'Webhook Active' : 'Sim + Webhook Ready'}
            </div>
          </div>
        </div>

        {/* Business Tabs */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSwitch('cleaning')}
            className={`flex-1 py-2 rounded-lg font-bold border ${
              selectedSlug === 'cleaning'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            🧹 Cleaning Business
          </button>
          <button
            type="button"
            onClick={() => handleSwitch('real_estate')}
            className={`flex-1 py-2 rounded-lg font-bold border ${
              selectedSlug === 'real_estate'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            🏢 Real Estate Business
          </button>
        </div>

        {/* Editable Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Business Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0b1019] border border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-300 mb-1">Approval Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setApprovalMode('baa')}
                className={`py-2 rounded-lg font-bold border ${
                  approvalMode === 'baa'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-[#0b1019] text-slate-300 border-slate-700'
                }`}
              >
                BAA (Approve All)
              </button>
              <button
                type="button"
                onClick={() => setApprovalMode('auto_pilot')}
                className={`py-2 rounded-lg font-bold border ${
                  approvalMode === 'auto_pilot'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-[#0b1019] text-slate-300 border-slate-700'
                }`}
              >
                Auto-Pilot
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Minimum 4-AI Jury Score ({minJuryScore}/100)
            </label>
            <input
              type="range"
              min={60}
              max={95}
              value={minJuryScore}
              onChange={(e) => setMinJuryScore(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-300 mb-1">
              Boss Escalation Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#0b1019] border border-slate-700 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-300 mb-1">Brand Guidelines (Evaluated by 4-AI Jury)</label>
          <textarea
            rows={2}
            value={brandGuidelines}
            onChange={(e) => setBrandGuidelines(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-[#0b1019] border border-slate-700 text-white"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-300 mb-1">Official USD Pricing & Services</label>
          <textarea
            rows={2}
            value={pricingCatalog}
            onChange={(e) => setPricingCatalog(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-[#0b1019] border border-slate-700 text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-300 mb-1">EST Calendar Slots</label>
            <input
              type="text"
              value={calendarSlots}
              onChange={(e) => setCalendarSlots(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0b1019] border border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-300 mb-1">Forbidden Cross-Business Topics</label>
            <input
              type="text"
              value={forbiddenTopics}
              onChange={(e) => setForbiddenTopics(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0b1019] border border-slate-700 text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <span className="text-emerald-400 font-bold">{savedNotice}</span>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="pixel-btn px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Business Rules'}
          </button>
        </div>
      </div>
    </div>
  );
};
