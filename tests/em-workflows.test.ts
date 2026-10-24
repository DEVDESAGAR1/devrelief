/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MultiSourceAggregator } from '../src/workflows/em/multi-source-delivery/aggregator.ts';
import { MultiSourceDeliveryWorkflow } from '../src/workflows/em/multi-source-delivery/workflow.ts';

describe('WF-EM-01: Multi-Source Delivery Summary & Blocker Matrix Tests', () => {
  test('validates and rejects empty delivery evidence input', () => {
    const errs = MultiSourceAggregator.validate({ combinedEvidenceText: '' });
    assert.ok(errs.length > 0);
  });

  test('synthesizes multi-source delivery briefing with blockers and CI status', () => {
    const input = {
      combinedEvidenceText: `feat(auth): implement OIDC provider session sync
fix(billing): correct prorated invoice calculation
[x] Merged PR #104: Payment gateway webhook resilience
BUILD FAILURE: 24 tests passed, 2 failures
Blocker: Staging database credentials not provisioned by DevOps team. Owner: Dave DevOps.
Question: Will the cloud database be ready before code freeze?`,
      projectLabel: 'Fintech Core Migration',
      reportingPeriod: 'Sprint 42 (Oct 10 - Oct 24)',
    };

    const payload = MultiSourceAggregator.aggregate(input);
    assert.equal(payload.projectLabel, 'Fintech Core Migration');
    assert.equal(payload.reportingPeriod, 'Sprint 42 (Oct 10 - Oct 24)');

    // Verify commit count
    assert.equal(payload.confirmedEvidence.commitsCount, 2);

    // Verify completed work
    assert.equal(payload.completedWork.length, 1);
    assert.match(payload.completedWork[0], /Payment gateway webhook/);

    // Verify CI status & test counts
    assert.equal(payload.confirmedEvidence.ciStatus, 'FAILED');
    assert.equal(payload.confirmedEvidence.testsPassedCount, 24);
    assert.equal(payload.confirmedEvidence.testsFailedCount, 2);

    // Verify blocker matrix
    assert.equal(payload.blockerMatrix.length, 1);
    const blocker = payload.blockerMatrix[0];
    assert.equal(blocker.id, 'BLK-01');
    assert.equal(blocker.owner, 'Dave DevOps');
    assert.equal(blocker.status, 'ACTIVE');

    // Verify data gaps disclosure (never assumes deployment succeeded from build)
    assert.ok(payload.dataGapsAndLimitations.some((g) => g.includes('No deployment logs provided')));

    // Verify stakeholder update draft
    assert.ok(payload.stakeholderUpdateDraft.includes('AMBER'));
  });

  test('handles clean delivery evidence without fabricating failures or metrics', () => {
    const input = {
      combinedEvidenceText: `feat(api): optimize response compression
[x] Completed documentation for API v2
BUILD SUCCESS: 35 tests passed
All systems operational.`,
    };

    const payload = MultiSourceAggregator.aggregate(input);
    assert.equal(payload.confirmedEvidence.ciStatus, 'PASSED');
    assert.equal(payload.blockerMatrix.length, 0);
    assert.ok(payload.stakeholderUpdateDraft.includes('GREEN'));
  });

  test('executes end-to-end through MultiSourceDeliveryWorkflow', async () => {
    const workflow = new MultiSourceDeliveryWorkflow();
    const result = await workflow.execute({
      combinedEvidenceText: `feat(search): index customer invoices by date
[x] Shipped mobile responsive header
Blocker: Awaiting third-party sandbox API key. Owner: Partner Team.`,
    });

    assert.equal(result.workflowId, 'WF-EM-01');
    assert.equal(result.isDeterministic, true);
    assert.equal(result.epistemicRating, 'confirmed_fact');
    assert.ok(result.markdown.includes('Delivery Summary & Blocker Matrix'));
  });
});
