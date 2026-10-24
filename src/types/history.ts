/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Role, WorkflowId } from './workflow.ts';
import { OperatingMode } from './provider.ts';

export const CURRENT_HISTORY_SCHEMA_VERSION = 1;

export type ExecutionStatus = 'succeeded' | 'failed' | 'cancelled';

export interface ExecutionHistoryEntry {
  id: string;
  schemaVersion: number;
  workflowId: WorkflowId;
  workflowName: string;
  targetRole: Role;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: ExecutionStatus;
  providerModeRequested: OperatingMode;
  providerActuallyUsed: string;
  modelUsed?: string;
  recipeId?: string;
  recipeName?: string;
  recipeVersion?: number;
  summary: string;
  evidenceSources: string[];
  epistemicRating?: string;
  disclaimers: string[];
  warnings: string[];
  errorDetails?: string;
  resultMarkdownPreview?: string;
}

export interface HistorySettings {
  enabled: boolean;
  maxEntries: number;
}
