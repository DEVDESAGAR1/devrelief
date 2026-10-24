/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MultimodalIngestionPipeline, RawInputItem } from '../../ingestion/pipeline.ts';
import { EvidencePackage } from '../../ingestion/types.ts';
import { ProviderRegistry } from '../../providers/registry.ts';
import { OperatingMode, AnalysisResponse } from '../../types/provider.ts';
import { CloudConsentModal } from '../modals/CloudConsentModal.tsx';
import {
  Upload,
  FileText,
  Shield,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Copy,
  Check,
  X,
  Play,
  Terminal,
  Cpu,
  Cloud,
  ArrowRight,
  Lock,
} from 'lucide-react';

const SAMPLE_LOG_CONTENT = `2026-10-24 10:14:00 [INFO] Starting pipeline build #1842
2026-10-24 10:14:15 [INFO] Compiling module: auth-service
2026-10-24 10:14:22 [ERROR] Non-resolvable parent POM for com.acme:auth-service:0.4.1: Could not find artifact
2026-10-24 10:14:23 [ERROR] Failed to execute goal on project auth-service: Could not resolve dependencies
AuthHeader: Bearer ya29.a0AfH6SMBsecretToken123456789
2026-10-24 10:14:24 [FATAL] [ERROR] Rule 0: org.apache.maven.plugins.enforcer.RequireReleaseDeps failed
2026-10-24 10:14:25 [INFO] BUILD FAILURE (exit code 1)`;

const SAMPLE_DIFF_CONTENT = `--- a/pom.xml
+++ b/pom.xml
@@ -10,3 +10,3 @@
   <parent>
     <groupId>com.acme</groupId>
     <artifactId>parent-pom</artifactId>
-    <version>0.4.1</version>
+    <version>0.4.2-SNAPSHOT</version>
   </parent>`;

