/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RecipeStore } from '../../storage/recipe-store.ts';
import { Recipe, CURRENT_RECIPE_SCHEMA_VERSION } from '../../types/recipe.ts';
import { WORKFLOW_CATALOGUE } from '../../engine/registry.ts';
import { Role, WorkflowId, ROLE_DEFINITIONS } from '../../types/workflow.ts';
import { OperatingMode } from '../../types/provider.ts';
import {
  BookmarkCheck,
  Plus,
  Play,
  Copy,
  Trash2,
  Edit,
  Download,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Shield,
  Cpu,
  Cloud,
  FileCode,
  Tag,
  X,
  RefreshCw,
} from 'lucide-react';

interface RecipesViewProps {
  onRunRecipe: (recipe: Recipe) => void;
  currentRole: Role;
}

export const RecipesView: React.FC<RecipesViewProps> = ({ onRunRecipe, currentRole }) => {
  const [store] = useState(() => RecipeStore.getInstance());
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [providerFilter, setProviderFilter] = useState<OperatingMode | 'all'>('all');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formWorkflowId, setFormWorkflowId] = useState<WorkflowId>('WF-DEV-01');
  const [formRole, setFormRole] = useState<Role>(currentRole);
  const [formProvider, setFormProvider] = useState<OperatingMode>('deterministic');
  const [formInputText, setFormInputText] = useState('');
  const [formSourceName, setFormSourceName] = useState('');
  const [formAux1, setFormAux1] = useState('');
  const [formAux2, setFormAux2] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Import / Export state
  const [importStatus, setImportStatus] = useState<{ count?: number; errors?: string[] } | null>(null);

  useEffect(() => {
    refreshRecipes();
  }, []);

  const refreshRecipes = () => {
    setRecipes(store.getAll());
  };

  const filteredRecipes = recipes.filter((r) => {
    if (roleFilter !== 'all' && r.targetRole !== roleFilter) return false;
    if (providerFilter !== 'all' && r.providerPreference !== providerFilter) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const tagMatch = r.tags.some((t) => t.toLowerCase().includes(query));
    return (
      r.name.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query) ||
      r.workflowId.toLowerCase().includes(query) ||
      tagMatch
    );
  });

  const handleOpenCreate = () => {
    setEditingRecipeId(null);
    setFormName('');
    setFormDesc('');
    setFormWorkflowId('WF-DEV-01');
    setFormRole(currentRole);
    setFormProvider('deterministic');
    setFormInputText('');
    setFormSourceName('evidence.log');
    setFormAux1('');
    setFormAux2('');
    setFormTags('template, daily');
    setFormErrors([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setFormName(recipe.name);
    setFormDesc(recipe.description);
    setFormWorkflowId(recipe.workflowId);
    setFormRole(recipe.targetRole);
    setFormProvider(recipe.providerPreference || 'deterministic');
    setFormInputText(recipe.inputs.inputText || '');
    setFormSourceName(recipe.inputs.sourceName || '');
    setFormAux1(recipe.inputs.aux1 || '');
    setFormAux2(recipe.inputs.aux2 || '');
    setFormTags(recipe.tags.join(', '));
    setFormErrors([]);
    setIsModalOpen(true);
  };

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const result = store.save(
      {
        name: formName,
        description: formDesc,
        workflowId: formWorkflowId,
        targetRole: formRole,
        providerPreference: formProvider,
        inputs: {
          inputText: formInputText,
          sourceName: formSourceName,
          aux1: formAux1,
          aux2: formAux2,
        },
        tags: tagsArray,
      },
      editingRecipeId || undefined
    );

    if (!result.success) {
      setFormErrors(result.errors || ['Failed to save recipe.']);
      return;
    }

    setIsModalOpen(false);
    refreshRecipes();
  };

  const handleDuplicate = (id: string) => {
    store.duplicate(id);
    refreshRecipes();
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the recipe "${name}"?`)) {
      store.delete(id);
      refreshRecipes();
    }
  };

  const handleExport = () => {
    const jsonStr = store.exportRecipes();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devrelief-recipes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = store.importRecipes(content);
      refreshRecipes();
      setImportStatus({ count: res.imported, errors: res.errors });
      setTimeout(() => setImportStatus(null), 6000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Workflow Recipes</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Reusable templates, standard input defaults, and provider configurations for your delivery workflows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
            title="Export recipes safely to JSON"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export</span>
          </button>

          <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>

          <button
            onClick={handleOpenCreate}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Recipe</span>
          </button>
        </div>
      </div>

      {/* Import Notification Banner */}
      {importStatus && (
        <div
          className={`p-3 rounded-lg border text-xs space-y-1 ${
            importStatus.errors && importStatus.errors.length > 0
              ? 'bg-amber-950/60 border-amber-800 text-amber-200'
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {importStatus.errors && importStatus.errors.length > 0 ? (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>
              Imported {importStatus.count || 0} recipe(s) successfully.
            </span>
          </div>
          {importStatus.errors && importStatus.errors.length > 0 && (
            <ul className="list-disc list-inside text-amber-300/90 text-[11px]">
              {importStatus.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes by name, workflow ID, description, or tags..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Delivery Roles</option>
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
            <option value="all">All Provider Modes</option>
            <option value="deterministic">Deterministic Engine</option>
            <option value="local_ai">Local Ollama</option>
            <option value="cloud_ai">Cloud Gemini</option>
          </select>

          <button
            onClick={() => {
              setSearchQuery('');
              setRoleFilter('all');
              setProviderFilter('all');
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset filters"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recipes Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <FileCode className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No recipes found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || roleFilter !== 'all' || providerFilter !== 'all'
              ? 'Try relaxing your search terms or filters.'
              : 'Create your first recipe to save repeatable workflow configurations.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => {
            const wfDef = WORKFLOW_CATALOGUE.find((w) => w.id === recipe.workflowId);
            const isValidWorkflow = Boolean(wfDef);

            return (
              <div
                key={recipe.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all space-y-3 group shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/60 font-semibold">
                      {recipe.workflowId}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        v{recipe.version}
                      </span>
                      {recipe.providerPreference === 'deterministic' && (
                        <span className="p-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80" title="Deterministic Engine">
                          <Shield className="w-3 h-3" />
                        </span>
                      )}
                      {recipe.providerPreference === 'local_ai' && (
                        <span className="p-1 rounded bg-purple-950 text-purple-400 border border-purple-800/80" title="Local Ollama">
                          <Cpu className="w-3 h-3" />
                        </span>
                      )}
                      {recipe.providerPreference === 'cloud_ai' && (
                        <span className="p-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80" title="Cloud Gemini">
                          <Cloud className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                    {recipe.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    {recipe.description || 'Configured workflow template.'}
                  </p>

                  {!isValidWorkflow && (
                    <div className="mt-2 text-[10px] text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Workflow definition not registered</span>
                    </div>
                  )}

                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {recipe.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(recipe)}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Edit recipe"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(recipe.id)}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Duplicate recipe"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(recipe.id, recipe.name)}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete recipe"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => onRunRecipe(recipe)}
                    disabled={!isValidWorkflow}
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run Recipe</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Recipe Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white">
                  {editingRecipeId ? 'Edit Recipe' : 'Create Workflow Recipe'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-red-300">
                  <AlertCircle className="w-4 h-4" />
                  <span>Validation Errors</span>
                </div>
                <ul className="list-disc list-inside">
                  {formErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSaveRecipe} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Recipe Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Daily Standup Digest Template"
                  className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What is this recipe used for?"
                  className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Workflow *</label>
                  <select
                    value={formWorkflowId}
                    onChange={(e) => setFormWorkflowId(e.target.value as WorkflowId)}
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {WORKFLOW_CATALOGUE.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.id} — {w.name.split(':')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as Role)}
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {Object.entries(ROLE_DEFINITIONS).map(([k, def]) => (
                      <option key={k} value={k}>
                        {def.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Provider Preference</label>
                  <select
                    value={formProvider}
                    onChange={(e) => setFormProvider(e.target.value as OperatingMode)}
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="deterministic">Deterministic Engine</option>
                    <option value="local_ai">Local Ollama</option>
                    <option value="cloud_ai">Cloud Gemini</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Source Name / Reference</label>
                  <input
                    type="text"
                    value={formSourceName}
                    onChange={(e) => setFormSourceName(e.target.value)}
                    placeholder="e.g. git_history.log"
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="e.g. daily, standup, git"
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Context / Auxiliary 1</label>
                  <input
                    type="text"
                    value={formAux1}
                    onChange={(e) => setFormAux1(e.target.value)}
                    placeholder="e.g. Target User / Meeting Title / Project"
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Context / Auxiliary 2</label>
                  <input
                    type="text"
                    value={formAux2}
                    onChange={(e) => setFormAux2(e.target.value)}
                    placeholder="e.g. Business Objective / Period"
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Default Input Template Text</label>
                <textarea
                  rows={4}
                  value={formInputText}
                  onChange={(e) => setFormInputText(e.target.value)}
                  placeholder="Preset input text or template to prefill when running this recipe..."
                  className="w-full font-mono text-xs p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                />
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Secret scanning active: API keys, tokens, or credentials will be rejected during recipe validation.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm"
                >
                  {editingRecipeId ? 'Save Changes' : 'Create Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
