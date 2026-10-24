/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Role, WorkflowId } from './workflow.ts';
import { OperatingMode } from './provider.ts';

export const CURRENT_RECIPE_SCHEMA_VERSION = 1;

export interface RecipeInputs {
  inputText?: string;
  sourceName?: string;
  aux1?: string;
  aux2?: string;
  [key: string]: string | undefined;
}

export interface Recipe {
  id: string;
  schemaVersion: number;
  name: string;
  description: string;
  workflowId: WorkflowId;
  targetRole: Role;
  inputs: RecipeInputs;
  providerPreference?: OperatingMode;
  modelPreference?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface RecipeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
