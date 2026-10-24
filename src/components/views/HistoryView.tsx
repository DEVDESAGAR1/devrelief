/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HistoryStore } from '../../storage/history-store.ts';
import { ExecutionHistoryEntry, ExecutionStatus, HistorySettings } from '../../types/history.ts';
import { Role, WorkflowId, ROLE_DEFINITIONS } from '../../types/workflow.ts';
import { OperatingMode } from '../../types/provider.ts';
import {
  History as HistoryIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Download,
  Filter,
  Search,
  Shield,
  Cpu,
  Cloud,
  FileText,
  RotateCcw,
  Eye,
  X,
  ExternalLink,
  Settings as SettingsIcon,
} from 'lucide-react';

interface HistoryViewProps {
  onRerunWorkflow?: (workflowId: WorkflowId, initialText?: string, sourceName?: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onRerunWorkflow }) => {
  const [store] = useState(() => HistoryStore.getInstance());
  const [entries, setEntries] = useState<ExecutionHistoryEntry[]>([]);
  const [settings, setSettings] = useState<HistorySettings>(store.getSettings());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');
  const [providerFilter, setProviderFilter] = useState<OperatingMode | 'all'>('all');
  const [selectedEntry, setSelectedEntry] = useState<ExecutionHistoryEntry | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    refreshHistory();
  }, []);

  const refreshHistory = () => {
    setEntries(store.getAll());
    setSettings(store.getSettings());
  };

  const filteredEntries = entries.filter((item) => {
    if (roleFilter !== 'all' && item.targetRole !== roleFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (providerFilter !== 'all' && item.providerModeRequested !== providerFilter) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      item.workflowName.toLowerCase().includes(query) ||
      item.workflowId.toLowerCase().includes(query) ||
      item.summary.toLowerCase().includes(query) ||
      item.providerActuallyUsed.toLowerCase().includes(query) ||
      item.evidenceSources.some((s) => s.toLowerCase().includes(query))
    );
  });

  const handleDeleteEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    store.deleteEntry(id);
    refreshHistory();
    if (selectedEntry?.id === id) {
      setSelectedEntry(null);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all workflow execution history? This action is permanent.')) {
      store.clearAll();
      refreshHistory();
      setSelectedEntry(null);
    }
  };

  const handleExport = () => {
    const jsonStr = store.exportHistory();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devrelief-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleLogging = () => {
    const updated = store.updateSettings({ enabled: !settings.enabled });
    setSettings(updated);
  };

  const handleUpdateMaxRetention = (val: number) => {
    const updated = store.updateSettings({ maxEntries: val });
    setSettings(updated);
    refreshHistory();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Execution History</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Local record of completed and failed workflow runs with audit provenance and privacy controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Privacy & Retention</span>
          </button>

          <button
            onClick={handleExport}
            disabled={entries.length === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export History</span>
          </button>

          <button
            onClick={handleClearAll}
            disabled={entries.length === 0}
            className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 disabled:opacity-40 text-red-300 border border-red-800/80 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Logging Status Banner */}
      {!settings.enabled && (
        <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>
              <strong>History logging is paused.</strong> New workflow executions will not be recorded.
            </span>
          </div>
          <button
            onClick={handleToggleLogging}
            className="text-[11px] underline font-semibold hover:text-white"
          >
            Re-enable Logging
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history by workflow, summary text, source file, or provider..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            {Object.entries(ROLE_DEFINITIONS).map(([key, def]) => (
              <option key={key} value={key}>
                {def.name}
              </option>
            ))}
          </select>

          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value as any)}
            className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Modes</option>
            <option value="deterministic">Deterministic Engine</option>
            <option value="local_ai">Local Ollama</option>
            <option value="cloud_ai">Cloud Gemini</option>
          </select>
        </div>
      </div>

      {/* History Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <HistoryIcon className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No execution history recorded</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || providerFilter !== 'all'
              ? 'No executions match your active search filters.'
              : 'Run a workflow in the Workflow Runner to record execution entries.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((item) => {
            return (
              <div
                key={item.id}
                onClick={() => setSelectedEntry(item)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all cursor-pointer space-y-2 group shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.status === 'succeeded' ? (
                      <span className="p-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : item.status === 'failed' ? (
                      <span className="p-1 rounded bg-red-950 text-red-400 border border-red-800/80">
                        <AlertCircle className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="p-1 rounded bg-amber-950 text-amber-400 border border-amber-800/80">
                        <Clock className="w-4 h-4" />
                      </span>
                    )}

                    <span className="text-[11px] font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-950 border border-blue-800/60">
                      {item.workflowId}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                      {item.workflowName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(item.completedAt || item.startedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">({item.durationMs}ms)</span>
                    <button
                      onClick={(e) => handleDeleteEntry(item.id, e)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2">{item.summary}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      Mode: <strong className="text-slate-300 font-normal">{item.providerModeRequested}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      Used: <strong className="text-emerald-400 font-normal">{item.providerActuallyUsed}</strong>
                    </span>
                    {item.evidenceSources.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400 truncate max-w-xs">
                          <FileText className="w-3 h-3" />
                          <span>{item.evidenceSources.join(', ')}</span>
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.epistemicRating && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                        {item.epistemicRating}
                      </span>
                    )}
                    <span className="text-xs text-blue-400 flex items-center gap-1 group-hover:underline">
                      <Eye className="w-3 h-3" />
                      <span>Details</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Execution Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white">Execution Record #{selectedEntry.id}</h2>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Workflow</span>
                <span className="font-semibold text-white">{selectedEntry.workflowId}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Status</span>
                <span
                  className={`font-semibold capitalize ${
                    selectedEntry.status === 'succeeded' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {selectedEntry.status}
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Duration</span>
                <span className="font-semibold text-white">{selectedEntry.durationMs}ms</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Provider Executed</span>
                <span className="font-semibold text-emerald-400 truncate block">
                  {selectedEntry.providerActuallyUsed}
                </span>
              </div>
            </div>

            {/* Provider Distinction Banner */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Requested Mode:</span>
                <span className="font-mono text-slate-200">{selectedEntry.providerModeRequested}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Actual Engine Used:</span>
                <span className="font-mono text-emerald-400">{selectedEntry.providerActuallyUsed}</span>
              </div>
              {selectedEntry.modelUsed && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Model Identifier:</span>
                  <span className="font-mono text-slate-200">{selectedEntry.modelUsed}</span>
                </div>
              )}
            </div>

            {/* Evidence Sources */}
            {selectedEntry.evidenceSources.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">Evidence Sources:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEntry.evidenceSources.map((src, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 text-xs font-mono"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div>
              <span className="text-xs font-semibold text-slate-300 block mb-1">Execution Summary:</span>
              <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedEntry.summary}
              </p>
            </div>

            {/* Output Markdown Preview */}
            {selectedEntry.resultMarkdownPreview && (
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">Output Preview:</span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {selectedEntry.resultMarkdownPreview}
                </pre>
              </div>
            )}

            {/* Error Details */}
            {selectedEntry.errorDetails && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs space-y-1">
                <span className="font-semibold block">Error Details:</span>
                <p className="font-mono text-[11px] whitespace-pre-wrap">{selectedEntry.errorDetails}</p>
              </div>
            )}

            {/* Epistemic Disclaimers */}
            {selectedEntry.disclaimers && selectedEntry.disclaimers.length > 0 && (
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                {selectedEntry.disclaimers.map((d, i) => (
                  <p key={i}>• {d}</p>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={(e) => handleDeleteEntry(selectedEntry.id, e)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>

              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy & Retention Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white">History Privacy Controls</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Logging Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-semibold text-white block">Execution History Logging</span>
                  <span className="text-[11px] text-slate-400">Save audit records of completed runs</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLogging}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    settings.enabled ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Retention Limit Slider */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Retention Cap:</span>
                  <span className="font-mono text-blue-400 font-bold">{settings.maxEntries} entries</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={settings.maxEntries}
                  onChange={(e) => handleUpdateMaxRetention(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600"
                />
                <span className="text-[11px] text-slate-500 block">
                  Oldest entries beyond this limit are automatically purged.
                </span>
              </div>

              {/* Local Storage Statement */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300 block">Zero Cloud Exposure:</span>
                <p>
                  Execution history is strictly stored in your browser's private origin storage.
                  Secrets are redacted before history entry creation.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
