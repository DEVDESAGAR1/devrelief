/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Recipe, CURRENT_RECIPE_SCHEMA_VERSION, RecipeValidationResult, RecipeInputs } from '../types/recipe.ts';
import { WORKFLOW_CATALOGUE } from '../engine/registry.ts';
import { SecretScanner } from '../ingestion/secrets.ts';
import { WorkflowId, Role } from '../types/workflow.ts';
import { OperatingMode } from '../types/provider.ts';

const STORAGE_KEY = 'devrelief:recipes:v1';
const MAX_RECIPE_NAME_LENGTH = 120;
const MAX_RECIPE_DESC_LENGTH = 500;
const MAX_INPUT_TEXT_LENGTH = 100000; // 100 KB limit for input templates

export const DEFAULT_RECIPES: Recipe[] = [
  {
    id: 'rcp_dev_daily_digest',
    schemaVersion: CURRENT_RECIPE_SCHEMA_VERSION,
    name: 'Standard Daily Git Digest',
    description: 'Generates a categorized morning delivery briefing from formatted git log history.',
    workflowId: 'WF-DEV-01',
    targetRole: 'developer',
    inputs: {
      sourceName: 'git_history.log',
      inputText: `a1b2c3d4e5f67890123456789012345678901234\nAlice Engineer\n2026-10-24T10:15:30+00:00\nfeat(auth): implement biometric session authentication\n\nb2c3d4e5f6a17890123456789012345678901235\nBob Developer\n2026-10-24T11:20:00+00:00\nfix(api): resolve timeout retry loop on 504 gateway errors`,
    },
    providerPreference: 'deterministic',
    version: 1,
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    tags: ['git', 'standup', 'developer'],
  },
  {
    id: 'rcp_dev_release_notes',
    schemaVersion: CURRENT_RECIPE_SCHEMA_VERSION,
    name: 'Breaking Change Release Drafter',
    description: 'Scans pull request diffs for breaking changes and generates stakeholder release notes.',
    workflowId: 'WF-DEV-02',
    targetRole: 'developer',
    inputs: {
      sourceName: 'pull_request.diff',
      inputText: `diff --git a/src/auth.ts b/src/auth.ts\nindex 1234567..89abcdef 100644\n--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -10,3 +10,4 @@\n-export function legacyPasswordAuth() { return false; }\n+export function biometricAuth() { return true; }`,
    },
    providerPreference: 'deterministic',
    version: 1,
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    tags: ['release', 'notes', 'diff'],
  },
  {
    id: 'rcp_po_discovery_stories',
    schemaVersion: CURRENT_RECIPE_SCHEMA_VERSION,
    name: 'Discovery Bullets to User Stories',
    description: 'Transforms unstructured stakeholder discovery notes into Given-When-Then stories.',
    workflowId: 'WF-PO-01',
    targetRole: 'product_owner',
    inputs: {
      sourceName: 'discovery_notes.md',
      aux1: 'Product Manager',
      aux2: 'Automate customer export flow',
      inputText: `- As a Product Manager, I want to export customer logs directly to CSV so that audits take minutes instead of hours.\n- System must reject uploads over 20MB with clear error messages.`,
    },
    providerPreference: 'deterministic',
    version: 1,
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    tags: ['stories', 'gherkin', 'requirements'],
  },
  {
    id: 'rcp_sm_action_matrix',
    schemaVersion: CURRENT_RECIPE_SCHEMA_VERSION,
    name: 'Sprint Standup Action Item Extractor',
    description: 'Pulls explicit owners and due dates from sprint meeting transcripts.',
    workflowId: 'WF-SM-01',
    targetRole: 'scrum_master',
    inputs: {
      sourceName: 'standup_sync.md',
      aux1: 'Sprint 42 Weekly Delivery Sync',
      inputText: `Decision: Standardize API responses using RFC 7807 problem details specification.\n- Action: Alice to update OpenAPI schema schemas by Friday.\n- Action: Bob to refactor auth middleware error handlers by 2026-10-28.`,
    },
    providerPreference: 'deterministic',
    version: 1,
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    tags: ['retro', 'action-items', 'scrum'],
  },
];

export class RecipeStore {
  private static instance: RecipeStore | null = null;
  private memoryCache: Recipe[] | null = null;

  public static getInstance(): RecipeStore {
    if (!RecipeStore.instance) {
      RecipeStore.instance = new RecipeStore();
    }
    return RecipeStore.instance;
  }

  private constructor() {
    this.ensureInitialized();
  }

