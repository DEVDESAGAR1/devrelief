/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, AlertTriangle, Cloud, Lock, X, Check } from 'lucide-react';
import { SecretScanner } from '../../ingestion/secrets.ts';

interface CloudConsentModalProps {
  isOpen: boolean;
  modelId: string;
  payloadText: string;
  attachments?: Array<{ filename: string; sizeBytes?: number }>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CloudConsentModal: React.FC<CloudConsentModalProps> = ({
  isOpen,
  modelId,
  payloadText,
  attachments = [],
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  // Run scanner to show pre-flight inspection findings
  const scan = SecretScanner.scanAndRedact(payloadText);
  const characterCount = payloadText.length;
  const estimatedTokens = Math.ceil(characterCount / 4);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-800/80">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="consent-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                Explicit Cloud Transmission Consent
              </h2>
              <span className="text-[11px] font-mono text-amber-400 font-semibold">
                DATA LEAVING LOCAL ENVIRONMENT
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Statement */}
        <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/60 text-xs text-amber-200/90 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Privacy Disclosure</span>
          </div>
          <p className="leading-relaxed">
            You are about to transmit engineering data to <strong>Google Gemini Cloud API</strong> ({modelId}).
            Unlike deterministic and Ollama execution modes, this query leaves your local host.
          </p>
        </div>

        {/* Payload Inspection Metrics */}
        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Target Model & Provider</span>
            <span className="font-mono text-blue-400 font-semibold flex items-center gap-1">
              <Cloud className="w-3.5 h-3.5" />
              <span>{modelId} (Cloud API)</span>
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Estimated Payload Size</span>
            <span className="font-mono text-slate-200">
              {characterCount.toLocaleString()} chars (~{estimatedTokens.toLocaleString()} tokens)
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Pre-Flight Secret Scan</span>
            <span className={`font-mono font-semibold flex items-center gap-1 ${
              scan.hasRedactions ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              <Lock className="w-3.5 h-3.5" />
              <span>
                {scan.hasRedactions
                  ? `${scan.matches.length} credential(s) safely masked`
                  : 'Clean (0 credentials detected)'}
              </span>
            </span>
          </div>

          {attachments.length > 0 && (
            <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[11px]">Included Artifacts ({attachments.length}):</span>
              <ul className="text-slate-300 font-mono text-[11px] space-y-0.5">
                {attachments.map((a, i) => (
                  <li key={i} className="truncate">• {a.filename}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Consent Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Cancel (Keep Local)
          </button>
          <button
            onClick={onConfirm}
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Accept & Transmit to Gemini</span>
          </button>
        </div>
      </div>
    </div>
  );
};
