/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WorkflowEngine } from '../../engine/kernel.ts';
import { GitDailyDigestWorkflow } from '../../workflows/dev/git-daily-digest/workflow.ts';
import { ChangeSummaryWorkflow } from '../../workflows/dev/change-summary/workflow.ts';
import { CiFailureTriageWorkflow } from '../../workflows/dev/ci-failure-triage/workflow.ts';
import { StoriesGherkinWorkflow } from '../../workflows/po/stories-gherkin-ac/workflow.ts';
import { AmbiguityScannerWorkflow } from '../../workflows/po/ambiguity-scanner/workflow.ts';
import { ActionItemMatrixWorkflow } from '../../workflows/sm/action-item-matrix/workflow.ts';
import { RetroThematicClusterWorkflow } from '../../workflows/sm/retro-thematic-cluster/workflow.ts';
import { SpecTestScenariosWorkflow } from '../../workflows/qa/spec-test-scenarios/workflow.ts';
import { ScreenshotToReproWorkflow } from '../../workflows/qa/screenshot-to-repro/workflow.ts';
import { MultiSourceDeliveryWorkflow } from '../../workflows/em/multi-source-delivery/workflow.ts';
import {
  WorkflowId,
  WorkflowExecutionState,
  WorkflowResult,
  ExecutionFailure,
} from '../../types/workflow.ts';
import { WORKFLOW_CATALOGUE } from '../../engine/registry.ts';
import { ProviderRegistry } from '../../providers/registry.ts';
import { OperatingMode, AnalysisResponse } from '../../types/provider.ts';
import { CloudConsentModal } from '../modals/CloudConsentModal.tsx';
import {
  Play,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Upload,
  RefreshCw,
  GitCommit,
  GitPullRequest,
  Activity,
  ListTodo,
  CalendarCheck,
  Sparkles,
  ClipboardCheck,
  Bug,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Shield,
  Cpu,
  Cloud,
} from 'lucide-react';