  private isStorageAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private ensureInitialized(): void {
    if (!this.isStorageAvailable()) {
      if (!this.memoryCache) {
        this.memoryCache = [...DEFAULT_RECIPES];
      }
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_RECIPES));
        this.memoryCache = [...DEFAULT_RECIPES];
      } else {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.memoryCache = parsed;
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_RECIPES));
          this.memoryCache = [...DEFAULT_RECIPES];
        }
      }
    } catch {
      this.memoryCache = [...DEFAULT_RECIPES];
    }
  }

  private persist(recipes: Recipe[]): void {
    this.memoryCache = recipes;
    if (this.isStorageAvailable()) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
      } catch (err) {
        console.error('Failed to persist recipes to localStorage:', err);
      }
    }
  }

  public getAll(): Recipe[] {
    if (!this.memoryCache) {
      this.ensureInitialized();
    }
    return [...(this.memoryCache || [])];
  }

  public getById(id: string): Recipe | undefined {
    return this.getAll().find((r) => r.id === id);
  }

  /**
   * Validate a recipe against schema and security policies
   */
  public validateRecipe(candidate: unknown): RecipeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!candidate || typeof candidate !== 'object') {
      return { isValid: false, errors: ['Recipe must be a valid non-null object.'], warnings: [] };
    }

    const obj = candidate as Record<string, any>;

    // Prototype pollution prevention checks
    const forbiddenKeys = ['__proto__', 'constructor', 'prototype'];
    const ownNames = Object.getOwnPropertyNames(obj);
    for (const key of forbiddenKeys) {
      if (ownNames.includes(key) || Object.prototype.hasOwnProperty.call(obj, key)) {
        return { isValid: false, errors: [`Security violation: Forbidden prototype property "${key}".`], warnings: [] };
      }
    }

    // Name validation
    if (!obj.name || typeof obj.name !== 'string' || !obj.name.trim()) {
      errors.push('Recipe name is required and cannot be empty.');
    } else if (obj.name.length > MAX_RECIPE_NAME_LENGTH) {
      errors.push(`Recipe name exceeds maximum length of ${MAX_RECIPE_NAME_LENGTH} characters.`);
    }

    // Description validation
    if (obj.description && typeof obj.description !== 'string') {
      errors.push('Recipe description must be a string.');
    } else if (obj.description && obj.description.length > MAX_RECIPE_DESC_LENGTH) {
      errors.push(`Recipe description exceeds maximum length of ${MAX_RECIPE_DESC_LENGTH} characters.`);
    }

    // Workflow validation
    if (!obj.workflowId || typeof obj.workflowId !== 'string') {
      errors.push('Workflow ID is required.');
    } else {
      const exists = WORKFLOW_CATALOGUE.some((w) => w.id === obj.workflowId);
      if (!exists) {
        errors.push(`Referenced workflow "${obj.workflowId}" is not registered in the catalogue.`);
      }
    }

    // Provider preference validation
    if (obj.providerPreference) {
      const allowedModes: OperatingMode[] = ['deterministic', 'local_ai', 'cloud_ai'];
      if (!allowedModes.includes(obj.providerPreference)) {
        errors.push(`Invalid provider preference "${obj.providerPreference}". Must be deterministic, local_ai, or cloud_ai.`);
      }
    }

    // Inputs validation & Secret Scanning
    if (obj.inputs) {
      if (typeof obj.inputs !== 'object' || Array.isArray(obj.inputs)) {
        errors.push('Recipe inputs must be a key-value object.');
      } else {
        for (const [key, val] of Object.entries(obj.inputs)) {
          if (forbiddenKeys.includes(key)) {
            errors.push(`Security violation: Forbidden key "${key}" in inputs.`);
            continue;
          }
          if (typeof val === 'string') {
            if (val.length > MAX_INPUT_TEXT_LENGTH) {
              errors.push(`Input field "${key}" exceeds ${MAX_INPUT_TEXT_LENGTH} characters limit.`);
            }
            // Check for secrets
            const scan = SecretScanner.scanAndRedact(val);
            if (scan.hasRedactions) {
              errors.push(`Input field "${key}" contains sensitive secrets (${scan.matches.map((m) => m.ruleName).join(', ')}). Secrets must never be stored in recipes.`);
            }
          } else if (val !== undefined && val !== null) {
            errors.push(`Input field "${key}" must be a string value.`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Save a new recipe or update an existing one
   */
  public save(
    data: {
      name: string;
      description: string;
      workflowId: WorkflowId;
      targetRole: Role;
      inputs: RecipeInputs;
      providerPreference?: OperatingMode;
      modelPreference?: string;
      tags?: string[];
    },
    existingId?: string
  ): { success: boolean; recipe?: Recipe; errors?: string[] } {
    const validation = this.validateRecipe({ ...data, id: existingId || 'temp' });
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const currentRecipes = this.getAll();
    const now = new Date().toISOString();

    if (existingId) {
      const index = currentRecipes.findIndex((r) => r.id === existingId);
      if (index === -1) {
        return { success: false, errors: [`Recipe with ID "${existingId}" not found.`] };
      }
      const existing = currentRecipes[index];
      const updated: Recipe = {
        ...existing,
        name: data.name.trim(),
        description: (data.description || '').trim(),
        workflowId: data.workflowId,
        targetRole: data.targetRole,
        inputs: { ...data.inputs },
        providerPreference: data.providerPreference || 'deterministic',
        modelPreference: data.modelPreference,
        tags: Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === 'string' && t.trim()) : existing.tags,
        version: existing.version + 1,
        updatedAt: now,
      };

      currentRecipes[index] = updated;
      this.persist(currentRecipes);
      return { success: true, recipe: updated };
    } else {
      const newId = `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newRecipe: Recipe = {
        id: newId,
        schemaVersion: CURRENT_RECIPE_SCHEMA_VERSION,
        name: data.name.trim(),
        description: (data.description || '').trim(),
        workflowId: data.workflowId,
        targetRole: data.targetRole,
        inputs: { ...data.inputs },
        providerPreference: data.providerPreference || 'deterministic',
        modelPreference: data.modelPreference,
        tags: Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === 'string' && t.trim()) : [],
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      currentRecipes.unshift(newRecipe);
      this.persist(currentRecipes);
      return { success: true, recipe: newRecipe };
    }
  }

  /**
   * Duplicate an existing recipe
   */
  public duplicate(id: string): Recipe | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const newId = `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const copy: Recipe = {
      ...existing,
      id: newId,
      name: `${existing.name} (Copy)`,
      version: 1,
      createdAt: now,
      updatedAt: now,
      inputs: { ...existing.inputs },
      tags: [...existing.tags],
    };

    const currentRecipes = this.getAll();
    currentRecipes.unshift(copy);
    this.persist(currentRecipes);
    return copy;
  }

  /**
   * Delete a recipe
   */
  public delete(id: string): boolean {
    const current = this.getAll();
    const filtered = current.filter((r) => r.id !== id);
    if (filtered.length !== current.length) {
      this.persist(filtered);
      return true;
    }
    return false;
  }

  /**
   * Reset store to default bundled recipes
   */
  public resetToDefaults(): void {
    this.persist([...DEFAULT_RECIPES]);
  }

  /**
   * Export all recipes as sanitized JSON string
   */
  public exportRecipes(): string {
    const all = this.getAll();
    return JSON.stringify(
      {
        format: 'devrelief-recipes-export',
        schemaVersion: CURRENT_RECIPE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        count: all.length,
        recipes: all,
      },
      null,
      2
    );
  }

  /**
   * Import recipes safely with strict verification and prototype pollution guards
   */
  public importRecipes(rawJson: string): {
    imported: number;
    failed: number;
    errors: string[];
    recipes: Recipe[];
  } {
    const errors: string[] = [];
    if (!rawJson || typeof rawJson !== 'string' || !rawJson.trim()) {
      return { imported: 0, failed: 0, errors: ['Import file is empty.'], recipes: [] };
    }

    if (rawJson.length > 5 * 1024 * 1024) {
      return { imported: 0, failed: 0, errors: ['Import file exceeds 5MB maximum allowed size.'], recipes: [] };
    }

    let parsed: any;
    try {
      // Custom reviver rejecting dangerous keys
      parsed = JSON.parse(rawJson, (key, value) => {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          throw new Error(`Security Exception: Unsafe property key "${key}" detected in recipe JSON.`);
        }
        return value;
      });
    } catch (err: unknown) {
      return {
        imported: 0,
        failed: 0,
        errors: [`Invalid JSON formatting: ${err instanceof Error ? err.message : String(err)}`],
        recipes: [],
      };
    }

    let itemsToImport: any[] = [];
    if (Array.isArray(parsed)) {
      itemsToImport = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.recipes)) {
      itemsToImport = parsed.recipes;
    } else if (parsed && typeof parsed === 'object' && parsed.workflowId && parsed.name) {
      itemsToImport = [parsed];
    } else {
      return {
        imported: 0,
        failed: 0,
        errors: ['Import JSON must contain an array of recipes or a valid export envelope.'],
        recipes: [],
      };
    }

    const currentRecipes = this.getAll();
    const importedList: Recipe[] = [];
    let failedCount = 0;

    for (let i = 0; i < itemsToImport.length; i++) {
      const item = itemsToImport[i];
      const validation = this.validateRecipe(item);
      if (!validation.isValid) {
        errors.push(`Item #${i + 1} ("${item?.name || 'unnamed'}") rejected: ${validation.errors.join('; ')}`);
        failedCount++;
        continue;
      }

      // Safe clone
      const newId = `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const safeRecipe: Recipe = {
        id: newId,
        schemaVersion: CURRENT_RECIPE_SCHEMA_VERSION,
        name: String(item.name).trim(),
        description: String(item.description || '').trim(),
        workflowId: item.workflowId,
        targetRole: item.targetRole || 'developer',
        inputs: typeof item.inputs === 'object' && item.inputs ? { ...item.inputs } : {},
        providerPreference: item.providerPreference || 'deterministic',
        modelPreference: typeof item.modelPreference === 'string' ? item.modelPreference : undefined,
        tags: Array.isArray(item.tags) ? item.tags.map(String).filter((t: string) => t.trim()) : [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      currentRecipes.unshift(safeRecipe);
      importedList.push(safeRecipe);
    }

    if (importedList.length > 0) {
      this.persist(currentRecipes);
    }

    return {
      imported: importedList.length,
      failed: failedCount,
      errors,
      recipes: importedList,
    };
  }
}
