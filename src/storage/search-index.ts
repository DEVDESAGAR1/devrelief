/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WORKFLOW_CATALOGUE } from '../engine/registry.ts';
import { RecipeStore } from './recipe-store.ts';
import { HistoryStore } from './history-store.ts';
import { Role, WorkflowId } from '../types/workflow.ts';
import { OperatingMode } from '../types/provider.ts';
import { ExecutionStatus } from '../types/history.ts';

export type SearchEntityType = 'all' | 'workflow' | 'recipe' | 'history';

export interface SearchFilters {
  entityType?: SearchEntityType;
  role?: Role | 'all';
  status?: ExecutionStatus | 'all';
  providerMode?: OperatingMode | 'all';
}

export interface SearchResultItem {
  id: string;
  type: 'workflow' | 'recipe' | 'history';
  title: string;
  subtitle: string;
  description: string;
  role?: Role;
  tags: string[];
  status?: string;
  provider?: string;
  timestamp?: string;
  targetWorkflowId?: WorkflowId;
  recipeId?: string;
  historyId?: string;
  score: number;
}

export class LocalSearchIndex {
  /**
   * Execute search across workflows, recipes, and history entries
   */
  public static search(query: string, filters: SearchFilters = {}): SearchResultItem[] {
    const rawTokens = (query || '')
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const results: SearchResultItem[] = [];
    const recipeStore = RecipeStore.getInstance();
    const historyStore = HistoryStore.getInstance();

    const entityType = filters.entityType || 'all';
    const roleFilter = filters.role || 'all';
    const statusFilter = filters.status || 'all';
    const providerFilter = filters.providerMode || 'all';

    // 1. Search Workflows
    if (entityType === 'all' || entityType === 'workflow') {
      for (const wf of WORKFLOW_CATALOGUE) {
        if (roleFilter !== 'all' && wf.targetRole !== roleFilter && !wf.supportedRoles.includes(roleFilter)) {
          continue;
        }

        const searchableText = `${wf.id} ${wf.code} ${wf.name} ${wf.description} ${wf.targetRole} ${wf.supportedFormats.join(' ')} ${wf.requiredInputs.join(' ')}`.toLowerCase();
        const score = LocalSearchIndex.calculateScore(rawTokens, searchableText, wf.name.toLowerCase(), wf.id.toLowerCase());

        if (rawTokens.length === 0 || score > 0) {
          results.push({
            id: `wf_${wf.id}`,
            type: 'workflow',
            title: wf.name,
            subtitle: `${wf.id} • ${wf.targetRole.replace('_', ' ').toUpperCase()}`,
            description: wf.description,
            role: wf.targetRole,
            tags: [wf.id, wf.engineType, ...wf.supportedFormats],
            provider: 'deterministic',
            targetWorkflowId: wf.id,
            score: score + 10, // Slight boost for primary workflows
          });
        }
      }
    }

    // 2. Search Recipes
    if (entityType === 'all' || entityType === 'recipe') {
      const recipes = recipeStore.getAll();
      for (const rcp of recipes) {
        if (roleFilter !== 'all' && rcp.targetRole !== roleFilter) {
          continue;
        }
        if (providerFilter !== 'all' && rcp.providerPreference !== providerFilter) {
          continue;
        }

        const inputsSummary = Object.entries(rcp.inputs || {})
          .map(([k, v]) => `${k}:${v}`)
          .join(' ');
        const searchableText = `${rcp.name} ${rcp.description} ${rcp.workflowId} ${rcp.targetRole} ${rcp.tags.join(' ')} ${inputsSummary}`.toLowerCase();
        const score = LocalSearchIndex.calculateScore(rawTokens, searchableText, rcp.name.toLowerCase(), rcp.workflowId.toLowerCase());

        if (rawTokens.length === 0 || score > 0) {
          results.push({
            id: rcp.id,
            type: 'recipe',
            title: rcp.name,
            subtitle: `Recipe • ${rcp.workflowId} • v${rcp.version}`,
            description: rcp.description || 'Configured workflow template with preset inputs.',
            role: rcp.targetRole,
            tags: rcp.tags,
            provider: rcp.providerPreference,
            timestamp: rcp.updatedAt,
            targetWorkflowId: rcp.workflowId,
            recipeId: rcp.id,
            score: score + 5,
          });
        }
      }
    }

    // 3. Search History
    if (entityType === 'all' || entityType === 'history') {
      const historyEntries = historyStore.getAll();
      for (const entry of historyEntries) {
        if (roleFilter !== 'all' && entry.targetRole !== roleFilter) {
          continue;
        }
        if (statusFilter !== 'all' && entry.status !== statusFilter) {
          continue;
        }
        if (providerFilter !== 'all' && entry.providerModeRequested !== providerFilter) {
          continue;
        }

        const sources = entry.evidenceSources.join(' ');
        const searchableText = `${entry.workflowName} ${entry.workflowId} ${entry.targetRole} ${entry.status} ${entry.providerActuallyUsed} ${entry.summary} ${sources} ${entry.recipeName || ''}`.toLowerCase();
        const score = LocalSearchIndex.calculateScore(rawTokens, searchableText, entry.workflowName.toLowerCase(), entry.workflowId.toLowerCase());

        if (rawTokens.length === 0 || score > 0) {
          results.push({
            id: entry.id,
            type: 'history',
            title: entry.workflowName,
            subtitle: `Execution • ${entry.status.toUpperCase()} • ${entry.providerActuallyUsed}`,
            description: entry.summary || `Executed in ${entry.durationMs}ms`,
            role: entry.targetRole,
            status: entry.status,
            tags: [entry.workflowId, entry.status, entry.providerActuallyUsed],
            provider: entry.providerActuallyUsed,
            timestamp: entry.completedAt || entry.startedAt,
            targetWorkflowId: entry.workflowId,
            historyId: entry.id,
            recipeId: entry.recipeId,
            score,
          });
        }
      }
    }

    // Sort by score descending, then by timestamp/title
    return results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.timestamp && b.timestamp) return b.timestamp.localeCompare(a.timestamp);
      return a.title.localeCompare(b.title);
    });
  }

  private static calculateScore(
    tokens: string[],
    searchableText: string,
    titleLower: string,
    idLower: string
  ): number {
    if (tokens.length === 0) return 1;

    let score = 0;
    for (const token of tokens) {
      if (idLower.includes(token)) {
        score += 15;
      }
      if (titleLower.includes(token)) {
        score += 10;
      } else if (searchableText.includes(token)) {
        score += 3;
      } else {
        // Token not matched
        return 0; // Strict conjunction: all tokens must match
      }
    }
    return score;
  }
}
