/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ChangeSummaryWorkflow } from '../src/workflows/dev/change-summary/workflow.ts';
import { ChangeSummaryParser } from '../src/workflows/dev/change-summary/parser.ts';
import { WorkflowEngine } from '../src/engine/kernel.ts';

const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index 1234567..89abcdef 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,3 +10,4 @@
-export function legacyPasswordAuth() { return false; }
+export function biometricAuth() { return true; }
+export function sessionTokenVerify() { return true; }
diff --git a/docs/README.md b/docs/README.md
index abcdef1..2345678 100644
--- a/docs/README.md
+++ b/docs/README.md
@@ -1,2 +1,3 @@
+# System Documentation
+Updated architecture guide with new endpoints.
diff --git a/package.json b/package.json
index 5678901..6789012 100644
--- a/package.json
+++ b/package.json
@@ -5,2 +5,3 @@
+    "lucide-react": "^0.546.0",
`;

describe('WF-DEV-02: ChangeSummaryParser Unit Tests', () => {
  it('validates and rejects empty diff input', () => {
    const errors = ChangeSummaryParser.validate({ rawDiffOrLog: '' });
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].message, /empty/i);
  });

  it('rejects input without diff headers or commit hashes', () => {
    const errors = ChangeSummaryParser.validate({ rawDiffOrLog: 'Just some general bullet points.' });
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].message, /No valid Git|does not contain/i);
  });

  it('parses unified diff, categorizes features, docs, dependencies, and breaking changes', () => {
    const payload = ChangeSummaryParser.parse({
      rawDiffOrLog: SAMPLE_DIFF,
      sourceName: 'feature_branch.diff',
      versionTag: 'v1.2.0',
    });

    assert.strictEqual(payload.versionTag, 'v1.2.0');
    assert.strictEqual(payload.totalFilesChanged, 3);
    assert.ok(payload.breakingChangesCount >= 1, 'Should detect breaking change from deleted export');

    const breakingGroup = payload.categorizedItems.find((g) => g.category === 'breaking');
    assert.ok(breakingGroup, 'Breaking changes group should exist');
    assert.ok(breakingGroup.items[0].description.includes('legacyPasswordAuth'));

    const docsGroup = payload.categorizedItems.find((g) => g.category === 'docs');
    assert.ok(docsGroup, 'Docs group should exist');
    assert.strictEqual(docsGroup.items[0].files[0], 'docs/README.md');

    const depGroup = payload.categorizedItems.find((g) => g.category === 'dependency');
    assert.ok(depGroup, 'Dependency group should exist');
    assert.strictEqual(depGroup.items[0].files[0], 'package.json');

    assert.ok(payload.draftReleaseNotes.includes('# Release Notes — v1.2.0'));
    assert.ok(payload.draftReleaseNotes.includes('Review Required'));
    assert.ok(payload.uncertainties.length > 0);
  });
});

describe('WF-DEV-02: ChangeSummaryWorkflow Integration Tests', () => {
  it('executes via WorkflowEngine and returns structured result with source references', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(new ChangeSummaryWorkflow());

    const outcome = await engine.executeWorkflow('WF-DEV-02', {
      rawDiffOrLog: SAMPLE_DIFF,
      sourceName: 'pr_42.diff',
      versionTag: 'v2.0.0-rc1',
    });

    assert.strictEqual(outcome.success, true);
    assert.ok(outcome.result);
    assert.strictEqual(outcome.result.workflowId, 'WF-DEV-02');
    assert.strictEqual(outcome.result.isDeterministic, true);
    assert.strictEqual(outcome.result.sourceReferences.length, 3);
    assert.ok(outcome.result.sourceReferences[0].source === 'pr_42.diff');
  });
});
