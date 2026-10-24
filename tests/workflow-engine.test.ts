/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkflowEngine } from '../src/engine/kernel.ts';
import { GitDailyDigestWorkflow } from '../src/workflows/dev/git-daily-digest/workflow.ts';
import { getWorkflowsForRole, WORKFLOW_CATALOGUE } from '../src/engine/registry.ts';
import { Role, WorkflowDefinition, WorkflowResult } from '../src/types/workflow.ts';

const SAMPLE_LOG = `a1b2c3d4e5f67890123456789012345678901234
Alice Engineer
2026-10-24T10:15:30+00:00
feat(auth): implement session authentication
`;

describe('WorkflowEngine Kernel & State Machine Tests', () => {
  it('manages transitions: idle -> validating -> running -> succeeded', async () => {
    const engine = new WorkflowEngine();
    const recordedStates: string[] = [];

    engine.onStateChange((state) => recordedStates.push(state));
    engine.registerWorkflow(new GitDailyDigestWorkflow());

    assert.strictEqual(engine.getState(), 'idle');

    const outcome = await engine.executeWorkflow('WF-DEV-01', { rawLog: SAMPLE_LOG });

    assert.strictEqual(outcome.success, true);
    assert.strictEqual(engine.getState(), 'succeeded');
    assert.ok(outcome.result);
    assert.strictEqual(outcome.result.workflowId, 'WF-DEV-01');

    // Verify state progression sequence
    assert.deepStrictEqual(recordedStates, ['validating', 'running', 'succeeded']);
  });

  it('handles input validation failure: idle -> validating -> failed (never stuck in running)', async () => {
    const engine = new WorkflowEngine();
    const recordedStates: string[] = [];

    engine.onStateChange((state) => recordedStates.push(state));
    engine.registerWorkflow(new GitDailyDigestWorkflow());

    const outcome = await engine.executeWorkflow('WF-DEV-01', { rawLog: '' });

    assert.strictEqual(outcome.success, false);
    assert.strictEqual(engine.getState(), 'failed');
    assert.ok(outcome.failure);
    assert.strictEqual(outcome.failure.code, 'INPUT_VALIDATION_FAILED');
    assert.ok(outcome.failure.validationErrors && outcome.failure.validationErrors.length > 0);

    // Verify it transitioned directly from validating to failed
    assert.deepStrictEqual(recordedStates, ['validating', 'failed']);
  });

  it('handles unregistered workflow ID gracefully: idle -> failed', async () => {
    const engine = new WorkflowEngine();
    const outcome = await engine.executeWorkflow('WF-PO-01', { text: 'test' });

    assert.strictEqual(outcome.success, false);
    assert.strictEqual(engine.getState(), 'failed');
    assert.strictEqual(outcome.failure?.code, 'WORKFLOW_NOT_FOUND');
  });

  it('handles execution exception safely: idle -> validating -> running -> failed', async () => {
    const engine = new WorkflowEngine();
    const recordedStates: string[] = [];

    engine.onStateChange((state) => recordedStates.push(state));

    const faultyWorkflow: WorkflowDefinition<unknown, unknown> = {
      metadata: {
        id: 'WF-DEV-01',
        name: 'Faulty Workflow',
        code: 'faulty',
        description: 'Throws error during execution',
        targetRole: 'developer',
        supportedRoles: ['developer'],
        status: 'implemented',
        engineType: 'deterministic',
        requiredInputs: ['test'],
        supportedFormats: ['.txt'],
        disclaimer: 'Faulty test workflow',
      },
      validateInput: () => [],
      execute: async () => {
        throw new Error('Deterministic execution error');
      },
    };

    engine.registerWorkflow(faultyWorkflow);

    const outcome = await engine.executeWorkflow('WF-DEV-01', {});
    assert.strictEqual(outcome.success, false);
    assert.strictEqual(engine.getState(), 'failed');
    assert.strictEqual(outcome.failure?.code, 'EXECUTION_FAILED');
    assert.strictEqual(outcome.failure?.details, 'Deterministic execution error');

    assert.deepStrictEqual(recordedStates, ['validating', 'running', 'failed']);
  });

  it('resets cleanly back to idle state from failed or succeeded', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(new GitDailyDigestWorkflow());

    await engine.executeWorkflow('WF-DEV-01', { rawLog: '' });
    assert.strictEqual(engine.getState(), 'failed');
    assert.notStrictEqual(engine.getLastFailure(), null);

    engine.reset();
    assert.strictEqual(engine.getState(), 'idle');
    assert.strictEqual(engine.getLastFailure(), null);
    assert.strictEqual(engine.getLastResult(), null);
  });

  it('asserts that deterministic execution makes zero external network calls', async () => {
    const engine = new WorkflowEngine();
    engine.registerWorkflow(new GitDailyDigestWorkflow());

    let networkCallCount = 0;
    const originalFetch = globalThis.fetch;

    try {
      globalThis.fetch = (async () => {
        networkCallCount++;
        throw new Error('Network should never be called during deterministic workflow execution!');
      }) as unknown as typeof fetch;

      const outcome = await engine.executeWorkflow('WF-DEV-01', { rawLog: SAMPLE_LOG });
      assert.strictEqual(outcome.success, true);
      assert.strictEqual(networkCallCount, 0, 'No network calls must be executed');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Role Catalogue & Eligibility Tests', () => {
  const ROLES: Role[] = [
    'developer',
    'product_owner',
    'scrum_master',
    'qa_engineer',
    'engineering_manager',
  ];

  it('ensures all 5 roles have available workflows and filtering works consistently', () => {
    for (const role of ROLES) {
      const workflows = getWorkflowsForRole(role);
      assert.ok(workflows.length > 0, `Role ${role} must have at least 1 workflow`);

      for (const wf of workflows) {
        assert.ok(
          wf.supportedRoles.includes(role),
          `Workflow ${wf.id} must declare ${role} in supportedRoles`
        );
      }
    }
  });

  it('verifies WF-DEV-01 is marked implemented and ready for execution', () => {
    const devWorkflows = getWorkflowsForRole('developer');
    const digestWf = devWorkflows.find((w) => w.id === 'WF-DEV-01');
    assert.ok(digestWf, 'WF-DEV-01 must exist in developer catalogue');
    assert.strictEqual(digestWf.status, 'implemented');
    assert.strictEqual(digestWf.engineType, 'deterministic');
  });

  it('verifies catalogue contains total 10 workflows across 5 delivery audiences', () => {
    assert.strictEqual(WORKFLOW_CATALOGUE.length, 10);
  });

  it('verifies all 10 workflows across M1-M5 are marked implemented', () => {
    const implemented = WORKFLOW_CATALOGUE.filter((w) => w.status === 'implemented');
    assert.strictEqual(implemented.length, 10, 'All 10 workflows should be implemented');
  });
});
