/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ActionItemExtractor } from '../src/workflows/sm/action-item-matrix/extractor.ts';
import { ActionItemMatrixWorkflow } from '../src/workflows/sm/action-item-matrix/workflow.ts';
import { RetroThematicClusterer } from '../src/workflows/sm/retro-thematic-cluster/clusterer.ts';
import { RetroThematicClusterWorkflow } from '../src/workflows/sm/retro-thematic-cluster/workflow.ts';

describe('WF-SM-01: Action Item Matrix Tests', () => {
  test('validates and rejects empty or whitespace-only input', () => {
    const errs = ActionItemExtractor.validate({ meetingNotes: '   ' });
    assert.ok(errs.length > 0);
    assert.match(errs[0].message, /cannot be empty/i);
  });

  test('extracts explicit owners and due dates accurately', () => {
    const input = {
      meetingNotes: `Decision: Migrate authentication session cookies to httpOnly standard.
Action: Update CORS whitelist for staging environment. Owner: Alice Engineer. Due: 2026-10-30.
Bob will investigate database timeout alerts by Friday.
Discussed: Alternative CSS libraries for dark mode.
- [ ] Refactor legacy token generator`,
    };

    const payload = ActionItemExtractor.extract(input);
    assert.equal(payload.decisions.length, 1);
    assert.match(payload.decisions[0].description, /Migrate authentication/);

    // Verify actions
    assert.ok(payload.actions.length >= 3);

    // First action: explicit owner and date
    const act1 = payload.actions[0];
    assert.equal(act1.owner, 'Alice Engineer');
    assert.equal(act1.isOwnerExplicit, true);
    assert.equal(act1.dueDate, '2026-10-30');
    assert.equal(act1.status, 'ASSIGNED');

    // Second action: name + will pattern
    const act2 = payload.actions[1];
    assert.equal(act2.owner, 'Bob');
    assert.equal(act2.dueDate, 'Friday');
    assert.equal(act2.status, 'ASSIGNED');

    // Third action: unassigned checkbox
    const act3 = payload.actions[2];
    assert.equal(act3.owner, 'UNASSIGNED');
    assert.equal(act3.isOwnerExplicit, false);
    assert.equal(act3.status, 'UNASSIGNED');
    assert.match(act3.clarificationNeeded || '', /No owner specified/);
  });

  test('distinguishes decisions from proposals and discussion topics', () => {
    const input = {
      meetingNotes: `Discussed: Changing sprint length to 3 weeks.
Idea: Run retros every Wednesday.
Proposal: Adopt Kubernetes for local development.
Decision: Keep sprint length at 2 weeks.`,
    };

    const payload = ActionItemExtractor.extract(input);
    assert.equal(payload.decisions.length, 1);
    assert.match(payload.decisions[0].description, /Keep sprint length at 2 weeks/);
  });

  test('executes end-to-end through ActionItemMatrixWorkflow', async () => {
    const workflow = new ActionItemMatrixWorkflow();
    const result = await workflow.execute({
      meetingNotes: `Decision: Approve Q4 security audit budget.
Action: Contact external auditor. Owner: Carol. Due: Next Monday.`,
    });

    assert.equal(result.workflowId, 'WF-SM-01');
    assert.equal(result.isDeterministic, true);
    assert.equal(result.epistemicRating, 'confirmed_fact');
    assert.ok(result.markdown.includes('Confirmed Decisions'));
    assert.ok(result.markdown.includes('Action Item Matrix'));
  });
});

describe('WF-SM-02: Retro Thematic Clusterer Tests', () => {
  test('validates and rejects empty retro input', () => {
    const errs = RetroThematicClusterer.validate({ retroNotes: '' });
    assert.ok(errs.length > 0);
  });

  test('clusters retro observations into deterministic themes', () => {
    const input = {
      retroNotes: `+ CI build times dropped to 4 minutes thanks to caching!
- Flaky tests in auth suite failed three times during staging deploy.
- Standups are running 35 minutes and feeling repetitive.
- Requirements for the billing module were unclear and changed mid-sprint.
- Code reviews took more than 24 hours to get first comments.
Some unclustered observation about coffee machine in the break room.`,
    };

    const payload = RetroThematicClusterer.cluster(input);
    assert.ok(payload.themes.length >= 3);

    // Verify tooling/CI theme
    const toolingTheme = payload.themes.find((t) => t.id === 'TH-TOOLING');
    assert.ok(toolingTheme);
    assert.ok(toolingTheme.observations.some((o) => o.text.includes('CI build')));

    // Verify unclustered feedback is preserved without dropping
    assert.ok(payload.unclusteredObservations.length >= 1);
    assert.ok(payload.unclusteredObservations.some((o) => o.text.includes('coffee machine')));

    // Verify no fabricated statistical claims
    assert.ok(payload.limitations.includes('EPISTEMIC LIMITATIONS'));
  });

  test('executes end-to-end through RetroThematicClusterWorkflow', async () => {
    const workflow = new RetroThematicClusterWorkflow();
    const result = await workflow.execute({
      retroNotes: `Kudos to the DevOps team for smooth pipeline deployment.
Frustrated by constant scope creep during sprint execution.
Try limiting PR size to under 300 lines of code.`,
    });

    assert.equal(result.workflowId, 'WF-SM-02');
    assert.equal(result.isDeterministic, true);
    assert.ok(result.payload.themes.length > 0);
    assert.ok(result.markdown.includes('Sprint Retrospective Synthesis'));
  });
});
