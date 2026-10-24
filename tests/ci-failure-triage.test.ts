/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CiFailureTriageWorkflow } from '../src/workflows/dev/ci-failure-triage/workflow.ts';
import { CiLogAnalyzer } from '../src/workflows/dev/ci-failure-triage/analyzer.ts';
import { WorkflowEngine } from '../src/engine/kernel.ts';

const SAMPLE_MAVEN_FAILURE = `[INFO] Scanning for projects...
[INFO] ------------------------------------------------------------------------
[INFO] Building Auth Service 1.0.0
[INFO] ------------------------------------------------------------------------
[ERROR] Non-resolvable parent POM for com.acme:auth-service:0.4.1: Could not find artifact
[ERROR] Non-resolvable parent POM for com.acme:auth-service:0.4.1: Failure to transfer
Token: Bearer ya29.a0AfH6SMBsecretToken123456789
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  1.234 s
[INFO] Finished at: 2026-10-24T10:00:00Z
`;

const SAMPLE_CLEAN_LOG = `[INFO] Scanning for projects...
[INFO] Tests run: 45, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
`;

describe('WF-DEV-03: CiLogAnalyzer Unit Tests', () => {
  it('validates and rejects empty CI log input', () => {
    const errors = CiLogAnalyzer.validate({ rawLogOrTrace: '' });
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].message, /empty/i);
  });

  it('identifies first meaningful error, clusters failures, and redacts secrets', () => {
    const result = CiLogAnalyzer.analyze({
      rawLogOrTrace: SAMPLE_MAVEN_FAILURE,
      sourceName: 'jenkins_build_123.log',
      pipelineStage: 'Maven Verify',
    });

    assert.ok(result.payload.firstMeaningfulError);
    assert.strictEqual(result.payload.firstMeaningfulError.lineNumber, 5);
    assert.match(result.payload.firstMeaningfulError.snippet, /Non-resolvable parent POM/i);

    // Verify error clustering
    assert.ok(result.payload.errorClusters.length >= 1);
    const depCluster = result.payload.errorClusters.find((c) => c.errorType === 'Dependency Resolution Failure');
    assert.ok(depCluster);
    assert.strictEqual(depCluster.count, 2);

    // Verify secret redaction
    assert.strictEqual(result.payload.hasRedactedSecrets, true);
    assert.ok(result.markdown.includes('[REDACTED_BEARER_TOKEN]'));
    assert.ok(!result.markdown.includes('secretToken123456789'));

    // Verify hypotheses
    assert.ok(result.payload.hypotheses.length > 0);
    assert.strictEqual(result.payload.hypotheses[0].probability, 'high');

    // Verify inert commands
    assert.ok(result.payload.suggestedInertCommands.length > 0);
    assert.ok(result.markdown.includes('mvn dependency:tree'));
    assert.ok(result.markdown.includes('Safety Notice'));
  });

  it('reports UNKNOWN root cause when log has no fatal keywords', () => {
    const result = CiLogAnalyzer.analyze({
      rawLogOrTrace: SAMPLE_CLEAN_LOG,
      sourceName: 'clean_build.log',
    });

    assert.strictEqual(result.payload.firstMeaningfulError, undefined);
    assert.ok(result.payload.missingInformation.length > 0);
    assert.ok(result.markdown.includes('Root cause is currently UNKNOWN'));
  });
});

describe('WF-DEV-03: CiFailureTriageWorkflow Integration Tests', () => {
  it('executes via WorkflowEngine and returns structured result', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(new CiFailureTriageWorkflow());

    const outcome = await engine.executeWorkflow('WF-DEV-03', {
      rawLogOrTrace: SAMPLE_MAVEN_FAILURE,
      sourceName: 'ci_run.log',
      pipelineStage: 'Docker Build',
    });

    assert.strictEqual(outcome.success, true);
    assert.ok(outcome.result);
    assert.strictEqual(outcome.result.workflowId, 'WF-DEV-03');
    assert.strictEqual(outcome.result.isDeterministic, true);
    assert.strictEqual(outcome.result.epistemicRating, 'confirmed_fact');
    assert.ok(outcome.result.sourceReferences.length > 0);
  });
});