export const AskWorkspaceView: React.FC = () => {
  const [pipeline] = useState(() => new MultimodalIngestionPipeline());
  const [registry] = useState(() => ProviderRegistry.getInstance());

  const [activeMode, setActiveMode] = useState<OperatingMode>(registry.getActiveMode());
  const [prompt, setPrompt] = useState('Why did this Jenkins pipeline fail? Compare the error log with pom.xml diff and identify the first meaningful failure.');
  const [attachments, setAttachments] = useState<RawInputItem[]>([
    { filename: 'jenkins_pipeline.log', content: SAMPLE_LOG_CONTENT },
    { filename: 'pom_version_update.diff', content: SAMPLE_DIFF_CONTENT },
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [evidencePackage, setEvidencePackage] = useState<EvidencePackage | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    summary: string;
    facts: Array<{ statement: string; citation: string }>;
    inferences: Array<{ statement: string; confidence: number; rationale: string }>;
    unknowns: string[];
    suggestedActions: string[];
    markdown: string;
  } | null>(null);

  const [aiResponse, setAiResponse] = useState<AnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedMd, setCopiedMd] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  useEffect(() => {
    return registry.onModeChange((m) => setActiveMode(m));
  }, [registry]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: content || `[Binary/Document placeholder: ${file.name}]`,
            sizeBytes: file.size,
          },
        ]);
      };
      reader.readAsText(file);
    });
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    if (evidencePackage) {
      setEvidencePackage(null);
      setAnalysisResult(null);
      setAiResponse(null);
      setErrorMsg(null);
    }
  };

  const handleRunClick = () => {
    if (attachments.length === 0 && !prompt.trim()) return;
    setErrorMsg(null);

    // If Cloud Gemini is chosen, require explicit consent modal first
    if (activeMode === 'cloud_ai') {
      setIsConsentModalOpen(true);
      return;
    }

    executePipeline(false);
  };

  const handleConsentConfirm = () => {
    setIsConsentModalOpen(false);
    executePipeline(true);
  };

  const executePipeline = async (userConsentGiven: boolean) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      // Step 1: Run multimodal ingestion pipeline (secret scanning, windowing, extraction)
      const pkg = await pipeline.process(attachments, prompt);
      const answer = MultimodalIngestionPipeline.answerQuestion(pkg, prompt);

      setEvidencePackage(pkg);
      setAnalysisResult(answer);

      // Step 2: If in Local AI (Ollama) or Cloud AI (Gemini), run provider enhancement
      if (activeMode === 'local_ai' || activeMode === 'cloud_ai') {
        const evidenceSnippets = pkg.items.map((it) => ({
          source: it.filename,
          content: it.extractedText,
        }));

        const provider = registry.getActiveProvider();
        const resp = await provider.analyze({
          prompt,
          evidenceSnippets,
          userConsentGiven,
          systemInstruction:
            'You are DevRelief, an engineering copilot. Base answers strictly on the attached evidence artifacts. Cite files and line numbers where possible. Mark inferences as unverified.',
        });
        setAiResponse(resp);
      } else {
        setAiResponse(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyMarkdown = () => {
    const textToCopy = aiResponse?.text || analysisResult?.markdown || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const combinedPayloadForConsent = `${prompt}\n\n${attachments.map((a) => `[${a.filename}]\n${a.content}`).join('\n')}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cloud Consent Modal */}
      <CloudConsentModal
        isOpen={isConsentModalOpen}
        modelId={registry.getGeminiProvider().getSelectedModel()}
        payloadText={combinedPayloadForConsent}
        attachments={attachments.map((a) => ({ filename: a.filename, sizeBytes: a.sizeBytes }))}
        onConfirm={handleConsentConfirm}
        onCancel={() => setIsConsentModalOpen(false)}
      />

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-700/60">
              Screen B: Ask DevRelief
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/60">
              Multimodal Ingestion Active
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pre-Flight Secret Redaction ON</span>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Multimodal Evidence Workspace
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
          Ask questions across heterogenous engineering artifacts (logs, diffs, configuration files, reports, and screenshots). 
          Choose between Pure Deterministic Heuristics, Private Local AI (Ollama + Gemma), or Cloud Gemini with consent.
        </p>

        {/* Engine Mode Pills */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold mr-1">Active Engine:</span>
          
          <button
            onClick={() => {
              setActiveMode('deterministic');
              registry.setActiveMode('deterministic');
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeMode === 'deterministic'
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>1. Deterministic (Pure Offline)</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('local_ai');
              registry.setActiveMode('local_ai');
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeMode === 'local_ai'
                ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-300" />
            <span>2. Local AI (Ollama)</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('cloud_ai');
              registry.setActiveMode('cloud_ai');
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeMode === 'cloud_ai'
                ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-cyan-300" />
            <span>3. Cloud AI (Gemini)</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Staging Area & Prompt) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Prompt & Attachments (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Prompt Input Area */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <label htmlFor="user-prompt" className="text-xs font-semibold text-slate-200">
              Your Question / Task Description
            </label>
            <textarea
              id="user-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Why did this pipeline fail? Compare the screenshot with the log..."
              className="w-full text-xs p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-y"
            />
          </div>

          {/* Attachment Staging Tray */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white">
                  Attached Evidence Items ({attachments.length})
                </h3>
                <p className="text-[11px] text-slate-400">Supported: .log, .txt, .diff, .json, .csv, .pdf, .png</p>
              </div>

              <label className="px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors shadow-sm">
                <Upload className="w-3.5 h-3.5" />
                <span>Attach Files</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Attachment Cards */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-1.5 rounded bg-slate-800 text-slate-400 shrink-0">
                      {att.filename.endsWith('.diff') || att.filename.endsWith('.patch') ? (
                        <FileText className="w-3.5 h-3.5 text-purple-400" />
                      ) : att.filename.endsWith('.log') ? (
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </div>
                    <div className="truncate">
                      <span className="font-mono text-slate-200 truncate block">{att.filename}</span>
                      <span className="text-[10px] text-slate-500">
                        {att.content.split('\n').length} lines • {(att.content.length / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveAttachment(idx)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                    aria-label={`Remove ${att.filename}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {attachments.length === 0 && (
                <div className="text-center py-6 border border-dashed border-slate-800 rounded-lg text-xs text-slate-500">
                  No attachments added yet. Drag-and-drop or click Attach Files above.
                </div>
              )}
            </div>

            {/* Run Action Bar */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                Mode:{' '}
                <strong className={`font-semibold ${
                  activeMode === 'deterministic' ? 'text-emerald-400' :
                  activeMode === 'local_ai' ? 'text-purple-400' : 'text-cyan-400'
                }`}>
                  {activeMode === 'deterministic' ? 'Deterministic Rule Engine' :
                   activeMode === 'local_ai' ? `Ollama (${registry.getOllamaProvider().getSelectedModel() || 'Local'})` :
                   `Gemini (${registry.getGeminiProvider().getSelectedModel()})`}
                </strong>
              </span>

              <button
                onClick={handleRunClick}
                disabled={isProcessing || (attachments.length === 0 && !prompt.trim())}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {isProcessing
                    ? 'Processing Evidence...'
                    : activeMode === 'cloud_ai'
                    ? 'Analyze via Gemini'
                    : activeMode === 'local_ai'
                    ? 'Analyze via Ollama'
                    : 'Analyze Deterministically'}
                </span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>Execution Error</span>
              </div>
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Right Column: Ingestion Status & Warnings (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Pipeline Ingestion Manifest</span>
            </h3>

            {evidencePackage ? (
              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Package ID</span>
                  <span className="font-mono text-slate-200">{evidencePackage.packageId}</span>
                </div>

                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Total Evidence Items</span>
                  <span className="font-mono text-emerald-400 font-semibold">{evidencePackage.items.length}</span>
                </div>

                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Secret Redactions</span>
                  <span className={`font-mono font-semibold ${
                    evidencePackage.hasSecretsRedacted ? 'text-amber-400' : 'text-slate-400'
                  }`}>
                    {evidencePackage.hasSecretsRedacted ? 'Credentials Masked' : 'None Detected'}
                  </span>
                </div>

                {evidencePackage.warnings.length > 0 && (
                  <div className="p-3 rounded bg-amber-950/30 border border-amber-800/60 text-amber-300 text-[11px] space-y-1">
                    <div className="font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ingestion Warnings ({evidencePackage.warnings.length})</span>
                    </div>
                    {evidencePackage.warnings.map((w, i) => (
                      <p key={i} className="leading-tight">• {w}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Click <strong>Analyze Evidence</strong> to execute the multimodal pipeline on your staged items.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AI Enhanced Output Card (when Ollama or Gemini is active) */}
      {aiResponse && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h2 className="text-base font-bold text-white">AI Provider Synthesis</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-semibold">
                  {aiResponse.provenance.providerDisplayName} ({aiResponse.provenance.modelId})
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                  EPISTEMIC: {aiResponse.provenance.epistemicClassification.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Processed in {aiResponse.provenance.executionDurationMs}ms • Locality: {aiResponse.provenance.locality.toUpperCase()} • {aiResponse.provenance.redactedSecretsCount} secrets redacted pre-flight.
              </p>
            </div>

            <button
              onClick={copyMarkdown}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700 self-start sm:self-auto"
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMd ? 'Copied Output' : 'Copy AI Output'}</span>
            </button>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
            {aiResponse.text}
          </div>
        </div>
      )}

      {/* Structured Deterministic Answer Display */}
      {analysisResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Deterministic Grounded Answer</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
                  CONFIRMED FACTS & INFERENCES
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                All findings are grounded strictly in the supplied attachments.
              </p>
            </div>

            <button
              onClick={copyMarkdown}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700 self-start sm:self-auto"
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMd ? 'Copied Markdown' : 'Copy Markdown'}</span>
            </button>
          </div>

          {/* Executive Summary Card */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed">
            <h3 className="font-semibold text-white mb-1">Executive Summary</h3>
            <p>{analysisResult.summary}</p>
          </div>

          {/* Facts vs Inferences vs Unknowns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Confirmed Facts */}
            <div className="border border-emerald-900/60 bg-slate-950/70 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Confirmed Facts ({analysisResult.facts.length})
                </h4>
              </div>
              <ul className="text-xs text-slate-300 space-y-2">
                {analysisResult.facts.map((f, i) => (
                  <li key={i} className="border-b border-slate-800/60 pb-1.5 last:border-none">
                    <p>{f.statement}</p>
                    <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">
                      Citation: {f.citation}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Inferences */}
            <div className="border border-amber-900/60 bg-slate-950/70 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Inferences & Hypotheses ({analysisResult.inferences.length})
                </h4>
              </div>
              <ul className="text-xs text-slate-300 space-y-2">
                {analysisResult.inferences.map((inf, i) => (
                  <li key={i} className="border-b border-slate-800/60 pb-1.5 last:border-none">
                    <p>{inf.statement}</p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Rationale: {inf.rationale} ({Math.round(inf.confidence * 100)}% confidence)
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Unknowns */}
            <div className="border border-slate-700/60 bg-slate-950/70 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Unknowns ({analysisResult.unknowns.length})
                </h4>
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5">
                {analysisResult.unknowns.map((u, i) => (
                  <li key={i}>• {u}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actionable Next Steps */}
          {analysisResult.suggestedActions.length > 0 && (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <h4 className="font-semibold text-white">Suggested Next Diagnostic Steps</h4>
              <ul className="space-y-1 text-slate-300">
                {analysisResult.suggestedActions.map((action, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