// SAMPLES FOR ALL 10 WORKFLOWS
const SAMPLES: Record<WorkflowId, { text: string; source: string; meta?: Record<string, string> }> = {
  'WF-DEV-01': {
    source: 'git_history.log',
    text: `a1b2c3d4e5f67890123456789012345678901234
Alice Engineer
2026-10-24T10:15:30+00:00
feat(auth): implement biometric session authentication

b2c3d4e5f6a17890123456789012345678901235
Bob Developer
2026-10-24T11:20:00+00:00
fix(api): resolve timeout retry loop on 504 gateway errors

c3d4e5f6a1b27890123456789012345678901236
Carol Docs
2026-10-24T12:00:00+00:00
docs: update deployment topology guide and environment variables

e5f6a1b2c3d47890123456789012345678901238
Eve Architect
2026-10-24T14:30:00+00:00
feat(billing)!: change subscription tier schema to usage-based`,
  },
  'WF-DEV-02': {
    source: 'pull_request.diff',
    text: `diff --git a/src/auth.ts b/src/auth.ts
index 1234567..89abcdef 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,3 +10,4 @@
-export function legacyPasswordAuth() { return false; }
+export function biometricAuth() { return true; }
+export function sessionTokenVerify() { return true; }
diff --git a/docs/README.md b/docs/README.md
index abcdef1..2345678 100644
--- a/docs/README.md
+++ b/docs/README.md
@@ -1,2 +1,3 @@
+# System Documentation
+Updated architecture guide with new endpoints.`,
  },
  'WF-DEV-03': {
    source: 'ci_build.log',
    text: `2026-10-24 10:14:00 [INFO] Scanning for projects...
2026-10-24 10:14:15 [INFO] Building Auth Service 1.0.0
2026-10-24 10:14:22 [ERROR] Non-resolvable parent POM for com.acme:auth-service:0.4.1: Could not find artifact
Token: Bearer ya29.a0AfH6SMBsecretToken123456789
2026-10-24 10:14:25 [INFO] BUILD FAILURE (exit code 1)`,
  },
  'WF-PO-01': {
    source: 'discovery_notes.md',
    meta: { targetUser: 'Product Manager', businessObjective: 'Automate weekly reporting workflows' },
    text: `- As a Product Manager, I want to automatically generate release notes from merged PRs so that stakeholder updates require minimal manual curation.
- Allow users to filter customer tickets by severity and tag so that urgent escalations are immediately visible.
- Export all generated tickets directly into downloadable CSV format.
- System must reject uploads exceeding 20 MB with an informative error message.`,
  },
  'WF-PO-02': {
    source: 'feature_specification.md',
    meta: { documentTitle: 'Checkout Flow Redesign PRD' },
    text: `# Checkout Flow Redesign
The new payment processing service must be fast and user-friendly for all global shoppers.
Batch reconciliation will run periodically as appropriate.
Data retention rule A: we will retain checkout transaction logs for 30 days.
Some general explanatory text between paragraphs.
Compliance requirement B: we must retain checkout transaction logs for 90 days.
Payment integration with Klarna is TBD pending API contract from external partner.
Delete user profile without confirmation when requested.`,
  },
  'WF-SM-01': {
    source: 'standup_sync.md',
    meta: { meetingTitle: 'Sprint 42 Weekly Delivery Sync', meetingDate: '2026-10-24' },
    text: `# Sprint 42 Weekly Delivery Sync
Decision: Standardize API responses using RFC 7807 problem details specification.
- Action: Alice to update OpenAPI schema schemas by Friday.
- Action: Bob to refactor auth middleware error handlers by 2026-10-28.
- Discussion topic: evaluate adopting Turbopack in Q1.`,
  },
  'WF-SM-02': {
    source: 'retro_feedback.txt',
    meta: { sprintName: 'Sprint 41' },
    text: `What went well:
- CI pipeline run times dropped by 35% after Docker layer caching.
- Pair programming on critical payment flow prevented defects.

What needs improvement:
- Production deploy was blocked by missing secrets documentation.
- Standup meetings frequently exceeded 20 minutes without focus.
- Flaky end-to-end Cypress tests delayed PR merges.`,
  },
  'WF-QA-01': {
    source: 'checkout_spec.md',
    meta: { featureName: 'Discount Coupon Validation' },
    text: `Feature: Coupon Checkout Application
Rule 1: Coupons with valid discount codes decrease cart total by the specified percentage.
Rule 2: Expired coupons must be rejected with error "Coupon has expired".
Rule 3: Maximum 1 coupon per order.
Rule 4: Order subtotal cannot drop below $0.00.`,
  },
  'WF-QA-02': {
    source: 'console_crash.log',
    meta: { environmentNotes: 'Chrome 130 on macOS Sonoma 14.5', expectedBehaviorNotes: 'Modal should close cleanly without throwing unhandled exceptions.' },
    text: `TypeError: Cannot read properties of undefined (reading 'token')
    at SessionManager.refreshToken (session.ts:42:15)
    at UserProfileModal.onSave (ProfileModal.tsx:88:9)
    at HTMLButtonElement.dispatch (react-dom.js:1204:12)
Host: production-cluster-01.internal
Authorization: Bearer secret_live_token_999988887777`,
  },
  'WF-EM-01': {
    source: 'sprint_delivery_artifacts.txt',
    meta: { projectLabel: 'DevRelief Platform Core', reportingPeriod: 'Sprint 42 (Oct 10 - Oct 24)' },
    text: `[Git Commit Log]
hash: 7a8b9c0d1e2f3a4b5c6d7e8f0a1b2c3d4e5f6789 | feat(core): complete Milestone 4 and Milestone 5 workflows
hash: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f0a1b | fix(ci): resolve flaky container shutdown in test suite

[Test Execution Summary]
Total Tests: 70 | Passed: 70 | Failed: 0 | Flaky: 0 | Execution Time: 2.4s

[Sprint Blocker Notes]
Blocker 1: Security review approval for OAuth external integration pending from InfoSec.
Risk: Third-party API rate limits during high-load sprint demo.`,
  },
};

interface WorkflowRunnerViewProps {
  initialWorkflowId?: WorkflowId;
}

