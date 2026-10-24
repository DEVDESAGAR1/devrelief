/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Role, ROLE_DEFINITIONS } from '../../types/workflow.ts';
import { getWorkflowsForRole } from '../../engine/registry.ts';
import { NavView } from '../shell/Sidebar.tsx';
import {
  Compass,
  ArrowRight,
  Shield,
  GitCommit,
  Sparkles,
  Terminal,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';

interface CommandCenterViewProps {
  currentRole: Role;
  onNavigate: (view: NavView) => void;
  onOpenSpecs: () => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  currentRole,
  onNavigate,
  onOpenSpecs,
}) => {
  const roleDef = ROLE_DEFINITIONS[currentRole];
  const roleWorkflows = getWorkflowsForRole(currentRole);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome & Role Context Header */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-blue-950/60 border border-blue-600/40 text-blue-300 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Role Context: {roleDef.name}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Deterministic Engine Ready</span>
          </div>
        </div>

        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white mb-2">
          Make work feel lighter.
        </h1>
        <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed mb-5">
          {roleDef.description} Execute deterministic workflows locally with zero cloud dependencies or silent telemetry.
        </p>

        {/* Dual Quick Launch Banner: Ask Workspace & Dev Workflows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {/* Ask DevRelief Card */}
          <div className="bg-slate-900/90 border border-blue-900/60 rounded-lg p-3.5 sm:p-4 flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-400">Screen B</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                    M2 Active
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">Ask DevRelief (Multimodal)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Attach multiple logs, diffs, and documents. Ask questions and get grounded answers with citations.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('ask')}
              className="w-full px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <span>Open Ask Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dev Workflows Hub Card */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-3.5 sm:p-4 flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-md bg-purple-600/20 text-purple-400 border border-purple-500/30 shrink-0">
                <GitCommit className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-purple-400">Screen D</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                    10 WFs Active (M1–M5)
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">Delivery Workflows Hub</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  10 workflows across Dev, PO, Scrum Master, QA, and Engineering Manager.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('digest')}
              className="w-full px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
            >
              <span>Launch Workflow Runner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recommended Role Workflows Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-white">Role Workflows ({roleWorkflows.length})</h2>
            <p className="text-xs text-slate-400">Tailored to {roleDef.name}</p>
          </div>

          <button
            onClick={() => onNavigate('catalogue')}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
          >
            <span>View All Workflows</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {roleWorkflows.map((wf) => {
            const isImplemented = wf.status === 'implemented';
            return (
              <div
                key={wf.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold text-blue-400">{wf.id}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                        isImplemented
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isImplemented ? 'Available' : 'Planned'}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{wf.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{wf.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500">
                    {wf.engineType === 'deterministic' ? 'Deterministic Core' : 'AI Assisted'}
                  </span>
                  {isImplemented ? (
                    <button
                      onClick={() => onNavigate('digest')}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      <span>Run</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={onOpenSpecs}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Specs
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* System Health & Boundary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-3">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-semibold text-slate-200">Zero Silent Uploads</h4>
            <p className="text-slate-400 text-[11px] mt-0.5">
              100% on-device processing. No telemetry or remote tracking.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-semibold text-slate-200">Epistemic Provenance</h4>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Every finding cites verified source line numbers and hashes.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-3">
          <Terminal className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-semibold text-slate-200">DevWorkBench Separation</h4>
            <p className="text-slate-400 text-[11px] mt-0.5">
              No duplication of Safe Fix or compiler repair logic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
