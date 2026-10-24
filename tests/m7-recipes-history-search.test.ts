/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RecipeStore } from '../src/storage/recipe-store.ts';
import { HistoryStore } from '../src/storage/history-store.ts';
import { LocalSearchIndex } from '../src/storage/search-index.ts';
import { CURRENT_RECIPE_SCHEMA_VERSION } from '../src/types/recipe.ts';
import { CURRENT_HISTORY_SCHEMA_VERSION } from '../src/types/history.ts';

describe('M7: Workflow Recipes, Execution History & Local Search Tests', () => {
  beforeEach(() => {
    // Reset stores
    RecipeStore.getInstance().resetToDefaults();
    HistoryStore.getInstance().clearAll();
  });

  // 1. Recipe model creation and schema validation
  it('1. RecipeStore creates, validates, and stores a typed workflow recipe', () => {
    const store = RecipeStore.getInstance();
    const result = store.save({
      name: 'Custom Triage Recipe',
      description: 'Presets for triaging Maven CI build failures.',
      workflowId: 'WF-DEV-03',
      targetRole: 'developer',
      providerPreference: 'deterministic',
      inputs: {
        sourceName: 'ci_error.log',
        inputText: '[ERROR] Failed to execute goal on project auth-service: compilation failure',
      },
      tags: ['ci', 'maven', 'build'],
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.recipe);
    assert.strictEqual(result.recipe?.name, 'Custom Triage Recipe');
    assert.strictEqual(result.recipe?.workflowId, 'WF-DEV-03');
    assert.strictEqual(result.recipe?.version, 1);
    assert.strictEqual(result.recipe?.schemaVersion, CURRENT_RECIPE_SCHEMA_VERSION);
    assert.deepStrictEqual(result.recipe?.tags, ['ci', 'maven', 'build']);

    // Retrieve by ID
    const retrieved = store.getById(result.recipe!.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.name, 'Custom Triage Recipe');
  });

  // 2. Recipe input contract validation against registered workflows
  it('2. RecipeStore rejects recipes referencing unregistered workflow IDs', () => {
    const store = RecipeStore.getInstance();
    const result = store.save({
      name: 'Invalid Workflow Recipe',
      description: 'Points to a non-existent workflow.',
      workflowId: 'WF-FAKE-99' as any,
      targetRole: 'developer',
      inputs: { inputText: 'sample' },
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.errors && result.errors.length > 0);
    assert.ok(result.errors![0].includes('not registered in the catalogue'));
  });

  // 3. Secret scanning on recipe inputs rejects credentials
  it('3. RecipeStore blocks saving inputs containing live credentials or API tokens', () => {
    const store = RecipeStore.getInstance();
    const result = store.save({
      name: 'Leaky Recipe with Bearer Token',
      description: 'Contains a secret header.',
      workflowId: 'WF-DEV-01',
      targetRole: 'developer',
      inputs: {
        sourceName: 'history.log',
        inputText: 'Authorization: Bearer ya29.a0AfH6SMBsecretToken123456789\nCommit details here',
      },
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.errors && result.errors.length > 0);
    assert.ok(result.errors!.some((e) => e.includes('contains sensitive secrets')));
  });

  // 4. Prototype pollution guards in recipe validation and import
  it('4. RecipeStore prevents prototype pollution in imports and validation', () => {
    const store = RecipeStore.getInstance();

    // Prototype attack payload via JSON
    const maliciousJson = `{"__proto__": {"admin": true}, "recipes": [{"name": "Injected", "workflowId": "WF-DEV-01"}]}`;

    const importRes = store.importRecipes(maliciousJson);
    assert.strictEqual(importRes.imported, 0);
    assert.ok(importRes.errors.length > 0);
    assert.ok(importRes.errors[0].includes('Security Exception') || importRes.errors[0].includes('__proto__'));

    // Assert prototype was not polluted
    assert.strictEqual((Object.prototype as any).admin, undefined);
  });

  // 5. Recipe duplicate and version increment
  it('5. RecipeStore duplicates recipes and increments version on updates', () => {
    const store = RecipeStore.getInstance();
    const all = store.getAll();
    assert.ok(all.length > 0);

    const original = all[0];
    const duplicated = store.duplicate(original.id);
    assert.ok(duplicated);
    assert.strictEqual(duplicated?.name, `${original.name} (Copy)`);
    assert.notStrictEqual(duplicated?.id, original.id);

    // Update the duplicated recipe
    const updateRes = store.save(
      {
        name: 'Renamed Copy',
        description: 'Updated description',
        workflowId: duplicated!.workflowId,
        targetRole: duplicated!.targetRole,
        inputs: duplicated!.inputs,
      },
      duplicated!.id
    );

    assert.strictEqual(updateRes.success, true);
    assert.strictEqual(updateRes.recipe?.version, 2);
  });

  // 6. Safe recipe export and import
  it('6. RecipeStore exports and safely re-imports recipes', () => {
    const store = RecipeStore.getInstance();
    const initialCount = store.getAll().length;

    const exported = store.exportRecipes();
    assert.ok(exported.includes('devrelief-recipes-export'));

    // Import the exported file
    const importRes = store.importRecipes(exported);
    assert.strictEqual(importRes.failed, 0);
    assert.strictEqual(importRes.imported, initialCount);
    assert.strictEqual(store.getAll().length, initialCount * 2);
  });

  // 7. Execution history records completed runs
  it('7. HistoryStore records execution entries with full provenance and schema', () => {
    const historyStore = HistoryStore.getInstance();
    const entry = historyStore.recordExecution({
      workflowId: 'WF-DEV-01',
      workflowName: 'Git Activity Daily Digest',
      targetRole: 'developer',
      startedAt: '2026-10-24T10:00:00.000Z',
      completedAt: '2026-10-24T10:00:00.120Z',
      durationMs: 120,
      status: 'succeeded',
      providerModeRequested: 'deterministic',
      providerActuallyUsed: 'Deterministic Core Engine',
      summary: 'Processed 4 commits. Synthesized 2 feature groups.',
      evidenceSources: ['git_history.log'],
      epistemicRating: 'confirmed_fact',
      disclaimers: ['Derived from commit headers.'],
      warnings: [],
      resultMarkdownPreview: '# Daily Digest\n## Features...',
    });

    assert.ok(entry);
    assert.strictEqual(entry?.schemaVersion, CURRENT_HISTORY_SCHEMA_VERSION);
    assert.strictEqual(entry?.workflowId, 'WF-DEV-01');
    assert.strictEqual(entry?.durationMs, 120);
    assert.strictEqual(entry?.providerActuallyUsed, 'Deterministic Core Engine');

    const all = historyStore.getAll();
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0].id, entry?.id);
  });

  // 8. Distinction between requested provider mode and actual provider executed
  it('8. HistoryStore accurately records distinction between requested mode and actual provider used', () => {
    const historyStore = HistoryStore.getInstance();

    // Mode requested: local_ai, but actual execution fallback or completion
    const entry = historyStore.recordExecution({
      workflowId: 'WF-PO-01',
      workflowName: 'Rough Notes to Stories & Gherkin AC',
      targetRole: 'product_owner',
      startedAt: '2026-10-24T10:00:00.000Z',
      completedAt: '2026-10-24T10:00:01.500Z',
      durationMs: 1500,
      status: 'succeeded',
      providerModeRequested: 'local_ai',
      providerActuallyUsed: 'Ollama (gemma2:2b)',
      modelUsed: 'gemma2:2b',
      summary: 'Generated 3 user stories with Gherkin acceptance criteria.',
      evidenceSources: ['discovery_notes.md'],
      epistemicRating: 'extrapolated_hypothesis',
      disclaimers: ['Unverified proposal synthesized by external AI model.'],
      warnings: [],
    });

    assert.ok(entry);
    assert.strictEqual(entry?.providerModeRequested, 'local_ai');
    assert.strictEqual(entry?.providerActuallyUsed, 'Ollama (gemma2:2b)');
    assert.strictEqual(entry?.modelUsed, 'gemma2:2b');
  });

  // 9. Pre-flight secret redaction in history records
  it('9. HistoryStore redacts sensitive tokens before saving execution history', () => {
    const historyStore = HistoryStore.getInstance();
    const entry = historyStore.recordExecution({
      workflowId: 'WF-QA-02',
      workflowName: 'Screenshot & Trace to Repro',
      targetRole: 'qa_engineer',
      startedAt: '2026-10-24T10:00:00.000Z',
      completedAt: '2026-10-24T10:00:00.200Z',
      durationMs: 200,
      status: 'failed',
      providerModeRequested: 'deterministic',
      providerActuallyUsed: 'Deterministic Core Engine',
      summary: 'Failure trace with Authorization: Bearer secret_live_token_999988887777',
      evidenceSources: ['console_crash.log'],
      disclaimers: [],
      warnings: [],
      errorDetails: 'API Key AKIAIOSFODNN7EXAMPLE rejected',
    });

    assert.ok(entry);
    assert.ok(!entry?.summary.includes('secret_live_token_999988887777'));
    assert.ok(entry?.summary.includes('[REDACTED_BEARER_TOKEN]'));
    assert.ok(!entry?.errorDetails?.includes('AKIAIOSFODNN7EXAMPLE'));
    assert.ok(entry?.errorDetails?.includes('[REDACTED_AWS_ACCESS_KEY_ID]'));
  });

  // 10. Privacy toggle disables history logging
  it('10. HistoryStore respects privacy logging disable toggle', () => {
    const historyStore = HistoryStore.getInstance();
    historyStore.updateSettings({ enabled: false });

    const entry = historyStore.recordExecution({
      workflowId: 'WF-DEV-01',
      workflowName: 'Git Activity Daily Digest',
      targetRole: 'developer',
      startedAt: '2026-10-24T10:00:00.000Z',
      completedAt: '2026-10-24T10:00:00.100Z',
      durationMs: 100,
      status: 'succeeded',
      providerModeRequested: 'deterministic',
      providerActuallyUsed: 'Deterministic Core Engine',
      summary: 'Should not be stored.',
      evidenceSources: ['test.log'],
      disclaimers: [],
      warnings: [],
    });

    assert.strictEqual(entry, null);
    assert.strictEqual(historyStore.getAll().length, 0);

    // Re-enable
    historyStore.updateSettings({ enabled: true });
    const entry2 = historyStore.recordExecution({
      workflowId: 'WF-DEV-01',
      workflowName: 'Git Activity Daily Digest',
      targetRole: 'developer',
      startedAt: '2026-10-24T10:00:00.000Z',
      completedAt: '2026-10-24T10:00:00.100Z',
      durationMs: 100,
      status: 'succeeded',
      providerModeRequested: 'deterministic',
      providerActuallyUsed: 'Deterministic Core Engine',
      summary: 'Should be stored now.',
      evidenceSources: ['test.log'],
      disclaimers: [],
      warnings: [],
    });

    assert.ok(entry2);
    assert.strictEqual(historyStore.getAll().length, 1);
  });

  // 11. Retention cap prunes oldest history entries
  it('11. HistoryStore automatically prunes entries beyond the max retention cap', () => {
    const historyStore = HistoryStore.getInstance();
    historyStore.updateSettings({ maxEntries: 5 });

    for (let i = 1; i <= 8; i++) {
      historyStore.recordExecution({
        workflowId: 'WF-DEV-01',
        workflowName: `Run #${i}`,
        targetRole: 'developer',
        startedAt: `2026-10-24T10:00:0${i}.000Z`,
        completedAt: `2026-10-24T10:00:0${i}.100Z`,
        durationMs: 100,
        status: 'succeeded',
        providerModeRequested: 'deterministic',
        providerActuallyUsed: 'Deterministic Core Engine',
        summary: `Summary of run ${i}`,
        evidenceSources: [`source_${i}.log`],
        disclaimers: [],
        warnings: [],
      });
    }

    const all = historyStore.getAll();
    assert.strictEqual(all.length, 5);
    // Newest is at index 0 (Run #8)
    assert.strictEqual(all[0].workflowName, 'Run #8');
    // Oldest retained is Run #4
    assert.strictEqual(all[4].workflowName, 'Run #4');
  });

  // 12. Local search across workflows
  it('12. LocalSearchIndex correctly queries workflows by code, title, and role', () => {
    const res1 = LocalSearchIndex.search('WF-DEV-01');
    assert.ok(res1.length > 0);
    assert.strictEqual(res1[0].targetWorkflowId, 'WF-DEV-01');
    assert.strictEqual(res1[0].type, 'workflow');

    // Filter by role
    const res2 = LocalSearchIndex.search('triage', { role: 'developer' });
    assert.ok(res2.some((r) => r.targetWorkflowId === 'WF-DEV-03'));
  });

  // 13. Local search across saved recipes
  it('13. LocalSearchIndex finds recipes by name and tags', () => {
    const res = LocalSearchIndex.search('breaking change', { entityType: 'recipe' });
    assert.ok(res.length > 0);
    assert.strictEqual(res[0].type, 'recipe');
    assert.ok(res[0].title.includes('Breaking Change') || res[0].description.includes('breaking changes'));
  });

  // 14. Local search across execution history
  it('14. LocalSearchIndex queries history entries by status, summary, and sources', () => {
    const historyStore = HistoryStore.getInstance();
    historyStore.recordExecution({
      workflowId: 'WF-QA-02',
      workflowName: 'Error Screenshot & Trace to Repro Ticket',
      targetRole: 'qa_engineer',
      startedAt: '2026-10-24T10:00:00.000Z',
      completedAt: '2026-10-24T10:00:00.150Z',
      durationMs: 150,
      status: 'failed',
      providerModeRequested: 'deterministic',
      providerActuallyUsed: 'Deterministic Core Engine',
      summary: 'NullPointerException on UserProfileModal line 42',
      evidenceSources: ['console_crash.log'],
      disclaimers: [],
      warnings: [],
    });

    const res = LocalSearchIndex.search('NullPointerException', { entityType: 'history' });
    assert.ok(res.length > 0);
    assert.strictEqual(res[0].type, 'history');
    assert.strictEqual(res[0].status, 'failed');
    assert.strictEqual(res[0].targetWorkflowId, 'WF-QA-02');
  });

  // 15. Conjunction search matching (all tokens must match)
  it('15. LocalSearchIndex enforces strict conjunction token matching', () => {
    // Both tokens exist in WF-DEV-01
    const resMatch = LocalSearchIndex.search('digest git', { entityType: 'workflow' });
    assert.ok(resMatch.some((r) => r.targetWorkflowId === 'WF-DEV-01'));

    // Second token does not exist anywhere
    const resMiss = LocalSearchIndex.search('digest xyznonexistentterm99', { entityType: 'workflow' });
    assert.strictEqual(resMiss.length, 0);
  });
});
