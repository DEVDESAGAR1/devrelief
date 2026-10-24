/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValidationError, SourceReference } from '../../../types/workflow.ts';
import {
  MultiSourceDeliveryInput,
  MultiSourceDeliveryPayload,
  DeliveryBlocker,
  ConfirmedDeliveryEvidence,
} from './types.ts';

export class MultiSourceAggregator {
  public static validate(input: MultiSourceDeliveryInput): InputValidationError[] {
    const errors: InputValidationError[] = [];
    if (!input || input.combinedEvidenceText === undefined || input.combinedEvidenceText === null || typeof input.combinedEvidenceText !== 'string') {
      errors.push({
        field: 'combinedEvidenceText',
        message: 'Delivery evidence input is required and must be a string.',
      });
      return errors;
    }

    if (input.combinedEvidenceText.trim().length === 0) {
      errors.push({
        field: 'combinedEvidenceText',
        message: 'Delivery evidence text cannot be empty or whitespace-only.',
      });
      return errors;
    }

    if (input.combinedEvidenceText.trim().length < 25) {
      errors.push({
        field: 'combinedEvidenceText',
        message: 'Delivery evidence text is too brief to synthesize delivery briefing (minimum 25 characters).',
      });
    }

    return errors;
  }

  public static aggregate(input: MultiSourceDeliveryInput): MultiSourceDeliveryPayload {
    const sourceName = input.sourceName || 'delivery_sources.log';
    const projectLabel = input.projectLabel || 'Active Engineering Stream';
    const reportingPeriod = input.reportingPeriod || 'Current Sprint / Cadence (Period not explicitly specified)';
    const lines = input.combinedEvidenceText.split('\n');

    let commitsCount = 0;
    let testsPassedCount: number | undefined;
    let testsFailedCount: number | undefined;
    let ciStatus: 'PASSED' | 'FAILED' | 'UNKNOWN' = 'UNKNOWN';

    const completedWork: string[] = [];
    const blockerMatrix: DeliveryBlocker[] = [];
    const potentialRisks: string[] = [];
    const unresolvedQuestions: string[] = [];
    const crossSourceLinks: string[] = [];
    const dataGapsAndLimitations: string[] = [];

    let blockerCounter = 1;

    // Scan lines
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const lineNum = index + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const sourceRefs: SourceReference[] = [
        {
          source: sourceName,
          lineStart: lineNum,
          lineEnd: lineNum,
          rawSnippet: trimmed,
        },
      ];

      // 1. Commits & Merges
      if (/^[a-f0-9]{7,40}\b/i.test(trimmed) || /\b(?:feat|fix|refactor|chore)\b\(?[^)]*\)?:/i.test(trimmed)) {
        commitsCount++;
      }

      // 2. Completed items (explicitly marked done)
      if (/^\[x\]\s*(.+)/i.test(trimmed) || /\b(?:completed|merged pr|shipped|closed ticket):\s*(.+)/i.test(trimmed)) {
        const itemText = trimmed.replace(/^\[x\]\s*/i, '').replace(/\b(?:completed|merged pr|shipped|closed ticket):\s*/i, '').trim();
        completedWork.push(itemText);
      }

      // 3. CI / Test status
      const testPassMatch = trimmed.match(/(\d+)\s+(?:tests?\s+)?pass(?:ed|ing)?/i);
      if (testPassMatch) {
        testsPassedCount = parseInt(testPassMatch[1], 10);
      }
      const testFailMatch = trimmed.match(/(\d+)\s+(?:tests?\s+)?fail(?:ed|ures)?/i);
      if (testFailMatch) {
        testsFailedCount = parseInt(testFailMatch[1], 10);
      }
      if (/\b(?:BUILD SUCCESS|SUCCESSFUL|All tests passed)\b/i.test(trimmed)) {
        ciStatus = 'PASSED';
      } else if (/\b(?:BUILD FAILURE|FAILED|ERRORS!)\b/i.test(trimmed)) {
        ciStatus = 'FAILED';
      }

      // 4. Blockers and Impediments
      const blockerMatch = trimmed.match(/\b(?:blocker|blocked by|impediment|stuck on):\s*(.+)/i);
      if (blockerMatch) {
        const desc = blockerMatch[1].trim();

        // Check if owner is mentioned
        let owner = 'UNKNOWN';
        const ownerMatch = desc.match(/\b(?:owner|assigned to|lead):\s*([A-Za-z0-9_\s]+?)(?:;|,|\.|$)/i);
        if (ownerMatch) {
          owner = ownerMatch[1].trim();
        }

        blockerMatrix.push({
          id: `BLK-${String(blockerCounter++).padStart(2, '0')}`,
          description: desc,
          supportingEvidence: `Line ${lineNum}: "${trimmed}"`,
          impact: 'Potential delivery delay or halted sprint goal.',
          owner,
          dependency: 'External dependency or pending prerequisite',
          status: 'ACTIVE',
          missingInformation: owner === 'UNKNOWN' ? 'Explicit blocker owner not assigned in notes.' : 'Resolution target date not specified.',
          suggestedFollowUp: '[Recommendation]: Escalate in standup and assign directly to engineering lead.',
          sourceReferences: sourceRefs,
        });
      }

