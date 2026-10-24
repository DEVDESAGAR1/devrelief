/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValidationError, SourceReference } from '../../../types/workflow.ts';
import {
  ActionItemMatrixInput,
  ActionItemMatrixPayload,
  ActionItem,
  MeetingDecision,
  ActionItemStatus,
} from './types.ts';

export class ActionItemExtractor {
  public static validate(input: ActionItemMatrixInput): InputValidationError[] {
    const errors: InputValidationError[] = [];
    if (!input || input.meetingNotes === undefined || input.meetingNotes === null || typeof input.meetingNotes !== 'string') {
      errors.push({
        field: 'meetingNotes',
        message: 'Meeting notes input is required and must be a string.',
      });
      return errors;
    }

    if (input.meetingNotes.trim().length === 0) {
      errors.push({
        field: 'meetingNotes',
        message: 'Meeting notes cannot be empty or whitespace-only.',
      });
      return errors;
    }

    if (input.meetingNotes.trim().length < 20) {
      errors.push({
        field: 'meetingNotes',
        message: 'Meeting notes are too brief to extract action items (minimum 20 characters).',
      });
    }

    return errors;
  }

  public static extract(input: ActionItemMatrixInput): ActionItemMatrixPayload {
    const sourceName = input.sourceName || 'meeting_notes.md';
    const meetingTitle = input.meetingTitle || 'Sprint Delivery Sync';
    const lines = input.meetingNotes.split('\n');

    const actions: ActionItem[] = [];
    const decisions: MeetingDecision[] = [];
    const unresolvedQuestions: string[] = [];
    const dependenciesAndBlockers: string[] = [];

    let actionCounter = 1;
    let decisionCounter = 1;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const sourceRefs: SourceReference[] = [
        {
          source: sourceName,
          lineStart: lineNum,
          lineEnd: lineNum,
          rawSnippet: trimmed,
        },
      ];

      // 1. Explicit Decisions (Distinct from Proposals)
      const decisionMatch = trimmed.match(/^(?:decision|decided|agreed|resolved|consensus):\s*(.+)/i);
      if (decisionMatch) {
        decisions.push({
          id: `DEC-${String(decisionCounter++).padStart(2, '0')}`,
          description: decisionMatch[1].trim(),
          sourceLine: lineNum,
          sourceReferences: sourceRefs,
        });
        return;
      }

      // Check if line indicates discussion or proposal (do not classify as decision)
      if (/^(?:discussed|proposed|proposal|idea|option):\s*/i.test(trimmed)) {
        // Just general discussion, not a firm decision or action
        return;
      }

      // 2. Questions / Unresolved items
      if (/^(?:q|question|open question):\s*(.+)/i.test(trimmed) || (trimmed.endsWith('?') && !trimmed.toLowerCase().includes('action'))) {
        const qText = trimmed.replace(/^(?:q|question|open question):\s*/i, '').trim();
        unresolvedQuestions.push(qText);
      }

      // 3. Blockers and Dependencies
      if (/\b(?:blocker|blocked by|blocked on|dependency|depends on):\s*(.+)/i.test(trimmed)) {
        dependenciesAndBlockers.push(trimmed);
      }

      // 4. Action Items
      // Check for explicit action indicators:
      // - "Action: ...", "AI: ...", "TODO: ...", "- [ ] ..."
      // - "[Name] to [verb] ...", "[Name] will [verb] ..."
      // - "Owner: [Name]"
      const isActionPrefix = /^(?:action|action item|ai|todo|task):\s*(.+)/i.exec(trimmed);
      const isCheckbox = /^[-*]\s*\[\s*\]\s*(.+)/i.exec(trimmed);
      const isNameVerb = /^([A-Z][a-z]+)\s+(?:to|will|shall)\s+(.+)/.exec(trimmed);
      const hasActionKeyword = /\b(?:action item|action:|owner:|assigned to:)\b/i.test(trimmed);

      if (isActionPrefix || isCheckbox || isNameVerb || hasActionKeyword) {
        let content = trimmed;
        if (isActionPrefix) content = isActionPrefix[1].trim();
        if (isCheckbox) content = isCheckbox[1].trim();

        // Extract Owner
        let owner = 'UNASSIGNED';
        let isOwnerExplicit = false;

        const ownerExplicitMatch = content.match(/\b(?:owner|assigned to|assignee|lead|driver):\s*([A-Za-z0-9_\s]+?)(?:;|,|\.|$|\s*\(|\s+due\b)/i);
        const atMentionMatch = content.match(/@([A-Za-z0-9_-]+)/);

        if (ownerExplicitMatch) {
          owner = ownerExplicitMatch[1].trim();
          isOwnerExplicit = true;
        } else if (atMentionMatch) {
          owner = atMentionMatch[1].trim();
          isOwnerExplicit = true;
        } else if (isNameVerb) {
          owner = isNameVerb[1].trim();
          isOwnerExplicit = true;
        }

        // Extract Due Date
        let dueDate = 'NOT SPECIFIED';
        let isDueDateExplicit = false;

        const dateMatch = content.match(
          /\b(?:due(?:\s+by|\s+date)?|deadline|target(?:\s+date)?):\s*([A-Za-z0-9\s,\-\/]+?)(?:;|\.|$|\s*\()|\bby\s+([A-Za-z0-9\s,\-\/]+?)(?:;|\.|$|\s*\()/i
        );
        if (dateMatch) {
          dueDate = (dateMatch[1] || dateMatch[2]).trim();
          isDueDateExplicit = true;
        }

        // Clean description
        let description = content
          .replace(/\b(?:owner|assigned to|assignee|lead|driver):\s*[A-Za-z0-9_\s]+?(?:;|,|\.|$)/i, '')
          .replace(/\b(?:due(?:\s+by|\s+date)?|deadline|target(?:\s+date)?):\s*[A-Za-z0-9\s,\-\/]+?(?:;|\.|$)/i, '')
          .replace(/\bby\s+[A-Za-z0-9\s,\-\/]+?(?:;|\.|$)/i, '')
          .replace(/^[-*•]\s*/, '')
          .trim();

        if (description.length === 0) {
          description = content;
        }

        // Determine status
        let status: ActionItemStatus = 'NOT SPECIFIED';
        if (/\bblocked\b/i.test(trimmed)) {
          status = 'BLOCKED';
        } else if (isOwnerExplicit) {
          status = 'ASSIGNED';
        } else {
          status = 'UNASSIGNED';
        }

        const clarifications: string[] = [];
        if (!isOwnerExplicit) clarifications.push('No owner specified.');
        if (!isDueDateExplicit) clarifications.push('No due date specified.');

        actions.push({
          id: `ACT-${String(actionCounter++).padStart(2, '0')}`,
          description,
          owner,
          isOwnerExplicit,
          dueDate,
          isDueDateExplicit,
          status,
          clarificationNeeded: clarifications.length > 0 ? clarifications.join(' ') : undefined,
          sourceReferences: sourceRefs,
        });
      }
    });

    const assignedCount = actions.filter((a) => a.isOwnerExplicit).length;
    const unassignedCount = actions.filter((a) => !a.isOwnerExplicit).length;

    const summary = `Extracted ${actions.length} action items (${assignedCount} assigned, ${unassignedCount} unassigned) and ${decisions.length} confirmed decisions.`;

    const humanReviewNotice =
      'HUMAN REVIEW MANDATORY: Action items, assignments, and decisions are extracted from explicit text markers. Do not automatically create Jira/Linear tickets or update external trackers without Scrum Master and team verification.';

    const payload: ActionItemMatrixPayload = {
      meetingTitle,
      meetingDate: input.meetingDate,
      summary,
      totalActionItems: actions.length,
      assignedCount,
      unassignedCount,
      actions,
      decisions,
      unresolvedQuestions,
      dependenciesAndBlockers,
      humanReviewNotice,
      markdown: '',
    };

    payload.markdown = ActionItemExtractor.renderMarkdown(payload);
    return payload;
  }

  private static renderMarkdown(payload: ActionItemMatrixPayload): string {
    const md: string[] = [];
    md.push(`# Action Item Matrix: ${payload.meetingTitle}`);
    if (payload.meetingDate) {
      md.push(`*Meeting Date: ${payload.meetingDate}*`);
    }
    md.push('');
    md.push(`> ⚠️ **${payload.humanReviewNotice}**`);
    md.push('');
    md.push(`- **Summary:** ${payload.summary}`);
    md.push(`- **Action Items:** ${payload.totalActionItems} (${payload.assignedCount} assigned, ${payload.unassignedCount} unassigned)`);
    md.push(`- **Decisions Recorded:** ${payload.decisions.length}`);
    md.push('');
    md.push('---');
    md.push('');

    // Decisions Section
    if (payload.decisions.length > 0) {
      md.push('## Confirmed Decisions');
      md.push('');
      payload.decisions.forEach((d) => {
        md.push(`- **[${d.id}]** ${d.description} *(Line ${d.sourceLine})*`);
      });
      md.push('');
    }

    // Action Items Table
    md.push('## Action Item Matrix');
    md.push('');
    md.push('| ID | Action Description | Owner | Due Date | Status | Clarification |');
    md.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

    if (payload.actions.length === 0) {
      md.push('| - | *No explicit action items detected in notes* | UNASSIGNED | NOT SPECIFIED | NOT SPECIFIED | Review notes for implied tasks |');
    } else {
      payload.actions.forEach((a) => {
        const ownerDisplay = a.isOwnerExplicit ? `**${a.owner}**` : '*UNASSIGNED*';
        const dateDisplay = a.isDueDateExplicit ? a.dueDate : '*NOT SPECIFIED*';
        const clar = a.clarificationNeeded || 'None';
        md.push(`| ${a.id} | ${a.description.replace(/\|/g, '\\|')} | ${ownerDisplay} | ${dateDisplay} | \`${a.status}\` | ${clar} |`);
      });
    }

    md.push('');

    // Blockers
    if (payload.dependenciesAndBlockers.length > 0) {
      md.push('## Active Blockers & Dependencies');
      md.push('');
      payload.dependenciesAndBlockers.forEach((b) => md.push(`- 🚫 ${b}`));
      md.push('');
    }

    // Unresolved Questions
    if (payload.unresolvedQuestions.length > 0) {
      md.push('## Unresolved Questions & Clarifications');
      md.push('');
      payload.unresolvedQuestions.forEach((q) => md.push(`- ❓ ${q}`));
      md.push('');
    }

    return md.join('\n');
  }
}
