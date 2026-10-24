/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SpecTestSynthesizer } from '../src/workflows/qa/spec-test-scenarios/synthesizer.ts';
import { SpecTestScenariosWorkflow } from '../src/workflows/qa/spec-test-scenarios/workflow.ts';
import { BugReproFormatter } from '../src/workflows/qa/screenshot-to-repro/formatter.ts';
import { ScreenshotToReproWorkflow } from '../src/workflows/qa/screenshot-to-repro/workflow.ts';

describe('WF-QA-01: Spec to Test Scenario Matrix Tests', () => {
  test('validates and rejects empty specification input', () => {
    const errs = SpecTestSynthesizer.validate({ specText: '' });
    assert.ok(errs.length > 0);
  });

  test('synthesizes positive, negative, and boundary test scenarios', () => {
    const input = {
      specText: `Users must enter a valid email address and password of at least 8 characters.
Admin users can delete inactive customer records up to 100 records per batch.
The system displays a confirmation modal before deletion.`,
    };

    const payload = SpecTestSynthesizer.synthesize(input);
    assert.ok(payload.testCases.length >= 3);
    assert.ok(payload.positiveCount >= 2);
    assert.ok(payload.negativeCount >= 1);
    assert.ok(payload.boundaryCount >= 1);

    // Verify positive case traces to source requirement
    const pos = payload.testCases.find((tc) => tc.type === 'positive');
    assert.ok(pos);
    assert.ok(pos.requirementRef.startsWith('REQ-'));
    assert.equal(pos.sourceReferences.length > 0, true);

    // Verify boundary case exists for 8 characters or 100 records
    const boundary = payload.testCases.find((tc) => tc.type === 'boundary');
    assert.ok(boundary);
  });

  test('flags untestable subjective requirements', () => {
    const input = {
      specText: `The application dashboard must be fast and look modern and seamless.`,
    };

    const payload = SpecTestSynthesizer.synthesize(input);
    assert.ok(payload.untestableRequirements.length > 0);
    assert.match(payload.untestableRequirements[0], /Lacks objective quantitative threshold/);
  });

  test('executes end-to-end through SpecTestScenariosWorkflow', async () => {
    const workflow = new SpecTestScenariosWorkflow();
    const result = await workflow.execute({
      specText: `Authenticated users must provide MFA token when transferring funds over $1000.`,
    });

    assert.equal(result.workflowId, 'WF-QA-01');
    assert.equal(result.isDeterministic, true);
    assert.ok(result.payload.testCases.length > 0);
    assert.ok(result.markdown.includes('Test Scenario Matrix'));
  });
});

describe('WF-QA-02: Screenshot & Trace to Bug Repro Tests', () => {
  test('validates and rejects empty error trace input', () => {
    const errs = BugReproFormatter.validate({ errorLogOrTrace: '' });
    assert.ok(errs.length > 0);
  });

  test('formats bug ticket and redacts sensitive tokens pre-flight', () => {
    const input = {
      errorLogOrTrace: `TypeError: Cannot read properties of undefined (reading 'sessionToken')
    at Authenticator.validateSession (/app/src/auth/session.ts:42:15)
    at handleRequest (/app/src/server.ts:108:9)
    Bearer Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-zghsecret
    AWS_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE`,
      environmentNotes: 'Node.js v22 on Ubuntu Linux 24.04',
      imageAttachmentName: 'error_dialog.png',
      imageDimensions: '1920x1080',
    };

    const payload = BugReproFormatter.format(input);
    assert.equal(payload.ticket.errorType, 'TypeError');
    assert.match(payload.ticket.errorMessage, /Cannot read properties/);

    // Verify secrets were redacted
    assert.ok(payload.ticket.secretsRedactedCount >= 2);
    assert.equal(payload.ticket.observedBehavior.includes('AKIAIOSFODNN7EXAMPLE'), false);
    assert.equal(payload.markdown.includes('AKIAIOSFODNN7EXAMPLE'), false);
    assert.equal(payload.ticket.secretsRedactedCount, 2);

    // Verify image limitations note is present
    assert.ok(payload.ticket.imageMetadataNote);
    assert.match(payload.ticket.imageMetadataNote, /static metadata/);

    // Verify missing information is flagged
    assert.ok(payload.ticket.missingInformation.length > 0);
  });

  test('executes end-to-end through ScreenshotToReproWorkflow', async () => {
    const workflow = new ScreenshotToReproWorkflow();
    const result = await workflow.execute({
      errorLogOrTrace: `FATAL: Database connection pool exhausted after 30000ms timeout
    at Pool.acquire (/app/node_modules/pg-pool/index.js:312:11)`,
    });

    assert.equal(result.workflowId, 'WF-QA-02');
    assert.equal(result.isDeterministic, true);
    assert.equal(result.payload.ticket.severity, 'Critical');
    assert.ok(result.markdown.includes('Sanitized Stack Trace Excerpt'));
  });
});
