/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LocalSearchIndex, SearchResultItem, SearchEntityType } from '../../storage/search-index.ts';
import { Role, WorkflowId, ROLE_DEFINITIONS } from '../../types/workflow.ts';
import { OperatingMode } from '../../types/provider.ts';
import { ExecutionStatus } from '../../types/history.ts';
import { Recipe } from '../../types/recipe.ts';
import { RecipeStore } from '../../storage/recipe-store.ts';
import {
  Search,
  Layers,
  BookmarkCheck,
  History,
  Filter,
  CheckCircle2,
  AlertCircle,
  Play,
  Eye,
  Shield,
  Cpu,
  Cloud,
  FileCode,
  Tag,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface LocalSearchViewProps {
  onSelectWorkflow: (wfId: WorkflowId) => void;
  onRunRecipe: (recipe: Recipe) => void;
  onViewHistory?: (historyId: string) => void;
  initialQuery?: string;
}

export const LocalSearchView: React.FC<LocalSearchViewProps> = ({
  onSelectWorkflow,
  onRunRecipe,
  onViewHistory,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [entityType, setEntityType] = useState<SearchEntityType>('all');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');
  const [providerFilter, setProviderFilter] = useState<OperatingMode | 'all'>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);

  useEffect(() => {
    executeSearch();
  }, [query, entityType, roleFilter, statusFilter, providerFilter]);

  const executeSearch = () => {
    const searchResults = LocalSearchIndex.search(query, {
      entityType,
      role: roleFilter,
      status: statusFilter,
      providerMode: providerFilter,
    });
    setResults(searchResults);
  };

  const handleAction = (item: SearchResultItem) => {
    if (item.type === 'workflow' && item.targetWorkflowId) {
      onSelectWorkflow(item.targetWorkflowId);
    } else if (item.type === 'recipe' && item.recipeId) {
      const rcp = RecipeStore.getInstance().getById(item.recipeId);
      if (rcp) {
        onRunRecipe(rcp);
      } else if (item.targetWorkflowId) {
        onSelectWorkflow(item.targetWorkflowId);
      }
    } else if (item.type === 'history' && item.historyId && onViewHistory) {
      onViewHistory(item.historyId);
    } else if (item.targetWorkflowId) {
      onSelectWorkflow(item.targetWorkflowId);
    }
  };

  const workflowCount = results.filter((r) => r.type === 'workflow').length;
  const recipeCount = results.filter((r) => r.type === 'recipe').length;
  const historyCount = results.filter((r) => r.type === 'history').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Search className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Local Workbench Search</h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Fast, deterministic search indexing all 10 registered workflows, saved recipes, and execution history.
        </p>
      </div>

      {/* Main Search Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords, workflow code (e.g. WF-DEV-01), recipes, error logs, or evidence sources..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            autoFocus
          />
        </div>

        {/* Entity Scopes & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setEntityType('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                entityType === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setEntityType('workflow')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                entityType === 'workflow'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Workflows ({workflowCount})</span>
            </button>
            <button
              onClick={() => setEntityType('recipe')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                entityType === 'recipe'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Recipes ({recipeCount})</span>
            </button>
            <button
              onClick={() => setEntityType('history')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                entityType === 'history'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({historyCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Providers</option>
              <option value="deterministic">Deterministic Engine</option>
              <option value="local_ai">Local Ollama</option>
              <option value="cloud_ai">Cloud Gemini</option>
            </select>

            <button
              onClick={() => {
                setQuery('');
                setEntityType('all');
                setRoleFilter('all');
                setStatusFilter('all');
                setProviderFilter('all');
              }}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              title="Reset search"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Results List */}
      {results.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <Search className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No matching items found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your query or resetting the entity and role filters above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((item) => (
            <div
              key={item.id}
              onClick={() => handleAction(item)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all cursor-pointer group space-y-2 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      item.type === 'workflow'
                        ? 'bg-blue-950 text-blue-400 border border-blue-800'
                        : item.type === 'recipe'
                        ? 'bg-purple-950 text-purple-400 border border-purple-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {item.type}
                  </span>
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                    {item.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-mono text-slate-400">{item.subtitle}</span>
                  <span className="text-xs text-blue-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>{item.type === 'recipe' ? 'Run' : item.type === 'workflow' ? 'Open' : 'View'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{item.description}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {item.timestamp && (
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