export const WorkflowRunnerView: React.FC<WorkflowRunnerViewProps> = ({
  initialWorkflowId = 'WF-DEV-01',
}) => {
  const [engine] = useState(() => {
    const e = new WorkflowEngine();
    e.registerWorkflow(new GitDailyDigestWorkflow());
    e.registerWorkflow(new ChangeSummaryWorkflow());
    e.registerWorkflow(new CiFailureTriageWorkflow());
    e.registerWorkflow(new StoriesGherkinWorkflow());
    e.registerWorkflow(new AmbiguityScannerWorkflow());
    e.registerWorkflow(new ActionItemMatrixWorkflow());
    e.registerWorkflow(new RetroThematicClusterWorkflow());
    e.registerWorkflow(new SpecTestScenariosWorkflow());
    e.registerWorkflow(new ScreenshotToReproWorkflow());
    e.registerWorkflow(new MultiSourceDeliveryWorkflow());
    return e;
  });

  const [registry] = useState(() => ProviderRegistry.getInstance());
  const [activeMode, setActiveMode] = useState<OperatingMode>(registry.getActiveMode());

  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowId>(initialWorkflowId);
  const [inputText, setInputText] = useState(SAMPLES[initialWorkflowId].text);
  const [sourceName, setSourceName] = useState(SAMPLES[initialWorkflowId].source);
  const [executionState, setExecutionState] = useState<WorkflowExecutionState>('idle');
  const [result, setResult] = useState<WorkflowResult<any> | null>(null);
  const [failure, setFailure] = useState<ExecutionFailure | null>(null);
  const [copiedMd, setCopiedMd] = useState(false);

  // Auxiliary fields for specific workflows
  const [aux1, setAux1] = useState(SAMPLES[initialWorkflowId].meta?.targetUser || SAMPLES[initialWorkflowId].meta?.meetingTitle || SAMPLES[initialWorkflowId].meta?.featureName || SAMPLES[initialWorkflowId].meta?.projectLabel || '');
  const [aux2, setAux2] = useState(SAMPLES[initialWorkflowId].meta?.businessObjective || SAMPLES[initialWorkflowId].meta?.reportingPeriod || SAMPLES[initialWorkflowId].meta?.expectedBehaviorNotes || '');

  // AI Enhancement state
  const [aiEnhancement, setAiEnhancement] = useState<AnalysisResponse | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isConsentOpen, setIsConsentOpen] = useState(false);

  useEffect(() => {
    return registry.onModeChange((m) => setActiveMode(m));
  }, [registry]);

  useEffect(() => {
    if (initialWorkflowId && initialWorkflowId !== activeWorkflow) {
      switchWorkflow(initialWorkflowId);
    }
  }, [initialWorkflowId]);

  useEffect(() => {
    return engine.onStateChange((state) => {
      setExecutionState(state);
      setResult(engine.getLastResult());
      setFailure(engine.getLastFailure());
    });
  }, [engine]);

  const switchWorkflow = (id: WorkflowId) => {
    setActiveWorkflow(id);
    engine.reset();
    setExecutionState('idle');
    setResult(null);
    setFailure(null);
    setAiEnhancement(null);

    const s = SAMPLES[id];
    setInputText(s.text);
    setSourceName(s.source);
    setAux1(s.meta?.targetUser || s.meta?.meetingTitle || s.meta?.featureName || s.meta?.projectLabel || s.meta?.sprintName || s.meta?.documentTitle || '');
    setAux2(s.meta?.businessObjective || s.meta?.reportingPeriod || s.meta?.expectedBehaviorNotes || '');
  };

  const handleRun = async () => {
    setAiEnhancement(null);
    if (activeWorkflow === 'WF-DEV-01') {
      await engine.executeWorkflow('WF-DEV-01', { rawLog: inputText, sourceName });
    } else if (activeWorkflow === 'WF-DEV-02') {
      await engine.executeWorkflow('WF-DEV-02', { rawDiffOrLog: inputText, sourceName });
    } else if (activeWorkflow === 'WF-DEV-03') {
      await engine.executeWorkflow('WF-DEV-03', { rawLogOrTrace: inputText, sourceName });
    } else if (activeWorkflow === 'WF-PO-01') {
      await engine.executeWorkflow('WF-PO-01', {
        rawNotes: inputText,
        sourceName,
        targetUser: aux1,
        businessObjective: aux2,
      });
    } else if (activeWorkflow === 'WF-PO-02') {
      await engine.executeWorkflow('WF-PO-02', {
        specText: inputText,
        sourceName,
        documentTitle: aux1,
      });
    } else if (activeWorkflow === 'WF-SM-01') {
      await engine.executeWorkflow('WF-SM-01', {
        meetingNotes: inputText,
        sourceName,
        meetingTitle: aux1,
      });
    } else if (activeWorkflow === 'WF-SM-02') {
      await engine.executeWorkflow('WF-SM-02', {
        retroNotes: inputText,
        sourceName,
        sprintName: aux1,
      });
    } else if (activeWorkflow === 'WF-QA-01') {
      await engine.executeWorkflow('WF-QA-01', {
        specText: inputText,
        sourceName,
        featureName: aux1,
      });
    } else if (activeWorkflow === 'WF-QA-02') {
      await engine.executeWorkflow('WF-QA-02', {
        errorLogOrTrace: inputText,
        sourceName,
        expectedBehaviorNotes: aux2,
        environmentNotes: aux1,
      });
    } else if (activeWorkflow === 'WF-EM-01') {
      await engine.executeWorkflow('WF-EM-01', {
        combinedEvidenceText: inputText,
        sourceName,
        projectLabel: aux1,
        reportingPeriod: aux2,
      });
    }
  };

  const handleEnhanceClick = () => {
    if (!result) return;
    if (activeMode === 'cloud_ai') {
      setIsConsentOpen(true);
      return;
    }
    executeAIEnhancement(false);
  };

  const executeAIEnhancement = async (userConsentGiven: boolean) => {
    if (!result) return;
    setIsEnhancing(true);
    try {
      const provider = registry.getActiveProvider();
      const prompt = `Review the following deterministic workflow output for "${activeMeta?.name}". Suggest improvements, alternative edge cases, or clearer wording:\n\n${result.markdown}`;
      const response = await provider.analyze({
        prompt,
        userConsentGiven,
        systemInstruction:
          'You are assisting an engineering team by supplementing a deterministic workflow output with suggested refinements. Label all suggestions as unverified proposals.',
      });
      setAiEnhancement(response);
    } catch (err: unknown) {
      alert(`AI Enhancement Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleReset = () => {
    engine.reset();
    setExecutionState('idle');
    setResult(null);
    setFailure(null);
    setAiEnhancement(null);
  };

  const loadSample = () => {
    const s = SAMPLES[activeWorkflow];
    setInputText(s.text);
    setSourceName(s.source);
    setAux1(s.meta?.targetUser || s.meta?.meetingTitle || s.meta?.featureName || s.meta?.projectLabel || s.meta?.sprintName || s.meta?.documentTitle || '');
    setAux2(s.meta?.businessObjective || s.meta?.reportingPeriod || s.meta?.expectedBehaviorNotes || '');
    handleReset();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSourceName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
      handleReset();
    };
    reader.readAsText(file);
  };

  const copyMarkdown = () => {
    if (!result?.markdown) return;
    navigator.clipboard.writeText(result.markdown);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const activeMeta = WORKFLOW_CATALOGUE.find((w) => w.id === activeWorkflow);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cloud Consent Modal */}
      <CloudConsentModal
        isOpen={isConsentOpen}
        modelId={registry.getGeminiProvider().getSelectedModel()}
        payloadText={result ? `${result.markdown}` : inputText}
        onConfirm={() => {
          setIsConsentOpen(false);
          executeAIEnhancement(true);
        }}
        onCancel={() => setIsConsentOpen(false)}
      />

      {/* Workflow Tabs Header */}
      <div className="space-y-2 border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Select Delivery Workflow (10 Implemented across 5 Roles):
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
              activeMode === 'deterministic'
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                : activeMode === 'local_ai'
                ? 'bg-purple-950/80 text-purple-400 border-purple-800'
                : 'bg-cyan-950/80 text-cyan-400 border-cyan-800'
            }`}>
              {activeMode === 'deterministic' && <Shield className="w-3 h-3 text-emerald-400" />}
              {activeMode === 'local_ai' && <Cpu className="w-3 h-3 text-purple-400" />}
              {activeMode === 'cloud_ai' && <Cloud className="w-3 h-3 text-cyan-400" />}
              <span>
                Engine: {activeMode === 'deterministic' ? 'Deterministic Baseline' : activeMode === 'local_ai' ? 'Local Ollama' : 'Cloud Gemini'}
              </span>
            </span>
          </div>
        </div>

        {/* Workflow Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {WORKFLOW_CATALOGUE.map((wf) => {
            const isSelected = activeWorkflow === wf.id;
            return (
              <button
                key={wf.id}
                onClick={() => switchWorkflow(wf.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
                title={wf.name}
              >
                <span className="font-mono text-[11px] font-bold opacity-80">{wf.id}</span>
                <span className="hidden sm:inline truncate max-w-[120px]">{wf.name.split(':')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workflow Form Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-950 border border-blue-800/60">
                {activeWorkflow}
              </span>
              <h2 className="text-base font-bold text-white">{activeMeta?.name}</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">{activeMeta?.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSample}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Load verified sample data"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Sample</span>
            </button>

            <label className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 cursor-pointer flex items-center gap-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Upload File</span>
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={handleReset}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              title="Reset input"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Auxiliary Metadata Fields (Dynamic per workflow) */}
        {(activeWorkflow === 'WF-PO-01' ||
          activeWorkflow === 'WF-PO-02' ||
          activeWorkflow === 'WF-SM-01' ||
          activeWorkflow === 'WF-SM-02' ||
          activeWorkflow === 'WF-QA-01' ||
          activeWorkflow === 'WF-QA-02' ||
          activeWorkflow === 'WF-EM-01') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                {activeWorkflow === 'WF-PO-01'
                  ? 'Target User / Persona:'
                  : activeWorkflow === 'WF-PO-02'
                  ? 'Document Title:'
                  : activeWorkflow === 'WF-SM-01'
                  ? 'Meeting Title:'
                  : activeWorkflow === 'WF-SM-02'
                  ? 'Sprint Name:'
                  : activeWorkflow === 'WF-QA-01'
                  ? 'Feature / Spec Name:'
                  : activeWorkflow === 'WF-QA-02'
                  ? 'Environment / OS Details:'
                  : 'Project Label / Stream:'}
              </label>
              <input
                type="text"
                value={aux1}
                onChange={(e) => setAux1(e.target.value)}
                placeholder="Optional context label"
                className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                {activeWorkflow === 'WF-PO-01'
                  ? 'Business Objective:'
                  : activeWorkflow === 'WF-EM-01'
                  ? 'Reporting Cadence / Period:'
                  : activeWorkflow === 'WF-QA-02'
                  ? 'Expected Behavior Notes:'
                  : 'Source Label:'}
              </label>
              <input
                type="text"
                value={aux2 || sourceName}
                onChange={(e) => {
                  if (activeWorkflow === 'WF-PO-01' || activeWorkflow === 'WF-EM-01' || activeWorkflow === 'WF-QA-02') {
                    setAux2(e.target.value);
                  } else {
                    setSourceName(e.target.value);
                  }
                }}
                placeholder="Optional supplementary detail"
                className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Input Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5 text-xs text-slate-400">
            <span>Input Evidence Text ({activeMeta?.supportedFormats.join(', ')})</span>
            <span className="font-mono text-[11px] text-slate-500">Source: {sourceName}</span>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (failure) handleReset();
            }}
            rows={9}
            className="w-full font-mono text-xs p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-y"
          />
        </div>

        {/* Failure Banner */}
        {failure && (
          <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/80 text-red-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>Validation / Execution Failure ({failure.code})</span>
            </div>
            <p>{failure.message}</p>
            {failure.validationErrors && (
              <ul className="list-disc list-inside text-red-300/80">
                {failure.validationErrors.map((err, i) => (
                  <li key={i}>{err.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Run Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-400">
            Engine: <strong className="text-emerald-400 font-normal">Deterministic-First Shared Engine</strong> • Target Role:{' '}
            <strong className="text-slate-300 font-normal capitalize">{activeMeta?.targetRole.replace('_', ' ')}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={executionState === 'running' || executionState === 'validating'}
              className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{executionState === 'running' ? 'Executing...' : 'Run Workflow'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Output Display */}
      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Workflow Execution Succeeded</h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                  result.epistemicRating === 'confirmed_fact'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {result.epistemicRating.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeMode !== 'deterministic' && (
                <button
                  onClick={handleEnhanceClick}
                  disabled={isEnhancing}
                  className="px-3 py-1 rounded bg-purple-950/70 hover:bg-purple-900/70 text-purple-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-purple-800 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isEnhancing ? 'Synthesizing...' : 'Generate AI Insights'}</span>
                </button>
              )}

              <button
                onClick={copyMarkdown}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMd ? 'Copied' : 'Copy Output Markdown'}</span>
              </button>
            </div>
          </div>

          {/* Rendered Markdown Output */}
          <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[550px]">
            {result.markdown}
          </pre>

          {/* Epistemic Disclaimers */}
          {result.disclaimers.length > 0 && (
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              {result.disclaimers.map((d, i) => (
                <p key={i}>• {d}</p>
              ))}
            </div>
          )}

          {/* Auxiliary AI Enhancement Panel */}
          {aiEnhancement && (
            <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-purple-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-bold text-purple-300">
                    AI Suggestions ({aiEnhancement.provenance.providerDisplayName} - {aiEnhancement.provenance.modelId})
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                    UNVERIFIED PROPOSAL
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {aiEnhancement.provenance.executionDurationMs}ms
                </span>
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                {aiEnhancement.text}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