      // 5. Questions
      if (trimmed.endsWith('?') || /^(?:q|question|open question):\s*/i.test(trimmed)) {
        unresolvedQuestions.push(trimmed);
      }
    }

    // Cross-source correlation check
    if (ciStatus === 'FAILED' && blockerMatrix.length > 0) {
      crossSourceLinks.push('CI pipeline failure correlates with active blocker in delivery logs.');
    }
    if (commitsCount > 0 && completedWork.length > 0) {
      crossSourceLinks.push(`${commitsCount} code commit(s) support ${completedWork.length} marked completed task(s).`);
    }

    // Assessments & Potential Risks
    if (ciStatus === 'FAILED') {
      potentialRisks.push('[Assessment]: Broken CI pipeline prevents reliable merge and regression verification.');
    }
    if (blockerMatrix.length > 0) {
      potentialRisks.push(`[Assessment]: ${blockerMatrix.length} active blocker(s) threaten sprint delivery commitments.`);
    }

    // Data gaps
    dataGapsAndLimitations.push('No deployment logs provided; build success does NOT imply successful production deployment.');
    dataGapsAndLimitations.push('Team velocity, sprint burndown, and capacity percentages are omitted (cannot be inferred without Jira/Linear metadata).');
    if (!input.reportingPeriod) {
      dataGapsAndLimitations.push('Reporting period was not provided by user and has not been guessed from filenames.');
    }

    const executiveSummary = `Delivery synthesis for ${projectLabel}: Recorded ${commitsCount} commit(s), ${completedWork.length} completed work item(s), ${blockerMatrix.length} active blocker(s), and CI status: ${ciStatus}.`;

    const humanReviewNotice =
      'HUMAN REVIEW MANDATORY: Delivery briefing synthesizes explicit input evidence only. Velocity, capacity, and release readiness must be validated with team leads prior to executive distribution.';

    const stakeholderDraft = `Executive Update (${projectLabel}):\n- Status: ${ciStatus === 'FAILED' || blockerMatrix.length > 0 ? 'AMBER (Active blockers or CI attention required)' : 'GREEN'}\n- Key Deliverables Completed: ${completedWork.length > 0 ? completedWork.slice(0, 3).join('; ') : 'Routine engineering commits in progress'}\n- Blockers Under Investigation: ${blockerMatrix.length}\n- Next Step: Review blocker matrix and resolve pipeline issues.`;

    const payload: MultiSourceDeliveryPayload = {
      projectLabel,
      reportingPeriod,
      executiveSummary,
      confirmedEvidence: {
        commitsCount,
        testsPassedCount,
        testsFailedCount,
        ciStatus,
        completedTasks: completedWork,
      },
      completedWork,
      blockerMatrix,
      potentialRisks,
      unresolvedQuestions,
      crossSourceLinks,
      dataGapsAndLimitations,
      stakeholderUpdateDraft: stakeholderDraft,
      humanReviewNotice,
      markdown: '',
    };

    payload.markdown = MultiSourceAggregator.renderMarkdown(payload);
    return payload;
  }

  private static renderMarkdown(payload: MultiSourceDeliveryPayload): string {
    const md: string[] = [];
    md.push(`# Delivery Summary & Blocker Matrix: ${payload.projectLabel}`);
    md.push(`*Reporting Period: ${payload.reportingPeriod}*`);
    md.push('');
    md.push(`> ⚠️ **${payload.humanReviewNotice}**`);
    md.push('');
    md.push(`## Executive Summary`);
    md.push(payload.executiveSummary);
    md.push('');
    md.push(`- **Verified Commits:** ${payload.confirmedEvidence.commitsCount}`);
    md.push(`- **CI Build Status:** \`${payload.confirmedEvidence.ciStatus}\``);
    if (payload.confirmedEvidence.testsPassedCount !== undefined) {
      md.push(`- **Tests Passing:** ${payload.confirmedEvidence.testsPassedCount}`);
    }
    if (payload.confirmedEvidence.testsFailedCount !== undefined) {
      md.push(`- **Tests Failing:** ${payload.confirmedEvidence.testsFailedCount}`);
    }
    md.push(`- **Completed Work Items:** ${payload.completedWork.length}`);
    md.push(`- **Active Blockers:** ${payload.blockerMatrix.length}`);
    md.push('');
    md.push('---');
    md.push('');

    // Completed Work
    if (payload.completedWork.length > 0) {
      md.push('## Confirmed Completed Work');
      md.push('');
      payload.completedWork.forEach((w) => md.push(`- ✅ ${w}`));
      md.push('');
    }

    // Blocker Matrix
    md.push('## Active Blocker Matrix');
    md.push('');
    md.push('| ID | Description | Owner | Status | Suggested Follow-up |');
    md.push('| :--- | :--- | :--- | :--- | :--- |');

    if (payload.blockerMatrix.length === 0) {
      md.push('| - | *No active blockers reported in evidence* | - | GREEN | Maintain cadence |');
    } else {
      payload.blockerMatrix.forEach((b) => {
        md.push(`| ${b.id} | ${b.description.replace(/\|/g, '\\|')} | **${b.owner}** | \`${b.status}\` | ${b.suggestedFollowUp} |`);
      });
    }
    md.push('');

    // Risks & Assessments
    if (payload.potentialRisks.length > 0) {
      md.push('## Potential Delivery Risks (Assessments)');
      md.push('');
      payload.potentialRisks.forEach((r) => md.push(`- ⚠️ ${r}`));
      md.push('');
    }

    // Cross-source links
    if (payload.crossSourceLinks.length > 0) {
      md.push('## Cross-Source Correlations');
      md.push('');
      payload.crossSourceLinks.forEach((l) => md.push(`- 🔗 ${l}`));
      md.push('');
    }

    // Data gaps
    md.push('## Data Gaps & Reporting Limitations');
    md.push('');
    payload.dataGapsAndLimitations.forEach((g) => md.push(`- ℹ️ ${g}`));
    md.push('');

    // Stakeholder update draft
    md.push('## Draft Stakeholder Communication');
    md.push('```text');
    md.push(payload.stakeholderUpdateDraft);
    md.push('```');

    return md.join('\n');
  }
}
