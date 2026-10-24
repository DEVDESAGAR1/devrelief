/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { StoriesGherkinParser } from '../src/workflows/po/stories-gherkin-ac/parser.ts';
import { StoriesGherkinWorkflow } from '../src/workflows/po/stories-gherkin-ac/workflow.ts';
import { AmbiguityScanner } from '../src/workflows/po/ambiguity-scanner/scanner.ts';
import { AmbiguityScannerWorkflow } from '../src/workflows/po/ambiguity-scanner/workflow.ts';

describe('WF-PO-01: Stories & Gherkin AC Workflow Tests', () => {
  test('validates and rejects empty or whitespace-only input', () => {
    const errs = StoriesGherkinParser.validate({ rawNotes: '   ' });
    assert.ok(errs.length > 0);
    assert.match(errs[0].message, /cannot be empty/i);
  });

  test('validates and rejects input that is too brief', () => {
    const errs = StoriesGherkinParser.validate({ rawNotes: 'short note' });
    assert.ok(errs.length > 0);
    assert.match(errs[0].message, /too short/i);
  });

  test('generates user stories and Gherkin AC from clear bulleted notes', () => {
    const input = {
      rawNotes: `- Allow customers to filter products by color and size in real-time
- Allow customers to download monthly invoices as PDF files so that accounting can verify expenses
- Users can reset passwords via email verification link`,
      targetUser: 'E-commerce Customer',
      businessObjective: 'Improve self-service store UX',
    };

    const payload = StoriesGherkinParser.parse(input);
    assert.equal(payload.stories.length, 3);

    // Verify first story
    const story1 = payload.stories[0];
    assert.equal(story1.id, 'US-01');
    assert.equal(story1.role, 'E-commerce Customer');
    assert.match(story1.statement, /As an? E-commerce Customer/);
    assert.ok(story1.scenarios.length >= 1);
    assert.equal(story1.scenarios[0].given.length > 0, true);
    assert.equal(story1.scenarios[0].when.length > 0, true);
    assert.equal(story1.scenarios[0].then.length > 0, true);

    // Verify second story with explicit "so that" benefit
    const story2 = payload.stories[1];
    assert.equal(story2.id, 'US-02');
    assert.equal(story2.benefit, 'accounting can verify expenses');

    // Verify markdown contains Human Review notice
    assert.match(payload.markdown, /HUMAN REVIEW MANDATORY/);
  });

  test('handles notes lacking explicit benefits by flagging clarification questions', () => {
    const input = {
      rawNotes: `- System must export audit logs every 24 hours to S3 bucket`,
      targetUser: 'Compliance Auditor',
    };

    const payload = StoriesGherkinParser.parse(input);
    assert.equal(payload.stories.length, 1);
    const story = payload.stories[0];
    assert.ok(story.assumptions.length > 0);
    assert.ok(story.openQuestions.length > 0);
    assert.match(story.openQuestions[0], /measurable business benefit/i);
  });

  test('produces stable identical output for identical input (determinism)', () => {
    const input = {
      rawNotes: `- Enable multi-factor authentication using authenticator apps
- Prevent account takeover by locking accounts after 5 failed attempts`,
    };

    const run1 = StoriesGherkinParser.parse(input);
    const run2 = StoriesGherkinParser.parse(input);
    assert.deepEqual(run1, run2);
  });

  test('executes end-to-end through StoriesGherkinWorkflow', async () => {
    const workflow = new StoriesGherkinWorkflow();
    const result = await workflow.execute({
      rawNotes: `- Provide dark mode theme toggle for all dashboard screens
- Save selected theme in local storage so preference persists on reload`,
    });

    assert.equal(result.workflowId, 'WF-PO-01');
    assert.equal(result.isDeterministic, true);
    assert.equal(result.epistemicRating, 'inference');
    assert.ok(result.payload.stories.length === 2);
    assert.ok(result.sourceReferences.length >= 2);
    assert.ok(result.disclaimers.length >= 1);
  });
});

describe('WF-PO-02: Requirements Ambiguity Scanner Tests', () => {
  test('validates and rejects empty specification text', () => {
    const errs = AmbiguityScanner.validate({ specText: '' });
    assert.ok(errs.length > 0);
    assert.match(errs[0].message, /cannot be empty/i);
  });

  test('detects vague quantifiers and suggests concrete metrics', () => {
    const input = {
      specText: `The search feature must be fast and return user-friendly results.
The batch synchronization should run periodically as appropriate.`,
    };

    const payload = AmbiguityScanner.scan(input);
    assert.ok(payload.findings.length >= 2);

    const vagueFinding = payload.findings.find((f) => f.category === 'vague_quantifier');
    assert.ok(vagueFinding);
    assert.match(vagueFinding.explanation, /subjective/i);
    assert.match(vagueFinding.clarificationQuestion, /exact numerical threshold/i);
    assert.equal(vagueFinding.severity, 'medium');
  });

  test('detects unresolved dependencies and placeholders (TBD / TODO)', () => {
    const input = {
      specText: `Payment integration with Stripe is TBD pending API contract from finance team.
Customer address validation will be implemented later.`,
    };

    const payload = AmbiguityScanner.scan(input);
    const tbdFinding = payload.findings.find((f) => f.category === 'unresolved_dependency');
    assert.ok(tbdFinding);
    assert.equal(tbdFinding.severity, 'high');
    assert.match(tbdFinding.explanation, /placeholder marker/i);
  });

  test('detects direct contradictions citing both statement lines', () => {
    const input = {
      specText: `Data retention policy: we will retain customer activity logs for 30 days.
Some general text in between.
Compliance rule: we must retain customer activity logs for 90 days.`,
    };

    const payload = AmbiguityScanner.scan(input);
    const contradiction = payload.findings.find((f) => f.category === 'contradiction');
    assert.ok(contradiction);
    assert.equal(contradiction.severity, 'high');
    assert.ok(contradiction.secondaryExcerpt);
    assert.match(contradiction.explanation, /30 days vs 90 days/i);
    assert.equal(contradiction.sourceReferences.length, 2);
  });

  test('detects missing error handling on external integrations', () => {
    const input = {
      specText: `The application shall initiate credit card checkout via third-party webhook.
Ensure invoice is dispatched immediately.`,
    };

    const payload = AmbiguityScanner.scan(input);
    const missingError = payload.findings.find((f) => f.category === 'missing_error_handling');
    assert.ok(missingError);
    assert.equal(missingError.severity, 'high');
  });

  test('executes end-to-end through AmbiguityScannerWorkflow', async () => {
    const workflow = new AmbiguityScannerWorkflow();
    const result = await workflow.execute({
      specText: `The service should be scalable and reliable.
All users can view financial records.
Delete user account without confirmation.`,
    });

    assert.equal(result.workflowId, 'WF-PO-02');
    assert.equal(result.isDeterministic, true);
    assert.ok(result.payload.findings.length >= 2);
    assert.ok(result.markdown.includes('Requirements Ambiguity Report'));
  });
});
