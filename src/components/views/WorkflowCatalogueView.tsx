/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Role, ROLE_DEFINITIONS, WorkflowId } from '../../types/workflow.ts';
import { WORKFLOW_CATALOGUE, getWorkflowsForRole } from '../../engine/registry.ts';
import { NavView } from '../shell/Sidebar.tsx';
import {
  Search,
  Filter,
  ArrowRight,
  GitCommit,
  CheckCircle2,
  Cpu,
  FileText,
  BookOpen,
} from 'lucide-react';

interface WorkflowCatalogueViewProps {
  currentRole: Role;
  onNavigate: (view: NavView) => void;
  onSelectWorkflow?: (id: WorkflowId) => void;
  onOpenSpecs: () => void;
}

export const WorkflowCatalogueView: React.FC<WorkflowCatalogueViewProps> = ({
  currentRole,
  onNavigate,
  onSelectWorkflow,
  onOpenSpecs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAllRoles, setFilterAllRoles] = useState(false);

  const roleDef = ROLE_DEFINITIONS[currentRole];
  const baseList = filterAllRoles ? WORKFLOW_CATALOGUE : getWorkflowsForRole(currentRole);

  const filteredWorkflows = baseList.filter((wf) => {
    const q = searchQuery.toLowerCase();
    return (
      wf.name.toLowerCase().includes(q) ||
      wf.id.toLowerCase().includes(q) ||
      wf.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Workflow Catalogue</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {filterAllRoles ? (
              <span>Showing all 10 delivery workflows across all roles</span>
            ) : (
              <span>Showing workflows eligible for <strong>{roleDef.name}</strong></span>
            )}
          </p>
        </div>

        {/* Search & Role Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workflows by keyword..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setFilterAllRoles(!filterAllRoles)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filterAllRoles
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{filterAllRoles ? 'Filtered: All' : 'Active Role Only'}</span>
          </button>
        </div>
      </div>

      {/* Workflow Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkflows.map((wf) => {
          const isImplemented = wf.status === 'implemented';
          return (
            <div
              key={wf.id}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${
                isImplemented
                  ? 'bg-slate-900/90 border-blue-900/60 shadow-sm'
                  : 'bg-slate-900/50 border-slate-800 opacity-90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-blue-400">{wf.id}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      isImplemented
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isImplemented ? 'Available' : 'Planned'}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-white mb-1.5">{wf.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{wf.description}</p>

                {/* Input Requirements */}
                <div className="space-y-1.5 mb-4">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    Required Inputs
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {wf.supportedFormats.map((fmt) => (
                      <span
                        key={fmt}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">
                  {wf.engineType === 'deterministic' ? 'Deterministic Core' : 'AI Assisted'}
                </span>

                {isImplemented ? (
                  <button
                    onClick={() => {
                      if (onSelectWorkflow) {
                        onSelectWorkflow(wf.id);
                      } else {
                        onNavigate('digest');
                      }
                    }}
                    className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span>Run Workflow</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={onOpenSpecs}
                    className="text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                    <span>View Spec</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredWorkflows.length === 0 && (
        <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-slate-800 p-8">
          <p className="text-sm text-slate-400">No workflows found matching "{searchQuery}".</p>
        </div>
      )}
    </div>
  );
};
